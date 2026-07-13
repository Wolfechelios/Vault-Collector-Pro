PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  status TEXT NOT NULL DEFAULT 'private' CHECK(status IN ('private','draft','listed','sold','archived')),
  condition TEXT NOT NULL,
  condition_notes TEXT,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  sku TEXT UNIQUE,
  serial_number TEXT,
  brand TEXT,
  model TEXT,
  year INTEGER,
  edition TEXT,
  purchase_amount_minor INTEGER,
  purchase_currency TEXT,
  median_amount_minor INTEGER,
  median_currency TEXT,
  suggested_amount_minor INTEGER,
  suggested_currency TEXT,
  minimum_amount_minor INTEGER,
  minimum_currency TEXT,
  storage_location_id TEXT,
  acquired_at TEXT,
  sold_at TEXT,
  sold_amount_minor INTEGER,
  sold_currency TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY(storage_location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS item_specifics (
  item_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(item_id, key),
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  original_path TEXT NOT NULL,
  thumbnail_path TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_media (
  item_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY(item_id, media_id),
  UNIQUE(item_id, position),
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('property','room','shelf','box','bin','vehicle','other')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(parent_id) REFERENCES locations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS valuations (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  low_minor INTEGER,
  high_minor INTEGER,
  sample_count INTEGER NOT NULL,
  match_confidence REAL NOT NULL,
  valuation_confidence REAL NOT NULL,
  source_summary_json TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comparables (
  id TEXT PRIMARY KEY NOT NULL,
  valuation_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  sold_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  sold_at TEXT,
  url TEXT,
  included INTEGER NOT NULL CHECK(included IN (0,1)),
  exclusion_reason TEXT,
  normalized_json TEXT NOT NULL,
  FOREIGN KEY(valuation_id) REFERENCES valuations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ocr_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT,
  media_id TEXT,
  field_name TEXT,
  proposed_value TEXT,
  raw_text TEXT NOT NULL,
  confidence REAL NOT NULL,
  bounds_json TEXT,
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS item_search USING fts5(
  item_id UNINDEXED,
  title,
  description,
  notes,
  sku,
  serial_number,
  brand,
  model,
  ocr_text,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO item_search(item_id,title,description,notes,sku,serial_number,brand,model,ocr_text)
  VALUES(new.id,new.title,coalesce(new.description,''),coalesce(new.notes,''),coalesce(new.sku,''),coalesce(new.serial_number,''),coalesce(new.brand,''),coalesce(new.model,''),'');
END;

CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
  DELETE FROM item_search WHERE item_id = old.id;
  INSERT INTO item_search(item_id,title,description,notes,sku,serial_number,brand,model,ocr_text)
  VALUES(new.id,new.title,coalesce(new.description,''),coalesce(new.notes,''),coalesce(new.sku,''),coalesce(new.serial_number,''),coalesce(new.brand,''),coalesce(new.model,''),'');
END;

CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  DELETE FROM item_search WHERE item_id = old.id;
END;
