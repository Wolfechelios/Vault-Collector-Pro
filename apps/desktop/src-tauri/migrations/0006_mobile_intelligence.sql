PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS vault_identity (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  vault_id TEXT NOT NULL,
  intelligence_revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO vault_identity(singleton,vault_id,intelligence_revision,updated_at)
VALUES(1,lower(hex(randomblob(16))),1,datetime('now'));
CREATE TABLE IF NOT EXISTS applied_mobile_changes (
  change_id TEXT PRIMARY KEY,
  bundle_checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
COMMIT;
