PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capture_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  item_id TEXT,
  photo_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  payload_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_capture_jobs_status_created ON capture_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_capture_jobs_item ON capture_jobs(item_id);

CREATE TABLE IF NOT EXISTS item_photos (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  original_name TEXT NOT NULL,
  local_path TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  quality_score INTEGER,
  quality_json TEXT,
  perceptual_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_item_photos_item ON item_photos(item_id, is_primary DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_item_photos_hash ON item_photos(perceptual_hash);

CREATE TABLE IF NOT EXISTS paired_devices (
  id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  paired_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS capture_sessions (
  id TEXT PRIMARY KEY,
  paired_device_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','syncing','completed','failed')),
  item_count INTEGER NOT NULL DEFAULT 0,
  photo_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(paired_device_id) REFERENCES paired_devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS duplicate_matches (
  id TEXT PRIMARY KEY,
  photo_a_id TEXT NOT NULL,
  photo_b_id TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','dismissed')),
  created_at TEXT NOT NULL,
  UNIQUE(photo_a_id, photo_b_id),
  FOREIGN KEY(photo_a_id) REFERENCES item_photos(id) ON DELETE CASCADE,
  FOREIGN KEY(photo_b_id) REFERENCES item_photos(id) ON DELETE CASCADE
);