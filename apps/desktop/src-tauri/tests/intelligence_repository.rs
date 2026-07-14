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
