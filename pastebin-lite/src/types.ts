export interface Paste {
  id: number;
  slug: string;
  content: string;
  created_at: string;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  remaining_views?: number | null;
  url?: string;
  ttl_seconds?: number | null;
}

export interface CreatePasteInput {
  content: string;
  ttl_seconds?: number | null;
  max_views?: number | null;
}

export interface ApiHealthResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected' | 'error';
  latency_ms?: number;
  timestamp: string;
}

export interface StoredPasteMeta {
  slug: string;
  url: string;
  snippet: string;
  created_at: string;
  expires_at: string | null;
  max_views: number | null;
}
