import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  createPaste,
  getPasteAndIncrementView,
  checkDbHealth,
  getUserPastes,
} from './src/db/pastes.ts';
import { optionalAuth, requireAuth, AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Enable JSON body parsing and CORS
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Helper to determine base URL
function getBaseUrl(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await checkDbHealth();
    if (dbHealth.ok) {
      return res.status(200).json({
        status: 'healthy',
        database: 'connected',
        latency_ms: dbHealth.latencyMs,
        timestamp: new Date().toISOString(),
      });
    } else {
      return res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Create a new paste
 * POST /api/pastes
 */
app.post('/api/pastes', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { content, ttl_seconds, max_views } = req.body;

    // Content validation
    if (content === undefined || content === null) {
      return res.status(400).json({
        error: 'Content is required.',
      });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({
        error: 'Content must be a string.',
      });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({
        error: 'Content cannot be empty.',
      });
    }

    // TTL validation
    let parsedTtl: number | null = null;
    if (ttl_seconds !== undefined && ttl_seconds !== null) {
      if (typeof ttl_seconds !== 'number' || !Number.isInteger(ttl_seconds) || ttl_seconds <= 0) {
        return res.status(400).json({
          error: 'ttl_seconds must be a positive integer greater than 0.',
        });
      }
      parsedTtl = ttl_seconds;
    }

    // Max views validation
    let parsedMaxViews: number | null = null;
    if (max_views !== undefined && max_views !== null) {
      if (typeof max_views !== 'number' || !Number.isInteger(max_views) || max_views <= 0) {
        return res.status(400).json({
          error: 'max_views must be an integer greater than or equal to 1.',
        });
      }
      parsedMaxViews = max_views;
    }

    const creatorUid = req.user?.uid || null;

    const paste = await createPaste({
      content,
      ttlSeconds: parsedTtl,
      maxViews: parsedMaxViews,
      creatorUid,
    });

    const baseUrl = getBaseUrl(req);
    const shareableUrl = `${baseUrl}/p/${paste.slug}`;

    return res.status(201).json({
      id: paste.id,
      slug: paste.slug,
      url: shareableUrl,
      content: paste.content,
      created_at: paste.created_at,
      expires_at: paste.expires_at,
      max_views: paste.max_views,
      view_count: paste.view_count,
      ttl_seconds: parsedTtl,
    });
  } catch (error: any) {
    console.error('Failed to create paste:', error);
    return res.status(500).json({
      error: 'Failed to create paste due to an internal server error.',
    });
  }
});

/**
 * Retrieve a paste by slug
 * GET /api/pastes/:slug
 */
app.get('/api/pastes/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    return res.status(400).json({ error: 'Valid slug is required.' });
  }

  try {
    const result = await getPasteAndIncrementView(slug.trim());

    if (!result.paste) {
      const reasonMessages: Record<string, string> = {
        not_found: 'Paste not found.',
        expired: 'This paste has expired based on its time-to-live (TTL).',
        view_limit_exceeded: 'This paste has reached its maximum view limit and is no longer available.',
      };

      const message =
        reasonMessages[result.reason || 'not_found'] ||
        'Paste not found or has expired.';

      return res.status(404).json({
        error: message,
        reason: result.reason || 'not_found',
      });
    }

    // Support plain text response if Accept header prefers text/plain
    if (req.headers.accept?.includes('text/plain')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(result.paste.content);
    }

    return res.status(200).json({
      id: result.paste.id,
      slug: result.paste.slug,
      content: result.paste.content,
      created_at: result.paste.created_at,
      expires_at: result.paste.expires_at,
      max_views: result.paste.max_views,
      view_count: result.paste.view_count,
      remaining_views: result.paste.remaining_views,
    });
  } catch (error: any) {
    console.error(`Error retrieving paste ${slug}:`, error);
    return res.status(500).json({
      error: 'Failed to retrieve paste due to an internal server error.',
    });
  }
});

/**
 * Raw text endpoint for curl/CLI users
 * GET /api/pastes/:slug/raw
 */
app.get('/api/pastes/:slug/raw', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const result = await getPasteAndIncrementView(slug);
    if (!result.paste) {
      return res.status(404).type('text/plain').send('Error 404: Paste not found or has expired.\n');
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(result.paste.content);
  } catch (error) {
    return res.status(500).type('text/plain').send('Error 500: Internal server error.\n');
  }
});

/**
 * Get authenticated user's pastes
 * GET /api/user/pastes
 */
app.get('/api/user/pastes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pastes = await getUserPastes(req.user.uid);
    return res.status(200).json({ pastes });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve user pastes' });
  }
});

// ==========================================
// FRONTEND SERVING (VITE DEV / STATIC PROD)
// ==========================================

async function setupServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pastebin Lite server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  setupServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
