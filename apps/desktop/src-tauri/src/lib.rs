use db::{items::ItemRepository, models::{ItemDraft, ItemRecord, SearchRequest}};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State};

pub mod db;
pub mod vision;

struct AppState { connection: Mutex<rusqlite::Connection> }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppHealth { app: &'static str, version: &'static str, database_ready: bool }

#[tauri::command]
fn app_health() -> AppHealth { AppHealth { app:"vault-catalogue", version:env!("CARGO_PKG_VERSION"), database_ready:true } }

#[tauri::command]
fn create_item(state: State<'_,AppState>, draft: ItemDraft) -> Result<ItemRecord,String> {
    let mut connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    ItemRepository::create(&mut connection,draft).map_err(|e|e.to_string())
}
#[tauri::command]
fn update_item(state: State<'_,AppState>, id:String, draft:ItemDraft) -> Result<ItemRecord,String> {
    let mut connection=state.connection.lock().map_err(|_|"database lock poisoned".to_string())?;
    ItemRepository::update(&mut connection,&id,draft).map_err(|e|e.to_string())
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
    ItemRepository::archive(&connection,&id).map_err(|e|e.to_string())
}

#[tauri::command]
fn analyze_image(data_url:String) -> Result<vision::VisionResult,String> {
    vision::analyze_data_url(&data_url)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir=app.path().app_data_dir()?;
            let connection=db::open_database(&data_dir.join("vault-catalogue.sqlite3")).map_err(|e|Box::<dyn std::error::Error>::from(e))?;
            app.manage(AppState{connection:Mutex::new(connection)});
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![app_health,create_item,update_item,get_item,search_items,archive_item,analyze_image])
        .run(tauri::generate_context!())
        .expect("error while running Vault Catalogue");
}

#[cfg(test)]
mod tests { use super::app_health; #[test] fn health_reports_catalogue_identity(){let health=app_health();assert_eq!(health.app,"vault-catalogue");assert!(health.database_ready);} }
