use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Money {
    pub amount_minor: i64,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemRecord {
    pub id: String,
    pub title: String,
    pub category: String,
    pub subcategory: Option<String>,
    pub status: String,
    pub condition: String,
    pub condition_notes: Option<String>,
    pub description: Option<String>,
    pub quantity: i64,
    pub sku: Option<String>,
    pub serial_number: Option<String>,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub year: Option<i64>,
    pub edition: Option<String>,
    pub purchase_price: Option<Money>,
    pub median_value: Option<Money>,
    pub suggested_price: Option<Money>,
    pub minimum_price: Option<Money>,
    pub storage_location_id: Option<String>,
    pub acquired_at: Option<String>,
    pub sold_at: Option<String>,
    pub sold_price: Option<Money>,
    pub notes: Option<String>,
    pub specifics: BTreeMap<String, String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemDraft {
    pub id: Option<String>,
    pub title: String,
    pub category: String,
    pub subcategory: Option<String>,
    pub status: Option<String>,
    pub condition: String,
    pub condition_notes: Option<String>,
    pub description: Option<String>,
    pub quantity: Option<i64>,
    pub sku: Option<String>,
    pub serial_number: Option<String>,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub year: Option<i64>,
    pub edition: Option<String>,
    pub purchase_price: Option<Money>,
    pub median_value: Option<Money>,
    pub suggested_price: Option<Money>,
    pub minimum_price: Option<Money>,
    pub storage_location_id: Option<String>,
    pub acquired_at: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub specifics: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRequest {
    #[serde(default)]
    pub query: String,
    pub category: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
