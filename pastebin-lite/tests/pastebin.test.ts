process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import dotenv from 'dotenv';
import { pool } from '../src/db/index.ts';
import { createPaste, getPasteAndIncrementView, checkDbHealth } from '../src/db/pastes.ts';
import app from '../server.ts';

dotenv.config();

let server: http.Server;
let port: number;
let baseUrl: string;

before(async () => {
  // Start server on an ephemeral port for testing
  await new Promise<void>((resolve) => {
    server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      port = address.port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

async function apiRequest(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
) {
  const url = `${baseUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

describe('Pastebin Lite Automated Test Suite', () => {
  test('Health Check: Database connection is active', async () => {
    const res = await apiRequest('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'healthy');
    assert.strictEqual(res.data.database, 'connected');
  });

  test('Test 1: Creating a paste successfully', async () => {
    const payload = {
      content: 'Line 1: Hello World\nLine 2: Testing Pastebin Lite\nLine 3: 🚀',
      ttl_seconds: 3600,
      max_views: 10,
    };

    const res = await apiRequest('POST', '/api/pastes', payload);
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id, 'Expected paste id');
    assert.ok(res.data.slug, 'Expected paste slug');
    assert.strictEqual(typeof res.data.slug, 'string');
    assert.strictEqual(res.data.content, payload.content);
    assert.strictEqual(res.data.max_views, 10);
    assert.strictEqual(res.data.view_count, 0);
    assert.ok(res.data.url.includes(res.data.slug));
    assert.ok(res.data.expires_at !== null);
  });

  test('Test 2: Retrieving an existing paste', async () => {
    const createRes = await apiRequest('POST', '/api/pastes', {
      content: 'Multi-line code snippet:\nfunction add(a, b) {\n  return a + b;\n}',
      ttl_seconds: 600,
      max_views: 5,
    });
    assert.strictEqual(createRes.status, 201);
    const slug = createRes.data.slug;

    const getRes = await apiRequest('GET', `/api/pastes/${slug}`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.slug, slug);
    assert.strictEqual(
      getRes.data.content,
      'Multi-line code snippet:\nfunction add(a, b) {\n  return a + b;\n}'
    );
    assert.strictEqual(getRes.data.view_count, 1);
    assert.strictEqual(getRes.data.remaining_views, 4);
  });

  test('Test 3: Retrieving a nonexistent paste', async () => {
    const res = await apiRequest('GET', '/api/pastes/nonexistent_slug_xyz999');
    assert.strictEqual(res.status, 404);
    assert.ok(res.data.error);
    assert.strictEqual(res.data.reason, 'not_found');
  });

  test('Test 4: Creating a paste with no expiration', async () => {
    const createRes = await apiRequest('POST', '/api/pastes', {
      content: 'This paste has no TTL and no max views limit.',
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.data.expires_at, null);
    assert.strictEqual(createRes.data.max_views, null);
    const slug = createRes.data.slug;

    // View it multiple times
    for (let i = 1; i <= 3; i++) {
      const getRes = await apiRequest('GET', `/api/pastes/${slug}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.data.view_count, i);
      assert.strictEqual(getRes.data.remaining_views, null);
    }
  });

  test('Test 5: TTL expiration', async () => {
    // 1 second TTL
    const createRes = await apiRequest('POST', '/api/pastes', {
      content: 'Ephemeral paste with 1s TTL',
      ttl_seconds: 1,
    });
    assert.strictEqual(createRes.status, 201);
    const slug = createRes.data.slug;

    // First retrieval before expiration
    const immediateRes = await apiRequest('GET', `/api/pastes/${slug}`);
    assert.strictEqual(immediateRes.status, 200);

    // Wait for 1.3 seconds to pass TTL
    await new Promise((r) => setTimeout(r, 1300));

    // Retrieval after expiration
    const expiredRes = await apiRequest('GET', `/api/pastes/${slug}`);
    assert.strictEqual(expiredRes.status, 404);
    assert.strictEqual(expiredRes.data.reason, 'expired');
  });

  test('Test 6: Maximum view expiration', async () => {
    const createRes = await apiRequest('POST', '/api/pastes', {
      content: 'Burn after 2 views',
      max_views: 2,
    });
    assert.strictEqual(createRes.status, 201);
    const slug = createRes.data.slug;

    // 1st view
    const view1 = await apiRequest('GET', `/api/pastes/${slug}`);
    assert.strictEqual(view1.status, 200);
    assert.strictEqual(view1.data.view_count, 1);
    assert.strictEqual(view1.data.remaining_views, 1);

    // 2nd view
    const view2 = await apiRequest('GET', `/api/pastes/${slug}`);
    assert.strictEqual(view2.status, 200);
    assert.strictEqual(view2.data.view_count, 2);
    assert.strictEqual(view2.data.remaining_views, 0);

    // 3rd view - should be unavailable
    const view3 = await apiRequest('GET', `/api/pastes/${slug}`);
    assert.strictEqual(view3.status, 404);
    assert.strictEqual(view3.data.reason, 'view_limit_exceeded');
  });

  test('Test 7: Combined TTL and view expiration', async () => {
    // Scenario A: View limit exhausted before TTL expires
    const pasteA = await apiRequest('POST', '/api/pastes', {
      content: 'Paste A: View limit hits first',
      ttl_seconds: 3600,
      max_views: 1,
    });
    assert.strictEqual(pasteA.status, 201);
    const slugA = pasteA.data.slug;

    const resA1 = await apiRequest('GET', `/api/pastes/${slugA}`);
    assert.strictEqual(resA1.status, 200);

    const resA2 = await apiRequest('GET', `/api/pastes/${slugA}`);
    assert.strictEqual(resA2.status, 404);
    assert.strictEqual(resA2.data.reason, 'view_limit_exceeded');

    // Scenario B: TTL expires before view limit reached
    const pasteB = await apiRequest('POST', '/api/pastes', {
      content: 'Paste B: TTL hits first',
      ttl_seconds: 1,
      max_views: 10,
    });
    assert.strictEqual(pasteB.status, 201);
    const slugB = pasteB.data.slug;

    await new Promise((r) => setTimeout(r, 1300));
    const resB = await apiRequest('GET', `/api/pastes/${slugB}`);
    assert.strictEqual(resB.status, 404);
    assert.strictEqual(resB.data.reason, 'expired');
  });

  test('Test 8: Invalid input validation', async () => {
    // Invalid TTL (negative)
    const res1 = await apiRequest('POST', '/api/pastes', {
      content: 'Test content',
      ttl_seconds: -10,
    });
    assert.strictEqual(res1.status, 400);

    // Invalid TTL (float)
    const res2 = await apiRequest('POST', '/api/pastes', {
      content: 'Test content',
      ttl_seconds: 12.5,
    });
    assert.strictEqual(res2.status, 400);

    // Invalid max_views (0)
    const res3 = await apiRequest('POST', '/api/pastes', {
      content: 'Test content',
      max_views: 0,
    });
    assert.strictEqual(res3.status, 400);

    // Invalid content type (number)
    const res4 = await apiRequest('POST', '/api/pastes', {
      content: 12345,
    });
    assert.strictEqual(res4.status, 400);
  });

  test('Test 9: Empty content validation', async () => {
    // Missing content
    const res1 = await apiRequest('POST', '/api/pastes', {});
    assert.strictEqual(res1.status, 400);

    // Empty string
    const res2 = await apiRequest('POST', '/api/pastes', { content: '' });
    assert.strictEqual(res2.status, 400);

    // Whitespace only
    const res3 = await apiRequest('POST', '/api/pastes', { content: '   \n \t  ' });
    assert.strictEqual(res3.status, 400);
  });

  test('Test 10: View count incrementing accurately', async () => {
    const createRes = await apiRequest('POST', '/api/pastes', {
      content: 'Testing sequential view increments',
      max_views: 10,
    });
    const slug = createRes.data.slug;

    for (let expectedCount = 1; expectedCount <= 5; expectedCount++) {
      const getRes = await apiRequest('GET', `/api/pastes/${slug}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.data.view_count, expectedCount);
      assert.strictEqual(getRes.data.remaining_views, 10 - expectedCount);
    }
  });

  test('Test 11: Multiple concurrent requests race condition handling', async () => {
    // Create a paste that allows exactly 5 views
    const maxViews = 5;
    const createRes = await apiRequest('POST', '/api/pastes', {
      content: 'High concurrency race condition test',
      max_views: maxViews,
    });
    const slug = createRes.data.slug;

    // Send 15 concurrent requests simultaneously
    const totalRequests = 15;
    const promises = Array.from({ length: totalRequests }, () =>
      apiRequest('GET', `/api/pastes/${slug}`)
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 200);
    const notFounds = results.filter((r) => r.status === 404);

    // Exactly 5 requests must have succeeded
    assert.strictEqual(
      successes.length,
      maxViews,
      `Expected exactly ${maxViews} successful responses, got ${successes.length}`
    );

    // Exactly 10 requests must have received 404
    assert.strictEqual(
      notFounds.length,
      totalRequests - maxViews,
      `Expected ${totalRequests - maxViews} 404 responses, got ${notFounds.length}`
    );

    // Verify in database directly that view_count is exactly 5
    const dbRes = await pool.query('SELECT view_count FROM pastes WHERE slug = $1', [slug]);
    assert.strictEqual(dbRes.rows[0].view_count, maxViews);
  });

  test('Test 12: Database persistence in PostgreSQL', async () => {
    // Directly insert and read via pool to verify persistence
    const testContent = 'Persistent text in PostgreSQL instance: ' + Date.now();
    const paste = await createPaste({
      content: testContent,
      ttlSeconds: 86400,
      maxViews: 100,
    });

    assert.ok(paste.id);
    assert.ok(paste.slug);

    // Query directly from PostgreSQL database table using an independent raw query
    const checkResult = await pool.query(
      'SELECT id, slug, content, created_at, expires_at, max_views, view_count FROM pastes WHERE id = $1',
      [paste.id]
    );

    assert.strictEqual(checkResult.rows.length, 1);
    const row = checkResult.rows[0];
    assert.strictEqual(row.slug, paste.slug);
    assert.strictEqual(row.content, testContent);
    assert.strictEqual(row.view_count, 0);
    assert.strictEqual(row.max_views, 100);
  });
});
