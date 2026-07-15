use db::{
    intelligence::{
        CategorySchemaRecord, CorrectionRuleRecord, EvidenceRecord, FieldStateRecord, IntelligenceRepository,
        IntelligentSearchRequest, NewEvidence, NewSuggestion, SavedSearchRecord,
        SearchHistoryRecord, SearchRepository, SuggestionDecision, SuggestionRecord, MobileImportResult,
    },
    items::ItemRepository,
    models::{ItemDraft, ItemRecord, SearchRequest},
};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State};
use uuid::Uuid;

pub mod background;
pub mod db;
pub mod vision;

struct AppState { connection: Mutex<rusqlite::Connection>, indexer: background::BackgroundIndexer }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppHealth { app: &'static str, version: &'static str, database_ready: bool }

#[tauri::command]
fn app_health() -> AppHealth { AppHealth { app:"vault-catalogue", version:env!("CARGO_PKG_VERSION"), database_ready:true } }

#[tauri::command]
fn create_item(state: State<'_,AppState>, draft: ItemDraft) -> Result<ItemRecord,String> {
    let mut connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    let item = ItemRepository::create(&mut connection,draft).map_err(|e|e.to_string())?;
    IntelligenceRepository::apply_storage_rules(&mut connection).map_err(|e|e.to_string())?;
    state.indexer.notify();
    ItemRepository::get(&connection, &item.id).map_err(|e|e.to_string())?.ok_or_else(|| "created item disappeared".into())
}
#[tauri::command]
fn update_item(state: State<'_,AppState>, id:String, draft:ItemDraft) -> Result<ItemRecord,String> {
    let mut connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    let item = ItemRepository::update(&mut connection,&id,draft).map_err(|e|e.to_string())?;
    IntelligenceRepository::apply_storage_rules(&mut connection).map_err(|e|e.to_string())?;
    state.indexer.notify();
    ItemRepository::get(&connection, &item.id).map_err(|e|e.to_string())?.ok_or_else(|| "updated item disappeared".into())
}
#[tauri::command]
fn get_item(state: State<'_,AppState>, id:String) -> Result<Option<ItemRecord>,String> {
    let connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    ItemRepository::get(&connection,&id).map_err(|e|e.to_string())
}
#[tauri::command]
fn search_items(state: State<'_,AppState>, request:SearchRequest) -> Result<Vec<ItemRecord>,String> {
    let connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    ItemRepository::search(&connection,request).map_err(|e|e.to_string())
}
#[tauri::command]
fn archive_item(state: State<'_,AppState>, id:String) -> Result<(),String> {
    let connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    ItemRepository::archive(&connection,&id).map_err(|e|e.to_string())?;
    state.indexer.notify();
    Ok(())
}

#[tauri::command]
fn analyze_image(data_url:String) -> Result<vision::VisionResult,String> {
    vision::analyze_data_url(&data_url)
}

#[tauri::command]
fn record_intelligence_analysis(
    state: State<'_, AppState>,
    evidence: Vec<NewEvidence>,
    suggestions: Vec<NewSuggestion>,
) -> Result<(), String> {
    let auto_ids = suggestions.iter().filter(|row| row.status == "applied").map(|row| row.id.clone()).collect::<Vec<_>>();
    let mut connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::record_analysis(&mut connection, evidence, suggestions).map_err(|error| error.to_string())?;
    for id in auto_ids {
        IntelligenceRepository::decide_suggestion(
            &mut connection,
            &id,
            SuggestionDecision { action: "automatic".into(), value: None },
        ).map_err(|error| error.to_string())?;
    }
    state.indexer.notify();
    Ok(())
}

#[tauri::command]
fn list_review_queue(state: State<'_, AppState>) -> Result<Vec<SuggestionRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::list_review_queue(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_item_evidence(state: State<'_, AppState>, item_id: String) -> Result<Vec<EvidenceRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::list_evidence(&connection, &item_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_item_field_state(state: State<'_, AppState>, item_id: String) -> Result<Vec<FieldStateRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::get_field_state(&connection, &item_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn decide_field_suggestion(state: State<'_, AppState>, id: String, decision: SuggestionDecision) -> Result<(), String> {
    let mut connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::decide_suggestion(&mut connection, &id, decision).map_err(|error| error.to_string())?;
    IntelligenceRepository::apply_storage_rules(&mut connection).map_err(|error| error.to_string())?;
    state.indexer.notify();
    Ok(())
}

#[tauri::command]
fn list_learning_rules(state: State<'_, AppState>) -> Result<Vec<CorrectionRuleRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::list_rules(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_learning_rule(state: State<'_, AppState>, rule: CorrectionRuleRecord) -> Result<(), String> {
    let mut connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::upsert_rule(&connection, rule).map_err(|error| error.to_string())?;
    IntelligenceRepository::apply_storage_rules(&mut connection).map_err(|error| error.to_string())?;
    state.indexer.notify();
    Ok(())
}

#[tauri::command]
fn delete_learning_rule(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::delete_rule(&connection, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_category_schemas(state: State<'_, AppState>) -> Result<Vec<CategorySchemaRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::list_category_schemas(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_category_schema(state: State<'_, AppState>, schema: CategorySchemaRecord) -> Result<CategorySchemaRecord, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::upsert_category_schema(&connection, schema).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_category_schema(state: State<'_, AppState>, category: String, key: String) -> Result<(), String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::delete_category_schema(&connection, &category, &key).map_err(|error| error.to_string())
}

#[tauri::command]
fn intelligent_search(state: State<'_, AppState>, request: IntelligentSearchRequest) -> Result<Vec<ItemRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    let ids = SearchRepository::search_ids(&connection, request).map_err(|error| error.to_string())?;
    ids.into_iter().map(|id| {
        ItemRepository::get(&connection, &id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| format!("item disappeared during search: {id}"))
    }).collect()
}

#[tauri::command]
fn save_intelligent_search(
    state: State<'_, AppState>,
    id: String,
    name: String,
    query_text: String,
    parsed_json: String,
    smart: bool,
) -> Result<(), String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    SearchRepository::save_search(&connection, &id, &name, &query_text, &parsed_json, smart).map_err(|error| error.to_string())
}

#[tauri::command]
fn record_search_history(
    state: State<'_, AppState>,
    query_text: String,
    parsed_json: String,
    result_count: i64,
) -> Result<(), String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    SearchRepository::record_search_history(&connection, &Uuid::new_v4().to_string(), &query_text, &parsed_json, result_count).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_saved_searches(state: State<'_, AppState>) -> Result<Vec<SavedSearchRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    SearchRepository::list_saved_searches(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_search_history(state: State<'_, AppState>, limit: i64) -> Result<Vec<SearchHistoryRecord>, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    SearchRepository::list_search_history(&connection, limit).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_intelligence_bundle(state: State<'_, AppState>) -> Result<String, String> {
    let connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    IntelligenceRepository::export_intelligence_snapshot(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_mobile_change_bundle(state: State<'_, AppState>, bundle_json: String) -> Result<MobileImportResult, String> {
    let mut connection = state.connection.lock().map_err(|_| "database lock poisoned".to_string())?;
    let result = IntelligenceRepository::import_mobile_changes(&mut connection, &bundle_json).map_err(|error| error.to_string())?;
    IntelligenceRepository::apply_storage_rules(&mut connection).map_err(|error| error.to_string())?;
    state.indexer.notify();
    Ok(result)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir=app.path().app_data_dir()?;
            let database_path=data_dir.join("vault-catalogue.sqlite3");
            let mut connection=db::open_database(&database_path).map_err(|e|Box::<dyn std::error::Error>::from(e))?;
            IntelligenceRepository::apply_storage_rules(&mut connection).map_err(|e|Box::<dyn std::error::Error>::from(e))?;
            let indexer=background::BackgroundIndexer::start(database_path);
            app.manage(AppState{connection:Mutex::new(connection),indexer});
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_health, create_item, update_item, get_item, search_items, archive_item, analyze_image,
            record_intelligence_analysis, list_review_queue, list_item_evidence, get_item_field_state,
            decide_field_suggestion, list_learning_rules, upsert_learning_rule, delete_learning_rule,
            list_category_schemas, upsert_category_schema, delete_category_schema,
            intelligent_search, save_intelligent_search, record_search_history,
            list_saved_searches, list_search_history, export_intelligence_bundle, import_mobile_change_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vault Catalogue");
}

#[cfg(test)]
mod tests { use super::app_health; #[test] fn health_reports_catalogue_identity(){let health=app_health();assert_eq!(health.app,"vault-catalogue");assert!(health.database_ready);} }
