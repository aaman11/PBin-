# Pastebin Lite - Aganitha Full Stack Take-Home (2026)

A production-ready, lightweight Pastebin web application built for the **Aganitha Full Stack Developer Take-Home Assignment (2026)**.

Pastebin Lite enables users to create text pastes, generate cryptographically secure shareable URLs, and retrieve stored content with optional **Time-to-Live (TTL)** expiration and **Atomic View Limit (Burn-after-reading)** enforcement backed by **PostgreSQL**.

---

## 🏗️ Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Client (Web UI / cURL / CLI)      │
                      └──────────────────┬───────────────────┘
                                         │ HTTP REST
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    Express & Node.js REST API        │
                      │    (POST, GET /api/pastes/:slug)     │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
  ┌──────────────────────────────┐              ┌──────────────────────────────┐
  │   PostgreSQL (Cloud SQL /    │              │   Client SPA (React 19,      │
  │   Neon PostgreSQL Database)  │              │   Tailwind CSS, Lucide)      │
  │   - Table: pastes            │              └──────────────────────────────┘
  │   - Atomic conditional view  │
  │     count increment          │
  └──────────────────────────────┘
```

### Key Architectural Decisions:
1. **Atomic Conditional View Counter**:
   - To eliminate race conditions under concurrent retrieval requests, view counting and expiration checks are executed in a single atomic SQL statement:
   ```sql
   UPDATE pastes
   SET view_count = view_count + 1
   WHERE slug = $1
     AND (expires_at IS NULL OR expires_at > NOW())
     AND (max_views IS NULL OR view_count < max_views)
   RETURNING id, slug, content, created_at, expires_at, max_views, view_count, creator_uid;
   ```
   - When 15 concurrent requests hit a paste with `max_views: 5`, PostgreSQL row-level locks guarantee that exactly 5 requests succeed (HTTP 200) and the remaining 10 fail (HTTP 404), with `view_count` never exceeding 5.

2. **UTC-Based Expiration**:
   - All expiration calculations (`expires_at = NOW() + ttl_seconds * INTERVAL '1 second'`) are strictly stored and compared in UTC timestamps.
   - Pastes without TTL never expire based on time (`expires_at IS NULL`).

3. **Combined Expiration Rules**:
   - If both TTL and Max Views are specified, whichever condition is satisfied first permanently renders the paste unavailable with HTTP 404.

4. **Cryptographically Secure Slugs**:
   - Slugs are generated via Node.js `crypto.randomBytes` using URL-safe base64 encoding (e.g. `xK9_mQ2a`), with automated collision retry logic.

---

## 🗄️ Database Design

### `pastes` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Internal integer ID |
| `slug` | `TEXT` | `NOT NULL, UNIQUE` | 8-character public shareable identifier |
| `content` | `TEXT` | `NOT NULL` | The stored plain text content |
| `created_at` | `TIMESTAMP` | `NOT NULL, DEFAULT NOW()` | Creation timestamp in UTC |
| `expires_at` | `TIMESTAMP` | `NULLABLE` | Expiration timestamp in UTC |
| `max_views` | `INTEGER` | `NULLABLE` | Maximum allowed views before self-destruction |
| `view_count` | `INTEGER` | `NOT NULL, DEFAULT 0` | Current number of views consumed |
| `creator_uid`| `TEXT` | `NULLABLE` | Optional Firebase Auth UID |

### Database Indexes
- `CREATE INDEX "slug_idx" ON "pastes" ("slug");`
- `CREATE INDEX "expires_at_idx" ON "pastes" ("expires_at");`

---

## 📡 REST API Reference

### 1. Create Paste
`POST /api/pastes`

**Request Body:**
```json
{
  "content": "Hello World",
  "ttl_seconds": 3600,
  "max_views": 5
}
```

**Validation Rules:**
- `content`: Required, non-empty string. (Returns `400 Bad Request` if missing or whitespace-only).
- `ttl_seconds`: Optional. If provided, must be a positive integer > 0.
- `max_views`: Optional. If provided, must be an integer >= 1.

**Response (`201 Created`):**
```json
{
  "id": 1,
  "slug": "7aB_9K1x",
  "url": "https://your-domain.com/p/7aB_9K1x",
  "content": "Hello World",
  "created_at": "2026-11-08T21:40:00.000Z",
  "expires_at": "2026-11-08T22:40:00.000Z",
  "max_views": 5,
  "view_count": 0,
  "ttl_seconds": 3600
}
```

---

### 2. Retrieve Paste
`GET /api/pastes/:slug`

**Response (`200 OK`):**
```json
{
  "id": 1,
  "slug": "7aB_9K1x",
  "content": "Hello World",
  "created_at": "2026-11-08T21:40:00.000Z",
  "expires_at": "2026-11-08T22:40:00.000Z",
  "max_views": 5,
  "view_count": 1,
  "remaining_views": 4
}
```

**Unavailable / Expired (`404 Not Found`):**
```json
{
  "error": "This paste has reached its maximum view limit and is no longer available.",
  "reason": "view_limit_exceeded"
}
```

---

### 3. Raw Text Content (for CLI & cURL)
`GET /api/pastes/:slug/raw`

Returns content as `text/plain; charset=utf-8`.

```bash
curl -s https://your-domain.com/api/pastes/7aB_9K1x/raw
```

---

### 4. Health Check
`GET /api/health`

**Response (`200 OK`):**
```json
{
  "status": "healthy",
  "database": "connected",
  "latency_ms": 8,
  "timestamp": "2026-11-08T21:40:00.000Z"
}
```

---

## 🧪 Automated Test Suite

The test suite covers all 12 core requirements specified in the take-home prompt:

1. **Creating a paste successfully** (validates fields, slug, URL, and expiration calculation)
2. **Retrieving an existing paste** (validates content preservation and view increment)
3. **Retrieving a nonexistent paste** (validates 404 and error body)
4. **Creating a paste with no expiration** (validates persistence across multiple views)
5. **TTL expiration** (verifies paste becomes 404 once time elapses)
6. **Maximum view expiration** (verifies paste becomes 404 after exact max views consumed)
7. **Combined TTL and view expiration** (verifies whichever threshold occurs first triggers 404)
8. **Invalid input validation** (rejects negative TTL, non-integer max_views, invalid types)
9. **Empty content validation** (rejects empty string, whitespace only, and missing content)
10. **View count incrementing accurately** (checks exact sequential counts and remaining views)
11. **Multiple concurrent requests** (issues 15 simultaneous requests against a 5-view paste and guarantees exactly 5 succeed and 10 fail)
12. **Database persistence in PostgreSQL** (verifies data survives process isolation and is stored in PostgreSQL)

### Running Tests:
```bash
npm test
```

---

## 🚀 Deployment Instructions

### Option 1: AI Studio / Google Cloud (Active)
- The app is running with Cloud SQL PostgreSQL and Express/Vite in this deployment.
- Database credentials and connection pooling are managed automatically.

### Option 2: Deploying to Vercel with Neon PostgreSQL
1. Create a free PostgreSQL instance on [Neon](https://neon.tech).
2. Copy your Neon connection string: `postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`.
3. Set environment variables on Vercel:
   ```env
   DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"
   NEXT_PUBLIC_BASE_URL="https://your-app.vercel.app"
   ```
4. Run schema migration on Neon:
   ```bash
   npx drizzle-kit push
   ```
5. Deploy to Vercel via Git:
   ```bash
   vercel --prod
   ```

---

## 🛠️ Project Structure
```
├── src/
│   ├── components/
│   │   ├── ApiDocsModal.tsx     # Interactive API explorer for evaluators
│   │   ├── CreatePasteView.tsx  # Main paste creation view with TTL & view presets
│   │   ├── Header.tsx           # Navbar, DB health status badge, theme toggle
│   │   ├── RecentPastes.tsx     # History of created pastes in current session
│   │   └── ViewPasteView.tsx    # Content viewer with whitespace formatting & 404 handling
│   ├── db/
│   │   ├── drizzle.config.ts    # Drizzle Kit migration configuration
│   │   ├── index.ts             # Connection pool (supports Cloud SQL & Neon DATABASE_URL)
│   │   ├── pastes.ts            # Atomic SQL operations and database repository
│   │   ├── schema.ts            # Drizzle PostgreSQL schema definitions
│   │   └── users.ts             # User profiles upsert logic
│   ├── lib/
│   │   ├── firebase.ts          # Firebase Client Auth
│   │   ├── firebase-admin.ts    # Firebase Admin SDK
│   │   └── utils.ts             # Date, formatting, and clipboard utilities
│   ├── App.tsx                  # Main client application & router
│   ├── index.css                # Tailwind CSS v4 styling & dark theme
│   ├── main.tsx                 # React entry point
│   └── types.ts                 # TypeScript data contracts
├── tests/
│   └── pastebin.test.ts         # Automated test suite (13 passing tests)
├── server.ts                    # Full-stack Express REST API server & Vite middleware
├── package.json                 # Dependencies and scripts
└── tsconfig.json                # TypeScript compiler configuration
```
