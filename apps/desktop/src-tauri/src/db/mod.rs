pub mod items;
pub mod intelligence;
pub mod models;

use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use std::time::Duration;
use thiserror::Error;

const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial.sql");
const PLATFORM_SCHEMA: &str = include_str!("../../migrations/0002_platform.sql");
const CAPTURE_SCHEMA: &str = include_str!("../../migrations/0003_capture_intelligence.sql");
const VALUATION_MARKETPLACE_SCHEMA: &str = include_str!("../../migrations/0004_valuation_marketplace.sql");
const INVENTORY_INTELLIGENCE_SCHEMA: &str = include_str!("../../migrations/0005_inventory_intelligence.sql");
const MOBILE_INTELLIGENCE_SCHEMA: &str = include_str!("../../migrations/0006_mobile_intelligence.sql");

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("item not found: {0}")]
    NotFound(String),
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn open_database(path: &Path) -> Result<Connection, DatabaseError> {
    if path != Path::new(":memory:") {
        if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    }
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE)?;
    connection.busy_timeout(Duration::from_secs(2))?;
    if path != Path::new(":memory:") { connection.pragma_update(None, "journal_mode", "WAL")?; }
    connection.execute_batch(INITIAL_SCHEMA)?;
    connection.execute_batch(PLATFORM_SCHEMA)?;
    connection.execute_batch(CAPTURE_SCHEMA)?;
    connection.execute_batch(VALUATION_MARKETPLACE_SCHEMA)?;
    connection.execute_batch(INVENTORY_INTELLIGENCE_SCHEMA)?;
    connection.execute_batch(MOBILE_INTELLIGENCE_SCHEMA)?;
    Ok(connection)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn table_exists(connection: &Connection, name: &str) -> i64 {
        connection.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1", [name], |row| row.get(0)).unwrap()
    }
    #[test]
    fn migration_creates_core_tables() {
        let connection = open_database(Path::new(":memory:")).expect("database should initialize");
        assert_eq!(table_exists(&connection, "items"), 1);
        assert_eq!(table_exists(&connection, "activity_log"), 1);
    }
    #[test]
    fn migration_creates_capture_intelligence_tables() {
        let connection = open_database(Path::new(":memory:")).expect("database should initialize");
        for table in ["capture_jobs", "item_photos", "paired_devices", "capture_sessions", "duplicate_matches"] {
            assert_eq!(table_exists(&connection, table), 1, "missing table {table}");
        }
    }
    #[test]
    fn migration_creates_valuation_marketplace_tables() {
        let connection = open_database(Path::new(":memory:")).expect("database should initialize");
        for table in ["valuation_snapshots", "sale_comparables", "marketplace_drafts", "pricing_providers", "price_alerts"] {
            assert_eq!(table_exists(&connection, table), 1, "missing table {table}");
        }
    }
    #[test]
    fn migration_creates_integrated_intelligence_tables_and_fts() {
        let connection = open_database(Path::new(":memory:")).expect("database should initialize");
        for table in [
            "scan_evidence", "field_suggestions", "item_field_state",
            "category_field_definitions", "correction_rules", "learning_events",
            "search_documents", "search_documents_fts", "search_reindex_queue",
            "saved_searches", "search_history"
        ] {
            assert_eq!(table_exists(&connection, table), 1, "missing table {table}");
        }
        assert_eq!(table_exists(&connection, "vault_identity"), 1);
        assert_eq!(table_exists(&connection, "applied_mobile_changes"), 1);
        connection.execute(
            "INSERT INTO search_documents_fts(item_id,title,description,ocr_text,identifiers,notes,specifics,category,condition_text,location) VALUES(?1,?2,'','','','','','','','')",
            ("item-1", "Yellow DeWalt drill"),
        ).expect("fts insert should work");
        let count: i64 = connection.query_row(
            "SELECT count(*) FROM search_documents_fts WHERE search_documents_fts MATCH 'DeWalt'",
            [],
            |row| row.get(0),
        ).expect("fts query should work");
        assert_eq!(count, 1);
    }
    #[test]
    fn intelligence_migration_is_idempotent() {
        let connection = open_database(Path::new(":memory:")).expect("database should initialize");
        connection.execute_batch(INVENTORY_INTELLIGENCE_SCHEMA).expect("migration should safely re-run");
        assert_eq!(table_exists(&connection, "field_suggestions"), 1);
    }
}
