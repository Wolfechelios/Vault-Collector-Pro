use super::{models::{ItemDraft, ItemRecord, Money, SearchRequest}, DatabaseError};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use std::collections::BTreeMap;
use uuid::Uuid;

pub struct ItemRepository;

impl ItemRepository {
    pub fn create(connection: &mut Connection, draft: ItemDraft) -> Result<ItemRecord, DatabaseError> {
        validate_draft(&draft)?;
        let protected_draft = draft.clone();
        let transaction = connection.transaction()?;
        let now = Utc::now().to_rfc3339();
        let id = draft.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
        let status = draft.status.clone().unwrap_or_else(|| "private".to_string());
        let quantity = draft.quantity.unwrap_or(1);

        transaction.execute(
            "INSERT INTO items (
                id,title,category,subcategory,status,condition,condition_notes,description,quantity,sku,
                serial_number,brand,model,year,edition,purchase_amount_minor,purchase_currency,
                median_amount_minor,median_currency,suggested_amount_minor,suggested_currency,
                minimum_amount_minor,minimum_currency,storage_location_id,acquired_at,notes,created_at,updated_at
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28)",
            params![
                id, draft.title.trim(), draft.category.trim(), trim_option(draft.subcategory), status,
                draft.condition.trim(), trim_option(draft.condition_notes), trim_option(draft.description), quantity,
                trim_option(draft.sku), trim_option(draft.serial_number), trim_option(draft.brand), trim_option(draft.model),
                draft.year, trim_option(draft.edition), money_amount(&draft.purchase_price), money_currency(&draft.purchase_price),
                money_amount(&draft.median_value), money_currency(&draft.median_value),
                money_amount(&draft.suggested_price), money_currency(&draft.suggested_price),
                money_amount(&draft.minimum_price), money_currency(&draft.minimum_price),
                trim_option(draft.storage_location_id), draft.acquired_at, trim_option(draft.notes), now, now
            ],
        )?;
        replace_specifics(&transaction, &id, &draft.specifics)?;
        protect_draft_fields(&transaction, &id, &protected_draft, &now)?;
        transaction.commit()?;
        Self::get(connection, &id)?.ok_or_else(|| DatabaseError::NotFound(id))
    }

    pub fn get(connection: &Connection, id: &str) -> Result<Option<ItemRecord>, DatabaseError> {
        let item = connection.query_row(
            "SELECT id,title,category,subcategory,status,condition,condition_notes,description,quantity,sku,
                    serial_number,brand,model,year,edition,purchase_amount_minor,purchase_currency,
                    median_amount_minor,median_currency,suggested_amount_minor,suggested_currency,
                    minimum_amount_minor,minimum_currency,storage_location_id,acquired_at,sold_at,
                    sold_amount_minor,sold_currency,notes,created_at,updated_at
             FROM items WHERE id=?1",
            [id],
            row_to_item,
        ).optional()?;

        match item {
            Some(mut item) => {
                item.specifics = load_specifics(connection, &item.id)?;
                Ok(Some(item))
            }
            None => Ok(None),
        }
    }

    pub fn update(connection: &mut Connection, id: &str, draft: ItemDraft) -> Result<ItemRecord, DatabaseError> {
        validate_draft(&draft)?;
        let protected_draft = draft.clone();
        if Self::get(connection, id)?.is_none() {
            return Err(DatabaseError::NotFound(id.to_string()));
        }
        let transaction = connection.transaction()?;
        let now = Utc::now().to_rfc3339();
        let status = draft.status.clone().unwrap_or_else(|| "private".to_string());
        let quantity = draft.quantity.unwrap_or(1);
        transaction.execute(
            "UPDATE items SET title=?2,category=?3,subcategory=?4,status=?5,condition=?6,condition_notes=?7,
                    description=?8,quantity=?9,sku=?10,serial_number=?11,brand=?12,model=?13,year=?14,edition=?15,
                    purchase_amount_minor=?16,purchase_currency=?17,median_amount_minor=?18,median_currency=?19,
                    suggested_amount_minor=?20,suggested_currency=?21,minimum_amount_minor=?22,minimum_currency=?23,
                    storage_location_id=?24,acquired_at=?25,notes=?26,updated_at=?27
             WHERE id=?1",
            params![id,draft.title.trim(),draft.category.trim(),trim_option(draft.subcategory),status,draft.condition.trim(),
                trim_option(draft.condition_notes),trim_option(draft.description),quantity,trim_option(draft.sku),
                trim_option(draft.serial_number),trim_option(draft.brand),trim_option(draft.model),draft.year,trim_option(draft.edition),
                money_amount(&draft.purchase_price),money_currency(&draft.purchase_price),money_amount(&draft.median_value),money_currency(&draft.median_value),
                money_amount(&draft.suggested_price),money_currency(&draft.suggested_price),money_amount(&draft.minimum_price),money_currency(&draft.minimum_price),
                trim_option(draft.storage_location_id),draft.acquired_at,trim_option(draft.notes),now],
        )?;
        replace_specifics(&transaction, id, &draft.specifics)?;
        protect_draft_fields(&transaction, id, &protected_draft, &now)?;
        transaction.commit()?;
        Self::get(connection, id)?.ok_or_else(|| DatabaseError::NotFound(id.to_string()))
    }

    pub fn search(connection: &Connection, request: SearchRequest) -> Result<Vec<ItemRecord>, DatabaseError> {
        let limit = request.limit.unwrap_or(100).clamp(1, 500);
        let offset = request.offset.unwrap_or(0).max(0);
        let query = request.query.trim().to_string();
        let like = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
        let mut statement = connection.prepare(
            "SELECT i.id,i.title,i.category,i.subcategory,i.status,i.condition,i.condition_notes,i.description,i.quantity,i.sku,
                    i.serial_number,i.brand,i.model,i.year,i.edition,i.purchase_amount_minor,i.purchase_currency,
                    i.median_amount_minor,i.median_currency,i.suggested_amount_minor,i.suggested_currency,
                    i.minimum_amount_minor,i.minimum_currency,i.storage_location_id,i.acquired_at,i.sold_at,
                    i.sold_amount_minor,i.sold_currency,i.notes,i.created_at,i.updated_at
             FROM items i
             WHERE (?1='' OR i.title LIKE ?2 ESCAPE '\\' OR coalesce(i.brand,'') LIKE ?2 ESCAPE '\\' OR coalesce(i.model,'') LIKE ?2 ESCAPE '\\' OR coalesce(i.sku,'') LIKE ?2 ESCAPE '\\')
               AND (?3 IS NULL OR i.category=?3)
               AND (?4 IS NULL OR i.status=?4)
             ORDER BY i.updated_at DESC LIMIT ?5 OFFSET ?6"
        )?;
        let mut rows = statement.query(params![query, like, request.category, request.status, limit, offset])?;
        let mut items = Vec::new();
        while let Some(row) = rows.next()? {
            let mut item = row_to_item(row)?;
            item.specifics = load_specifics(connection, &item.id)?;
            items.push(item);
        }
        Ok(items)
    }

    pub fn archive(connection: &Connection, id: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().to_rfc3339();
        let changed = connection.execute(
            "UPDATE items SET status='archived', archived_at=?2, updated_at=?2 WHERE id=?1",
            params![id, now],
        )?;
        if changed == 0 { return Err(DatabaseError::NotFound(id.to_string())); }
        Ok(())
    }
}

fn validate_draft(draft: &ItemDraft) -> Result<(), DatabaseError> {
    if draft.title.trim().is_empty() { return Err(DatabaseError::Validation("title is required".into())); }
    if draft.category.trim().is_empty() { return Err(DatabaseError::Validation("category is required".into())); }
    if draft.condition.trim().is_empty() { return Err(DatabaseError::Validation("condition is required".into())); }
    if draft.quantity.unwrap_or(1) < 1 { return Err(DatabaseError::Validation("quantity must be at least 1".into())); }
    Ok(())
}
fn trim_option(value: Option<String>) -> Option<String> { value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) }
fn money_amount(value: &Option<Money>) -> Option<i64> { value.as_ref().map(|m| m.amount_minor) }
fn money_currency(value: &Option<Money>) -> Option<String> { value.as_ref().map(|m| m.currency.to_uppercase()) }
fn make_money(amount: Option<i64>, currency: Option<String>) -> Option<Money> { match (amount, currency) { (Some(a), Some(c)) => Some(Money{amount_minor:a,currency:c}), _ => None } }

fn replace_specifics(transaction: &Transaction<'_>, item_id: &str, specifics: &BTreeMap<String,String>) -> Result<(), DatabaseError> {
    transaction.execute("DELETE FROM item_specifics WHERE item_id=?1", [item_id])?;
    for (key, value) in specifics { if key != "__inferredFields" && !key.trim().is_empty() && !value.trim().is_empty() { transaction.execute("INSERT INTO item_specifics(item_id,key,value) VALUES(?1,?2,?3)", params![item_id,key.trim(),value.trim()])?; } }
    Ok(())
}

fn protect_draft_fields(
    transaction: &Transaction<'_>,
    item_id: &str,
    draft: &ItemDraft,
    now: &str,
) -> Result<(), DatabaseError> {
    let inferred_fields = draft
        .specifics
        .get("__inferredFields")
        .and_then(|value| serde_json::from_str::<Vec<String>>(value).ok())
        .unwrap_or_default();
    let mut fields = vec![
        ("title", Some(draft.title.as_str())),
        ("category", Some(draft.category.as_str())),
        ("condition", Some(draft.condition.as_str())),
        ("brand", draft.brand.as_deref()),
        ("model", draft.model.as_deref()),
        ("serialNumber", draft.serial_number.as_deref()),
        ("sku", draft.sku.as_deref()),
        ("edition", draft.edition.as_deref()),
    ];
    let year = draft.year.map(|value| value.to_string());
    fields.push(("year", year.as_deref()));

    for (field_name, value) in fields {
        if !inferred_fields.iter().any(|inferred| inferred == field_name) {
            if let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) {
                upsert_protected_field(transaction, item_id, field_name, value, now)?;
            }
        }
    }

    for (field_name, value) in &draft.specifics {
        if !is_system_specific(field_name)
            && !inferred_fields.iter().any(|inferred| inferred == field_name)
            && !value.trim().is_empty()
        {
            upsert_protected_field(transaction, item_id, field_name.trim(), value.trim(), now)?;
        }
    }
    Ok(())
}

fn upsert_protected_field(
    transaction: &Transaction<'_>,
    item_id: &str,
    field_name: &str,
    value: &str,
    now: &str,
) -> Result<(), DatabaseError> {
    transaction.execute(
        "INSERT INTO item_field_state(
            item_id,field_name,value,source,protected,verification_state,confidence,
            evidence_ids_json,suggestion_id,updated_at
         ) VALUES(?1,?2,?3,'user',1,'verified',NULL,'[]',NULL,?4)
         ON CONFLICT(item_id,field_name) DO UPDATE SET
            value=excluded.value,source='user',protected=1,verification_state='verified',
            confidence=NULL,evidence_ids_json='[]',suggestion_id=NULL,updated_at=excluded.updated_at",
        params![item_id, field_name, value, now],
    )?;
    Ok(())
}

fn is_system_specific(field_name: &str) -> bool {
    matches!(
        field_name,
        "photos"
            | "photoMetadata"
            | "phoneCaptureId"
            | "capturedAt"
            | "__protectedFields"
            | "__inferredFields"
            | "ocrText"
    )
}
fn load_specifics(connection: &Connection, item_id: &str) -> Result<BTreeMap<String,String>, DatabaseError> {
    let mut statement = connection.prepare("SELECT key,value FROM item_specifics WHERE item_id=?1 ORDER BY key")?;
    let rows = statement.query_map([item_id], |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?)))?;
    let mut result = BTreeMap::new();
    for row in rows { let (key,value)=row?; result.insert(key,value); }
    Ok(result)
}
fn row_to_item(row: &Row<'_>) -> rusqlite::Result<ItemRecord> {
    Ok(ItemRecord{
        id:row.get(0)?,title:row.get(1)?,category:row.get(2)?,subcategory:row.get(3)?,status:row.get(4)?,condition:row.get(5)?,condition_notes:row.get(6)?,description:row.get(7)?,quantity:row.get(8)?,sku:row.get(9)?,serial_number:row.get(10)?,brand:row.get(11)?,model:row.get(12)?,year:row.get(13)?,edition:row.get(14)?,
        purchase_price:make_money(row.get(15)?,row.get(16)?),median_value:make_money(row.get(17)?,row.get(18)?),suggested_price:make_money(row.get(19)?,row.get(20)?),minimum_price:make_money(row.get(21)?,row.get(22)?),storage_location_id:row.get(23)?,acquired_at:row.get(24)?,sold_at:row.get(25)?,sold_price:make_money(row.get(26)?,row.get(27)?),notes:row.get(28)?,created_at:row.get(29)?,updated_at:row.get(30)?,specifics:BTreeMap::new()
    })
}
