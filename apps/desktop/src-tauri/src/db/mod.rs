pub mod items;
pub mod models;

use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use thiserror::Error;

const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial.sql");
const PLATFORM_SCHEMA: &str = include_str!("../../migrations/0002_platform.sql");
const CAPTURE_SCHEMA: &str = include_str!("../../migrations/0003_capture_intelligence.sql");
const VALUATION_MARKETPLACE_SCHEMA: &str = include_str!("../../migrations/0004_valuation_marketplace.sql");
const STORAGE_PRICING_SCHEMA: &str = include_str!("../../migrations/0005_storage_pricing_adapters.sql");

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
}

pub fn open_database(path: &Path) -> Result<Connection, DatabaseError> {
    if path != Path::new(":memory:") {
        if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    }
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE)?;
    connection.execute_batch(INITIAL_SCHEMA)?;
    connection.execute_batch(PLATFORM_SCHEMA)?;
    connection.execute_batch(CAPTURE_SCHEMA)?;
    connection.execute_batch(VALUATION_MARKETPLACE_SCHEMA)?;
    connection.execute_batch(STORAGE_PRICING_SCHEMA)?;
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
    fn migration_creates_storage_and_pricing_adapter_tables() {
        let connection = open_database(Path::new(":memory:")).expect("database should initialize");
        for table in ["storage_nodes", "storage_node_closure", "storage_assignments", "storage_moves", "storage_labels", "pricing_provider_accounts", "pricing_provider_cache", "pricing_provider_requests", "pricing_refresh_jobs"] {
            assert_eq!(table_exists(&connection, table), 1, "missing table {table}");
        }
    }
}