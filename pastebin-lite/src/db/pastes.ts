import crypto from 'node:crypto';
import { pool } from './index.ts';

export interface CreatePasteParams {
  content: string;
  ttlSeconds?: number | null;
  maxViews?: number | null;
  creatorUid?: string | null;
}

export interface PasteRecord {
  id: number;
  slug: string;
  content: string;
  created_at: Date;
  expires_at: Date | null;
  max_views: number | null;
  view_count: number;
  creator_uid: string | null;
  remaining_views?: number | null;
}

export interface RetrievalResult {
  paste: PasteRecord | null;
  reason?: 'not_found' | 'expired' | 'view_limit_exceeded';
}

function generateSecureSlug(length = 8): string {
  // Generate a URL-safe random string
  return crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length);
}

/**
 * Creates a new paste with optional TTL and maximum views.
 */
export async function createPaste(params: CreatePasteParams): Promise<PasteRecord> {
  const { content, ttlSeconds, maxViews, creatorUid } = params;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Content is required and cannot be empty.');
  }

  if (ttlSeconds !== undefined && ttlSeconds !== null) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttl_seconds must be a positive integer.');
    }
  }

  if (maxViews !== undefined && maxViews !== null) {
    if (!Number.isInteger(maxViews) || maxViews <= 0) {
      throw new Error('max_views must be an integer greater than or equal to 1.');
    }
  }

  const expiresAt =
    ttlSeconds && ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000)
      : null;

  // Slug collision retry loop (up to 4 attempts)
  let attempts = 0;
  while (attempts < 4) {
    attempts++;
    const slug = generateSecureSlug(8);

    try {
      const query = `
        INSERT INTO pastes (slug, content, created_at, expires_at, max_views, view_count, creator_uid)
        VALUES ($1, $2, NOW(), $3, $4, 0, $5)
        RETURNING id, slug, content, created_at, expires_at, max_views, view_count, creator_uid;
      `;
      const values = [
        slug,
        content,
        expiresAt,
        maxViews !== undefined && maxViews !== null ? maxViews : null,
        creatorUid || null,
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (err: any) {
      // 23505 is PostgreSQL unique constraint violation
      if (err.code === '23505' && attempts < 4) {
        continue;
      }
      console.error('Failed to create paste in database:', err);
      throw new Error('Failed to create paste. Database operation failed.', {
        cause: err,
      });
    }
  }

  throw new Error('Failed to generate a unique paste identifier after multiple attempts.');
}

/**
 * Atomically retrieves a paste and increments view count only if not expired and within max views.
 * Returns null paste with reason if unavailable.
 */
export async function getPasteAndIncrementView(slug: string): Promise<RetrievalResult> {
  try {
    // Single atomic UPDATE with conditional constraints
    const updateQuery = `
      UPDATE pastes
      SET view_count = view_count + 1
      WHERE slug = $1
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_views IS NULL OR view_count < max_views)
      RETURNING id, slug, content, created_at, expires_at, max_views, view_count, creator_uid;
    `;

    const updateRes = await pool.query(updateQuery, [slug]);

    if (updateRes.rows.length > 0) {
      const row = updateRes.rows[0];
      const remainingViews =
        row.max_views !== null ? Math.max(0, row.max_views - row.view_count) : null;

      return {
        paste: {
          ...row,
          remaining_views: remainingViews,
        },
      };
    }

    // If update returned 0 rows, determine why to provide exact reason
    const checkQuery = `
      SELECT id, slug, expires_at, max_views, view_count
      FROM pastes
      WHERE slug = $1;
    `;
    const checkRes = await pool.query(checkQuery, [slug]);

    if (checkRes.rows.length === 0) {
      return { paste: null, reason: 'not_found' };
    }

    const existing = checkRes.rows[0];
    const now = new Date();

    if (existing.expires_at && new Date(existing.expires_at) <= now) {
      return { paste: null, reason: 'expired' };
    }

    if (existing.max_views !== null && existing.view_count >= existing.max_views) {
      return { paste: null, reason: 'view_limit_exceeded' };
    }

    // Default fallback
    return { paste: null, reason: 'not_found' };
  } catch (error) {
    console.error('Error fetching paste:', error);
    throw new Error('Database query failed during paste retrieval.', { cause: error });
  }
}

/**
 * Checks database health connectivity
 */
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    console.error('Database health check failed:', err);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * Retrieves pastes created by a specific user (optional feature)
 */
export async function getUserPastes(creatorUid: string): Promise<PasteRecord[]> {
  try {
    const query = `
      SELECT id, slug, content, created_at, expires_at, max_views, view_count, creator_uid
      FROM pastes
      WHERE creator_uid = $1
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    const res = await pool.query(query, [creatorUid]);
    return res.rows;
  } catch (error) {
    console.error('Error fetching user pastes:', error);
    throw new Error('Failed to retrieve user pastes.', { cause: error });
  }
}
