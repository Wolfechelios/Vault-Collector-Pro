use std::collections::BTreeMap;
use vault_catalogue_lib::db::{
    intelligence::{
        CorrectionRuleRecord, IntelligenceRepository, IntelligentSearchRequest,
        NewEvidence, NewSuggestion, SearchRepository, SuggestionDecision,
    },
    items::ItemRepository,
    models::ItemDraft,
    open_database,
};
use vault_catalogue_lib::background::BackgroundIndexer;

fn draft() -> ItemDraft {
    ItemDraft {
        id: None,
        title: "Yellow DeWalt drill".into(),
        category: "tools".into(),
        subcategory: None,
        status: Some("private".into()),
        condition: "Used - Good".into(),
        condition_notes: None,
        description: Some("Cordless hammer drill".into()),
        quantity: Some(1),
        sku: None,
        serial_number: Some("ABC123".into()),
        brand: Some("DeWalt".into()),
        model: Some("DCF887".into()),
        year: Some(2021),
        edition: Some("XR".into()),
        purchase_price: None,
        median_value: None,
        suggested_price: None,
        minimum_price: None,
        storage_location_id: None,
        acquired_at: None,
        notes: Some("Garage tool".into()),
        specifics: BTreeMap::from([
            ("color".into(), "Yellow".into()),
            ("storagePath".into(), "Garage / Shelf B".into()),
        ]),
    }
}

#[test]
fn persists_traceable_evidence_and_protects_user_fields() {
    let mut connection = open_database(std::path::Path::new(":memory:")).unwrap();
    let item = ItemRepository::create(&mut connection, draft()).unwrap();
    let initial_state = IntelligenceRepository::get_field_state(&connection, &item.id).unwrap();
    assert!(initial_state.iter().any(|row| {
        row.field_name == "model" && row.value == "DCF887" && row.protected
    }));
    IntelligenceRepository::record_evidence(
        &connection,
        NewEvidence {
            id: "e1".into(),
            scan_id: "scan-1".into(),
            item_id: Some(item.id.clone()),
            field_name: "model".into(),
            value: "DCD996".into(),
            normalized_value: "DCD996".into(),
            confidence: 0.99,
            source_kind: "ocr".into(),
            source_media_id: Some("photo-1".into()),
            raw_text: Some("MODEL DCD996".into()),
            bounds_json: None,
            provider: Some("Vault Vision parser".into()),
            created_at: "2026-07-14T12:00:00.000Z".into(),
        },
    ).unwrap();
    IntelligenceRepository::save_suggestion(
        &connection,
        NewSuggestion {
            id: "s1".into(),
            item_id: item.id.clone(),
            field_name: "model".into(),
            proposed_value: "DCD996".into(),
            confidence: 0.99,
            disposition: "review".into(),
            evidence_ids: vec!["e1".into()],
            conflicting_evidence_ids: vec![],
            influenced_rule_ids: vec![],
            verification_state: "unverified".into(),
            status: "pending".into(),
            protected_value: Some("DCF887".into()),
            created_at: "2026-07-14T12:00:01.000Z".into(),
        },
    ).unwrap();

    let automatic = IntelligenceRepository::decide_suggestion(
        &mut connection,
        "s1",
        SuggestionDecision { action: "automatic".into(), value: None },
    );
    assert!(automatic.unwrap_err().to_string().contains("protected"));

    IntelligenceRepository::decide_suggestion(
        &mut connection,
        "s1",
        SuggestionDecision { action: "edit".into(), value: Some("DCD996B".into()) },
    ).unwrap();
    let updated = ItemRepository::get(&connection, &item.id).unwrap().unwrap();
    assert_eq!(updated.model.as_deref(), Some("DCD996B"));
    let state = IntelligenceRepository::get_field_state(&connection, &item.id).unwrap();
    assert!(state.iter().any(|row| row.field_name == "model" && row.protected));
}

#[test]
fn persists_rules_and_searches_fts_specifics_offline() {
    let mut connection = open_database(std::path::Path::new(":memory:")).unwrap();
    let item = ItemRepository::create(&mut connection, draft()).unwrap();
    IntelligenceRepository::upsert_rule(
        &connection,
        CorrectionRuleRecord {
            id: "rule-1".into(),
            rule_kind: "alias".into(),
            conditions_json: r#"{"field":"brand","value":"DEW ALT"}"#.into(),
            action_json: r#"{"value":"DeWalt"}"#.into(),
            priority: 100,
            evidence_count: 2,
            enabled: true,
            explanation: "Replace DEW ALT with DeWalt".into(),
            created_at: "2026-07-14T12:00:00.000Z".into(),
            updated_at: "2026-07-14T12:00:00.000Z".into(),
        },
    ).unwrap();
    assert_eq!(IntelligenceRepository::list_rules(&connection).unwrap().len(), 1);

    assert_eq!(SearchRepository::process_reindex_queue(&mut connection, 100).unwrap(), 1);
    let ids = SearchRepository::search_ids(
        &connection,
        IntelligentSearchRequest {
            fts_query: "DeWalt".into(),
            category: Some("tools".into()),
            color: Some("yellow".into()),
            brand: Some("DeWalt".into()),
            year_operator: None,
            year_value: None,
            value_operator: None,
            value_minor: None,
            quantity_operator: None,
            quantity_value: None,
            status: None,
            condition: None,
            location: Some("Garage Shelf B".into()),
            listed: Some(false),
            missing_photos: None,
            review_needed: None,
            unpriced: None,
            unassigned: None,
            duplicate: None,
            limit: Some(100),
        },
    ).unwrap();
    assert_eq!(ids, vec![item.id]);

    SearchRepository::save_search(&connection, "saved-1", "Garage drills", "yellow DeWalt drill", "{}", false).unwrap();
    SearchRepository::record_search_history(&connection, "history-1", "yellow DeWalt drill", "{}", 1).unwrap();
    let saved_rows = SearchRepository::list_saved_searches(&connection).unwrap();
    assert_eq!(saved_rows[0].query_text, "yellow DeWalt drill");
    assert_eq!(saved_rows[0].parsed_query_json, "{}");
    let saved: i64 = connection.query_row("SELECT count(*) FROM saved_searches", [], |row| row.get(0)).unwrap();
    let history: i64 = connection.query_row("SELECT count(*) FROM search_history", [], |row| row.get(0)).unwrap();
    assert_eq!((saved, history), (1, 1));
}

#[test]
fn leaves_deferred_inference_fields_unprotected_until_analysis_is_recorded() {
    let mut connection = open_database(std::path::Path::new(":memory:")).unwrap();
    let mut inferred = draft();
    inferred.specifics.insert(
        "__inferredFields".into(),
        r#"["brand","model"]"#.into(),
    );
    let item = ItemRepository::create(&mut connection, inferred).unwrap();
    let state = IntelligenceRepository::get_field_state(&connection, &item.id).unwrap();
    assert!(!state.iter().any(|row| row.field_name == "brand"));
    assert!(!state.iter().any(|row| row.field_name == "model"));
    assert!(!item.specifics.contains_key("__inferredFields"));
}

#[test]
fn storage_rules_fill_only_unassigned_items_and_keep_attribution() {
    let mut connection = open_database(std::path::Path::new(":memory:")).unwrap();
    let mut unassigned = draft();
    unassigned.specifics.remove("storagePath");
    let item = ItemRepository::create(&mut connection, unassigned).unwrap();
    IntelligenceRepository::upsert_rule(&connection, CorrectionRuleRecord {
        id: "storage-tools".into(), rule_kind: "storage".into(),
        conditions_json: r#"{"field":"storagePath","category":"tools"}"#.into(),
        action_json: r#"{"value":"Garage / Shelf B"}"#.into(), priority: 100,
        evidence_count: 2, enabled: true, explanation: "Store tools on Shelf B".into(),
        created_at: "2026-07-14T12:00:00.000Z".into(), updated_at: "2026-07-14T12:00:00.000Z".into(),
    }).unwrap();

    assert_eq!(IntelligenceRepository::apply_storage_rules(&mut connection).unwrap(), 1);
    let updated = ItemRepository::get(&connection, &item.id).unwrap().unwrap();
    assert_eq!(updated.specifics.get("storagePath").map(String::as_str), Some("Garage / Shelf B"));
    let state = IntelligenceRepository::get_field_state(&connection, &item.id).unwrap();
    assert!(state.iter().any(|row| row.field_name == "storagePath" && !row.protected && row.verification_state == "flagged"));
    let influenced: String = connection.query_row(
        "SELECT influenced_rule_ids_json FROM field_suggestions WHERE item_id=?1 AND field_name='storagePath'",
        [&item.id], |row| row.get(0),
    ).unwrap();
    assert_eq!(influenced, r#"["storage-tools"]"#);
}

#[test]
fn rejects_invalid_rule_shapes_without_replacing_the_saved_rule() {
    let connection = open_database(std::path::Path::new(":memory:")).unwrap();
    let valid = CorrectionRuleRecord {
        id: "storage-tools".into(), rule_kind: "storage".into(),
        conditions_json: r#"{"field":"storagePath","category":"tools"}"#.into(),
        action_json: r#"{"value":"Garage / Shelf B"}"#.into(), priority: 100,
        evidence_count: 2, enabled: true, explanation: "Store tools on Shelf B".into(),
        created_at: "2026-07-14T12:00:00.000Z".into(), updated_at: "2026-07-14T12:00:00.000Z".into(),
    };
    IntelligenceRepository::upsert_rule(&connection, valid.clone()).unwrap();
    let mut invalid = valid;
    invalid.conditions_json = r#"{"field":"brand"}"#.into();
    invalid.action_json = r#"{"value":""}"#.into();
    assert!(IntelligenceRepository::upsert_rule(&connection, invalid).is_err());
    assert_eq!(IntelligenceRepository::list_rules(&connection).unwrap()[0].action_json, r#"{"value":"Garage / Shelf B"}"#);
}

#[test]
fn background_indexer_drains_the_durable_queue_without_a_search_command() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("background-index.sqlite3");
    let mut connection = open_database(&path).unwrap();
    let item = ItemRepository::create(&mut connection, draft()).unwrap();
    drop(connection);

    let indexer = BackgroundIndexer::start(path.clone());
    indexer.notify();
    let mut indexed = false;
    for _ in 0..50 {
        let connection = open_database(&path).unwrap();
        indexed = connection.query_row(
            "SELECT count(*) FROM search_documents WHERE item_id=?1", [&item.id], |row| row.get::<_,i64>(0),
        ).unwrap() == 1;
        if indexed { break; }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    assert!(indexed, "background worker did not drain the reindex queue");
}

#[test]
fn exports_versioned_mobile_snapshot_and_rejects_tampered_changes_atomically() {
    let mut connection = open_database(std::path::Path::new(":memory:")).unwrap();
    ItemRepository::create(&mut connection, draft()).unwrap();
    let snapshot = IntelligenceRepository::export_intelligence_snapshot(&connection).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&snapshot).unwrap();
    assert_eq!(parsed["format"], "vault-intelligence-snapshot");
    assert_eq!(parsed["version"], 1);
    assert_eq!(parsed["payload"]["items"].as_array().unwrap().len(), 1);
    assert_eq!(parsed["checksum"].as_str().unwrap().len(), 64);

    let vault_id = parsed["vaultId"].as_str().unwrap();
    let tampered = serde_json::json!({
        "format":"vault-mobile-changes","version":1,"vaultId":vault_id,"baseRevision":1,
        "createdAt":"2026-07-14T00:00:00Z","changes":[],"checksum":"invalid"
    }).to_string();
    assert!(IntelligenceRepository::import_mobile_changes(&mut connection, &tampered).unwrap_err().to_string().contains("checksum"));
    let revision: i64 = connection.query_row("SELECT intelligence_revision FROM vault_identity WHERE singleton=1", [], |row| row.get(0)).unwrap();
    assert_eq!(revision, 1);
}
