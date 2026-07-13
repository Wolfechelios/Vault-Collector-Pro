PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  query TEXT NOT NULL,
  median_minor INTEGER NOT NULL,
  weighted_median_minor INTEGER NOT NULL,
  low_minor INTEGER NOT NULL,
  high_minor INTEGER NOT NULL,
  sample_count INTEGER NOT NULL,
  confidence REAL NOT NULL,
  providers_json TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_item_time ON valuation_snapshots(item_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS sale_comparables (
  id TEXT PRIMARY KEY,
  valuation_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_item_id TEXT,
  title TEXT NOT NULL,
  sold_amount_minor INTEGER NOT NULL,
  shipping_minor INTEGER NOT NULL DEFAULT 0,
  sold_at TEXT,
  condition_text TEXT,
  source_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  included INTEGER NOT NULL DEFAULT 1,
  exclusion_reason TEXT,
  match_score REAL,
  raw_json TEXT,
  FOREIGN KEY(valuation_id) REFERENCES valuation_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sale_comparables_valuation ON sale_comparables(valuation_id);
CREATE INDEX IF NOT EXISTS idx_sale_comparables_provider_sold ON sale_comparables(provider, sold_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_drafts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_minor INTEGER NOT NULL,
  minimum_price_minor INTEGER NOT NULL,
  condition_text TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  photos_json TEXT NOT NULL,
  specifics_json TEXT NOT NULL,
  shipping_json TEXT NOT NULL,
  completeness INTEGER NOT NULL,
  missing_fields_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_drafts_item ON marketplace_drafts(item_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_drafts_status ON marketplace_drafts(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS pricing_providers (
  provider TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  health TEXT NOT NULL DEFAULT 'credentials-required',
  last_success_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  threshold_percent REAL NOT NULL,
  baseline_minor INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_item_enabled ON price_alerts(item_id, enabled);
