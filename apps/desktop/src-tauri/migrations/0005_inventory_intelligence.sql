PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS scan_evidence (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  item_id TEXT,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence BETWEEN 0.0 AND 1.0),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('ocr','barcode','logo','object','metadata','user','learned-rule')),
  source_media_id TEXT,
  raw_text TEXT,
  bounds_json TEXT,
  provider TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scan_evidence_item_field ON scan_evidence(item_id, field_name, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_scan_evidence_scan ON scan_evidence(scan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scan_evidence_media ON scan_evidence(source_media_id);

CREATE TABLE IF NOT EXISTS field_suggestions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence BETWEEN 0.0 AND 1.0),
  disposition TEXT NOT NULL CHECK(disposition IN ('auto-applied','flagged','review')),
  evidence_ids_json TEXT NOT NULL,
  conflicting_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  influenced_rule_ids_json TEXT NOT NULL DEFAULT '[]',
  verification_state TEXT NOT NULL CHECK(verification_state IN ('unverified','flagged','verified','rejected')),
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','edited','rejected','applied')),
  protected_value TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_field_suggestions_review ON field_suggestions(status, verification_state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_suggestions_item_field ON field_suggestions(item_id, field_name, created_at DESC);

CREATE TABLE IF NOT EXISTS item_field_state (
  item_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('user','inference','import')),
  protected INTEGER NOT NULL DEFAULT 0 CHECK(protected IN (0,1)),
  verification_state TEXT NOT NULL CHECK(verification_state IN ('unverified','flagged','verified','rejected')),
  confidence REAL CHECK(confidence BETWEEN 0.0 AND 1.0),
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  suggestion_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(item_id, field_name),
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY(suggestion_id) REFERENCES field_suggestions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_item_field_state_review ON item_field_state(verification_state, protected);

-- Inventory created before this migration is presumed user-authored/imported and
-- therefore protected before any inference can run against it.
INSERT OR IGNORE INTO item_field_state(
  item_id, field_name, value, source, protected, verification_state,
  confidence, evidence_ids_json, suggestion_id, updated_at
)
SELECT id, field_name, value, 'import', 1, 'verified', NULL, '[]', NULL, updated_at
FROM (
  SELECT id, 'title' AS field_name, title AS value, updated_at FROM items
  UNION ALL SELECT id, 'category', category, updated_at FROM items
  UNION ALL SELECT id, 'condition', condition, updated_at FROM items
  UNION ALL SELECT id, 'brand', brand, updated_at FROM items WHERE brand IS NOT NULL AND trim(brand) <> ''
  UNION ALL SELECT id, 'model', model, updated_at FROM items WHERE model IS NOT NULL AND trim(model) <> ''
  UNION ALL SELECT id, 'serialNumber', serial_number, updated_at FROM items WHERE serial_number IS NOT NULL AND trim(serial_number) <> ''
  UNION ALL SELECT id, 'sku', sku, updated_at FROM items WHERE sku IS NOT NULL AND trim(sku) <> ''
  UNION ALL SELECT id, 'year', cast(year AS TEXT), updated_at FROM items WHERE year IS NOT NULL
  UNION ALL SELECT id, 'edition', edition, updated_at FROM items WHERE edition IS NOT NULL AND trim(edition) <> ''
)
WHERE trim(value) <> '';

INSERT OR IGNORE INTO item_field_state(
  item_id, field_name, value, source, protected, verification_state,
  confidence, evidence_ids_json, suggestion_id, updated_at
)
SELECT s.item_id, s.key, s.value, 'import', 1, 'verified', NULL, '[]', NULL, i.updated_at
FROM item_specifics s
JOIN items i ON i.id = s.item_id
WHERE trim(s.value) <> ''
  AND s.key NOT IN ('photos','photoMetadata','phoneCaptureId','capturedAt','__protectedFields','ocrText');

CREATE TABLE IF NOT EXISTS category_field_definitions (
  category TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
  searchable INTEGER NOT NULL DEFAULT 1 CHECK(searchable IN (0,1)),
  options_json TEXT NOT NULL DEFAULT '[]',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(category, field_key)
);

CREATE TABLE IF NOT EXISTS correction_rules (
  id TEXT PRIMARY KEY,
  rule_kind TEXT NOT NULL CHECK(rule_kind IN ('alias','category','storage','provider-route','title-format')),
  conditions_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_correction_rules_enabled_priority ON correction_rules(enabled, priority DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  suggestion_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accepted','edited','rejected')),
  proposed_value TEXT NOT NULL,
  final_value TEXT,
  category TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY(suggestion_id) REFERENCES field_suggestions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learning_events_pattern ON learning_events(field_name, proposed_value, final_value, decision);

CREATE TABLE IF NOT EXISTS search_documents (
  item_id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ocr_text TEXT NOT NULL DEFAULT '',
  identifiers TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  specifics TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  condition_text TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_documents_fts USING fts5(
  item_id UNINDEXED,
  title,
  description,
  ocr_text,
  identifiers,
  notes,
  specifics,
  category,
  condition_text,
  location,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS search_reindex_queue (
  item_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  query_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  parsed_query_json TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  searched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(searched_at DESC);

CREATE TRIGGER IF NOT EXISTS intelligence_items_ai AFTER INSERT ON items BEGIN
  INSERT INTO search_reindex_queue(item_id, reason, requested_at)
  VALUES(new.id, 'item-insert', new.updated_at)
  ON CONFLICT(item_id) DO UPDATE SET reason=excluded.reason, requested_at=excluded.requested_at;
END;

CREATE TRIGGER IF NOT EXISTS intelligence_items_au AFTER UPDATE ON items BEGIN
  INSERT INTO search_reindex_queue(item_id, reason, requested_at)
  VALUES(new.id, 'item-update', new.updated_at)
  ON CONFLICT(item_id) DO UPDATE SET reason=excluded.reason, requested_at=excluded.requested_at;
END;

CREATE TRIGGER IF NOT EXISTS intelligence_specifics_ai AFTER INSERT ON item_specifics BEGIN
  INSERT INTO search_reindex_queue(item_id, reason, requested_at)
  VALUES(new.item_id, 'specific-insert', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(item_id) DO UPDATE SET reason=excluded.reason, requested_at=excluded.requested_at;
END;

CREATE TRIGGER IF NOT EXISTS intelligence_specifics_au AFTER UPDATE ON item_specifics BEGIN
  INSERT INTO search_reindex_queue(item_id, reason, requested_at)
  VALUES(new.item_id, 'specific-update', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(item_id) DO UPDATE SET reason=excluded.reason, requested_at=excluded.requested_at;
END;

CREATE TRIGGER IF NOT EXISTS intelligence_specifics_ad AFTER DELETE ON item_specifics BEGIN
  INSERT INTO search_reindex_queue(item_id, reason, requested_at)
  VALUES(old.item_id, 'specific-delete', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(item_id) DO UPDATE SET reason=excluded.reason, requested_at=excluded.requested_at;
END;

CREATE TRIGGER IF NOT EXISTS intelligence_evidence_ai AFTER INSERT ON scan_evidence WHEN new.item_id IS NOT NULL BEGIN
  INSERT INTO search_reindex_queue(item_id, reason, requested_at)
  VALUES(new.item_id, 'evidence-insert', new.created_at)
  ON CONFLICT(item_id) DO UPDATE SET reason=excluded.reason, requested_at=excluded.requested_at;
END;

INSERT OR IGNORE INTO search_reindex_queue(item_id, reason, requested_at)
SELECT id, 'migration-backfill', updated_at FROM items;

COMMIT;
