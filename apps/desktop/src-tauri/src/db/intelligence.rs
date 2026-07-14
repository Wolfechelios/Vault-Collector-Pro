use super::DatabaseError;
use chrono::Utc;
use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewEvidence {
    pub id: String,
    pub scan_id: String,
    pub item_id: Option<String>,
    pub field_name: String,
    pub value: String,
    pub normalized_value: String,
    pub confidence: f64,
    pub source_kind: String,
    pub source_media_id: Option<String>,
    pub raw_text: Option<String>,
    pub bounds_json: Option<String>,
    pub provider: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceRecord {
    pub id: String,
    pub scan_id: String,
    pub item_id: Option<String>,
    pub field_name: String,
    pub value: String,
    pub normalized_value: String,
    pub confidence: f64,
    pub source_kind: String,
    pub source_media_id: Option<String>,
    pub raw_text: Option<String>,
    pub bounds_json: Option<String>,
    pub provider: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSuggestion {
    pub id: String,
    pub item_id: String,
    pub field_name: String,
    pub proposed_value: String,
    pub confidence: f64,
    pub disposition: String,
    pub evidence_ids: Vec<String>,
    pub conflicting_evidence_ids: Vec<String>,
    pub influenced_rule_ids: Vec<String>,
    pub verification_state: String,
    pub status: String,
    pub protected_value: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionRecord {
    pub id: String,
    pub item_id: String,
    pub field_name: String,
    pub proposed_value: String,
    pub confidence: f64,
    pub disposition: String,
    pub evidence_ids: Vec<String>,
    pub conflicting_evidence_ids: Vec<String>,
    pub influenced_rule_ids: Vec<String>,
    pub verification_state: String,
    pub status: String,
    pub protected_value: Option<String>,
    pub created_at: String,
    pub decided_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldStateRecord {
    pub item_id: String,
    pub field_name: String,
    pub value: String,
    pub source: String,
    pub protected: bool,
    pub verification_state: String,
    pub confidence: Option<f64>,
    pub evidence_ids: Vec<String>,
    pub suggestion_id: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionDecision {
    pub action: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionRuleRecord {
    pub id: String,
    pub rule_kind: String,
    pub conditions_json: String,
    pub action_json: String,
    pub priority: i64,
    pub evidence_count: i64,
    pub enabled: bool,
    pub explanation: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySchemaRecord {
    pub category: String,
    pub key: String,
    pub label: String,
    pub kind: String,
    pub required: bool,
    pub searchable: bool,
    pub options: Vec<String>,
    pub aliases: Vec<String>,
    pub order: i64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IntelligentSearchRequest {
    #[serde(default)]
    pub fts_query: String,
    pub category: Option<String>,
    pub color: Option<String>,
    pub brand: Option<String>,
    pub year_operator: Option<String>,
    pub year_value: Option<i64>,
    pub value_operator: Option<String>,
    pub value_minor: Option<i64>,
    pub quantity_operator: Option<String>,
    pub quantity_value: Option<i64>,
    pub status: Option<String>,
    pub condition: Option<String>,
    pub location: Option<String>,
    pub listed: Option<bool>,
    pub missing_photos: Option<bool>,
    pub review_needed: Option<bool>,
    pub unpriced: Option<bool>,
    pub unassigned: Option<bool>,
    pub duplicate: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSearchRecord {
    pub id: String,
    pub name: String,
    pub query_text: String,
    pub parsed_query_json: String,
    pub is_smart_collection: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHistoryRecord {
    pub id: String,
    pub query_text: String,
    pub parsed_query_json: String,
    pub result_count: i64,
    pub searched_at: String,
}

pub struct IntelligenceRepository;

impl IntelligenceRepository {
    pub fn list_category_schemas(connection: &Connection) -> Result<Vec<CategorySchemaRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT category,field_key,label,kind,required,searchable,options_json,aliases_json,sort_order,enabled FROM category_field_definitions ORDER BY category,sort_order,field_key"
        )?;
        let rows = statement.query_map([], |row| {
            let options_json: String = row.get(6)?;
            let aliases_json: String = row.get(7)?;
            Ok(CategorySchemaRecord {
                category: row.get(0)?, key: row.get(1)?, label: row.get(2)?, kind: row.get(3)?,
                required: row.get::<_, i64>(4)? != 0, searchable: row.get::<_, i64>(5)? != 0,
                options: serde_json::from_str(&options_json).unwrap_or_default(),
                aliases: serde_json::from_str(&aliases_json).unwrap_or_default(),
                order: row.get(8)?, enabled: row.get::<_, i64>(9)? != 0,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }

    pub fn upsert_category_schema(connection: &Connection, schema: CategorySchemaRecord) -> Result<CategorySchemaRecord, DatabaseError> {
        if schema.category.trim().is_empty() || schema.key.trim().is_empty() || schema.label.trim().is_empty() || schema.kind.trim().is_empty() {
            return Err(DatabaseError::Validation("category schema category, key, label, and kind are required".into()));
        }
        connection.execute(
            "INSERT INTO category_field_definitions(category,field_key,label,kind,required,searchable,options_json,aliases_json,sort_order,updated_at,enabled)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(category,field_key) DO UPDATE SET label=excluded.label,kind=excluded.kind,required=excluded.required,searchable=excluded.searchable,options_json=excluded.options_json,aliases_json=excluded.aliases_json,sort_order=excluded.sort_order,updated_at=excluded.updated_at,enabled=excluded.enabled",
            params![schema.category.trim().to_lowercase(),schema.key.trim(),schema.label.trim(),schema.kind.trim(),if schema.required{1}else{0},if schema.searchable{1}else{0},serde_json::to_string(&schema.options)?,serde_json::to_string(&schema.aliases)?,schema.order,Utc::now().to_rfc3339(),if schema.enabled{1}else{0}],
        )?;
        Ok(schema)
    }

    pub fn delete_category_schema(connection: &Connection, category: &str, key: &str) -> Result<(), DatabaseError> {
        if connection.execute("DELETE FROM category_field_definitions WHERE category=?1 AND field_key=?2", params![category,key])? == 0 {
            return Err(DatabaseError::NotFound(format!("{category}:{key}")));
        }
        Ok(())
    }

    pub fn record_analysis(connection: &mut Connection, evidence: Vec<NewEvidence>, suggestions: Vec<NewSuggestion>) -> Result<(), DatabaseError> {
        let transaction = connection.transaction()?;
        for row in evidence {
            Self::record_evidence(&transaction, row)?;
        }
        for row in suggestions {
            Self::save_suggestion(&transaction, row)?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn record_evidence(connection: &Connection, evidence: NewEvidence) -> Result<(), DatabaseError> {
        connection.execute(
            "INSERT INTO scan_evidence(id,scan_id,item_id,field_name,value,normalized_value,confidence,source_kind,source_media_id,raw_text,bounds_json,provider,created_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
            params![evidence.id,evidence.scan_id,evidence.item_id,evidence.field_name,evidence.value,evidence.normalized_value,evidence.confidence,evidence.source_kind,evidence.source_media_id,evidence.raw_text,evidence.bounds_json,evidence.provider,evidence.created_at],
        )?;
        Ok(())
    }

    pub fn save_suggestion(connection: &Connection, suggestion: NewSuggestion) -> Result<(), DatabaseError> {
        if suggestion.evidence_ids.is_empty() {
            return Err(DatabaseError::Validation("suggestion requires evidence".into()));
        }
        connection.execute(
            "INSERT INTO field_suggestions(id,item_id,field_name,proposed_value,confidence,disposition,evidence_ids_json,conflicting_evidence_ids_json,influenced_rule_ids_json,verification_state,status,protected_value,created_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
            params![suggestion.id,suggestion.item_id,suggestion.field_name,suggestion.proposed_value,suggestion.confidence,suggestion.disposition,serde_json::to_string(&suggestion.evidence_ids)?,serde_json::to_string(&suggestion.conflicting_evidence_ids)?,serde_json::to_string(&suggestion.influenced_rule_ids)?,suggestion.verification_state,suggestion.status,suggestion.protected_value,suggestion.created_at],
        )?;
        Ok(())
    }

    pub fn protect_field(connection: &Connection, item_id: &str, field_name: &str, value: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().to_rfc3339();
        connection.execute(
            "INSERT INTO item_field_state(item_id,field_name,value,source,protected,verification_state,confidence,evidence_ids_json,suggestion_id,updated_at)
             VALUES(?1,?2,?3,'user',1,'verified',NULL,'[]',NULL,?4)
             ON CONFLICT(item_id,field_name) DO UPDATE SET value=excluded.value,source='user',protected=1,verification_state='verified',updated_at=excluded.updated_at",
            params![item_id, field_name, value, now],
        )?;
        Ok(())
    }

    pub fn get_field_state(connection: &Connection, item_id: &str) -> Result<Vec<FieldStateRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT item_id,field_name,value,source,protected,verification_state,confidence,evidence_ids_json,suggestion_id,updated_at
             FROM item_field_state WHERE item_id=?1 ORDER BY field_name",
        )?;
        let rows = statement.query_map([item_id], |row| {
            let evidence_json: String = row.get(7)?;
            Ok(FieldStateRecord {
                item_id: row.get(0)?, field_name: row.get(1)?, value: row.get(2)?, source: row.get(3)?,
                protected: row.get::<_, i64>(4)? != 0, verification_state: row.get(5)?, confidence: row.get(6)?,
                evidence_ids: serde_json::from_str(&evidence_json).unwrap_or_default(), suggestion_id: row.get(8)?, updated_at: row.get(9)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }

    pub fn list_review_queue(connection: &Connection) -> Result<Vec<SuggestionRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT id,item_id,field_name,proposed_value,confidence,disposition,evidence_ids_json,conflicting_evidence_ids_json,influenced_rule_ids_json,verification_state,status,protected_value,created_at,decided_at
             FROM field_suggestions WHERE status='pending' OR verification_state='flagged' ORDER BY created_at DESC",
        )?;
        let rows = statement.query_map([], row_to_suggestion)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }

    pub fn list_evidence(connection: &Connection, item_id: &str) -> Result<Vec<EvidenceRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT id,scan_id,item_id,field_name,value,normalized_value,confidence,source_kind,source_media_id,raw_text,bounds_json,provider,created_at
             FROM scan_evidence WHERE item_id=?1 ORDER BY created_at DESC, confidence DESC",
        )?;
        let rows = statement.query_map([item_id], |row| Ok(EvidenceRecord {
            id: row.get(0)?, scan_id: row.get(1)?, item_id: row.get(2)?, field_name: row.get(3)?,
            value: row.get(4)?, normalized_value: row.get(5)?, confidence: row.get(6)?, source_kind: row.get(7)?,
            source_media_id: row.get(8)?, raw_text: row.get(9)?, bounds_json: row.get(10)?, provider: row.get(11)?, created_at: row.get(12)?,
        }))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }

    pub fn decide_suggestion(connection: &mut Connection, id: &str, decision: SuggestionDecision) -> Result<(), DatabaseError> {
        let transaction = connection.transaction()?;
        let suggestion = transaction.query_row(
            "SELECT item_id,field_name,proposed_value,confidence,verification_state,evidence_ids_json,protected_value FROM field_suggestions WHERE id=?1",
            [id],
            |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?,row.get::<_,f64>(3)?,row.get::<_,String>(4)?,row.get::<_,String>(5)?,row.get::<_,Option<String>>(6)?)),
        ).optional()?.ok_or_else(|| DatabaseError::NotFound(id.to_string()))?;
        let (item_id, field_name, proposed_value, confidence, prior_verification, evidence_json, protected_value) = suggestion;
        let action = decision.action.as_str();
        if action == "automatic" && protected_value.is_some() {
            return Err(DatabaseError::Validation(format!("protected field {field_name} requires explicit approval")));
        }
        if !["automatic", "accept", "edit", "reject"].contains(&action) {
            return Err(DatabaseError::Validation(format!("unknown suggestion decision {action}")));
        }
        let now = Utc::now().to_rfc3339();
        if action == "reject" {
            transaction.execute(
                "UPDATE field_suggestions SET status='rejected',verification_state='rejected',decided_at=?2 WHERE id=?1",
                params![id, now],
            )?;
            record_learning_event(&transaction, &item_id, id, &field_name, "rejected", &proposed_value, None, &now)?;
            transaction.commit()?;
            return Ok(());
        }
        let value = if action == "edit" {
            decision.value.as_deref().map(str::trim).filter(|value| !value.is_empty())
                .ok_or_else(|| DatabaseError::Validation("edited value is required".into()))?.to_string()
        } else {
            proposed_value.clone()
        };
        update_item_field(&transaction, &item_id, &field_name, &value)?;
        let explicit = action == "accept" || action == "edit";
        let status = if action == "edit" { "edited" } else if action == "accept" { "accepted" } else { "applied" };
        let verification = if explicit { "verified" } else { prior_verification.as_str() };
        let source = if action == "edit" { "user" } else { "inference" };
        transaction.execute(
            "INSERT INTO item_field_state(item_id,field_name,value,source,protected,verification_state,confidence,evidence_ids_json,suggestion_id,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
             ON CONFLICT(item_id,field_name) DO UPDATE SET value=excluded.value,source=excluded.source,protected=excluded.protected,verification_state=excluded.verification_state,confidence=excluded.confidence,evidence_ids_json=excluded.evidence_ids_json,suggestion_id=excluded.suggestion_id,updated_at=excluded.updated_at",
            params![item_id,field_name,value,source,if explicit {1} else {0},verification,confidence,evidence_json,id,now],
        )?;
        transaction.execute(
            "UPDATE field_suggestions SET proposed_value=?2,status=?3,verification_state=?4,decided_at=?5 WHERE id=?1",
            params![id,value,status,verification,now],
        )?;
        if explicit {
            record_learning_event(&transaction, &item_id, id, &field_name, if action == "edit" { "edited" } else { "accepted" }, &proposed_value, Some(&value), &now)?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn upsert_rule(connection: &Connection, rule: CorrectionRuleRecord) -> Result<(), DatabaseError> {
        validate_rule(&rule)?;
        connection.execute(
            "INSERT INTO correction_rules(id,rule_kind,conditions_json,action_json,priority,evidence_count,enabled,explanation,created_at,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
             ON CONFLICT(id) DO UPDATE SET rule_kind=excluded.rule_kind,conditions_json=excluded.conditions_json,action_json=excluded.action_json,priority=excluded.priority,evidence_count=excluded.evidence_count,enabled=excluded.enabled,explanation=excluded.explanation,updated_at=excluded.updated_at",
            params![rule.id,rule.rule_kind,rule.conditions_json,rule.action_json,rule.priority,rule.evidence_count,if rule.enabled {1} else {0},rule.explanation,rule.created_at,rule.updated_at],
        )?;
        Ok(())
    }

    pub fn apply_storage_rules(connection: &mut Connection) -> Result<usize, DatabaseError> {
        let rules = Self::list_rules(connection)?.into_iter()
            .filter(|rule| rule.enabled && rule.rule_kind == "storage")
            .filter_map(|rule| {
                let conditions = serde_json::from_str::<serde_json::Value>(&rule.conditions_json).ok()?;
                let action = serde_json::from_str::<serde_json::Value>(&rule.action_json).ok()?;
                Some((rule, conditions.get("category")?.as_str()?.to_string(), action.get("value")?.as_str()?.to_string()))
            })
            .collect::<Vec<_>>();
        let items = {
            let mut statement = connection.prepare("SELECT id,category FROM items WHERE status<>'archived' ORDER BY id")?;
            let rows = statement.query_map([], |row| Ok((row.get::<_,String>(0)?, row.get::<_,String>(1)?)))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let mut applied = 0;
        for (item_id, category) in items {
            let Some((rule, _, location)) = rules.iter()
                .filter(|(_, rule_category, _)| rule_category.trim().eq_ignore_ascii_case(category.trim()))
                .next() else { continue; };
            let current: String = connection.query_row(
                "SELECT coalesce((SELECT value FROM item_specifics WHERE item_id=?1 AND key='storagePath'),'')",
                [&item_id], |row| row.get(0),
            )?;
            if current.trim().eq_ignore_ascii_case(location.trim()) { continue; }
            let protected = connection.query_row(
                "SELECT protected FROM item_field_state WHERE item_id=?1 AND field_name='storagePath'",
                [&item_id], |row| row.get::<_,i64>(0),
            ).optional()?.unwrap_or(0) != 0;
            let suffix = rule_slug(location);
            let evidence_id = format!("evidence:storage:{}:{}:{}", item_id, rule.id, suffix);
            let suggestion_id = format!("suggestion:storage:{}:{}:{}", item_id, rule.id, suffix);
            let already_exists = connection.query_row(
                "SELECT count(*) FROM field_suggestions WHERE id=?1", [&suggestion_id], |row| row.get::<_,i64>(0),
            )? > 0;
            if already_exists { continue; }
            let now = Utc::now().to_rfc3339();
            Self::record_evidence(connection, NewEvidence {
                id: evidence_id.clone(), scan_id: format!("learning:storage:{}", rule.id), item_id: Some(item_id.clone()),
                field_name: "storagePath".into(), value: location.clone(), normalized_value: location.trim().to_uppercase(),
                confidence: 0.78, source_kind: "learned-rule".into(), source_media_id: None,
                raw_text: Some(rule.explanation.clone()), bounds_json: None, provider: Some(rule.id.clone()), created_at: now.clone(),
            })?;
            let conflict = !current.trim().is_empty() || protected;
            Self::save_suggestion(connection, NewSuggestion {
                id: suggestion_id.clone(), item_id: item_id.clone(), field_name: "storagePath".into(), proposed_value: location.clone(),
                confidence: 0.78, disposition: if conflict { "review".into() } else { "flagged".into() },
                evidence_ids: vec![evidence_id], conflicting_evidence_ids: vec![], influenced_rule_ids: vec![rule.id.clone()],
                verification_state: if conflict { "unverified".into() } else { "flagged".into() },
                status: if conflict { "pending".into() } else { "applied".into() },
                protected_value: if current.trim().is_empty() { None } else { Some(current.clone()) }, created_at: now,
            })?;
            if !conflict {
                Self::decide_suggestion(connection, &suggestion_id, SuggestionDecision { action: "automatic".into(), value: None })?;
                applied += 1;
            }
        }
        Ok(applied)
    }

    pub fn list_rules(connection: &Connection) -> Result<Vec<CorrectionRuleRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT id,rule_kind,conditions_json,action_json,priority,evidence_count,enabled,explanation,created_at,updated_at FROM correction_rules ORDER BY priority DESC, updated_at DESC",
        )?;
        let rows = statement.query_map([], |row| Ok(CorrectionRuleRecord {
            id: row.get(0)?, rule_kind: row.get(1)?, conditions_json: row.get(2)?, action_json: row.get(3)?,
            priority: row.get(4)?, evidence_count: row.get(5)?, enabled: row.get::<_,i64>(6)? != 0,
            explanation: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
        }))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }

    pub fn delete_rule(connection: &Connection, id: &str) -> Result<(), DatabaseError> {
        if connection.execute("DELETE FROM correction_rules WHERE id=?1", [id])? == 0 {
            return Err(DatabaseError::NotFound(id.to_string()));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileImportResult {
    pub applied: usize,
    pub duplicates: usize,
    pub conflicts: usize,
    pub revision: i64,
}

impl IntelligenceRepository {
    pub fn export_intelligence_snapshot(connection: &Connection) -> Result<String, DatabaseError> {
        use super::items::ItemRepository;
        let (vault_id, revision): (String, i64) = connection.query_row(
            "SELECT vault_id,intelligence_revision FROM vault_identity WHERE singleton=1", [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let item_ids = {
            let mut statement = connection.prepare("SELECT id FROM items ORDER BY id")?;
            statement.query_map([], |row| row.get::<_,String>(0))?.collect::<Result<Vec<_>,_>>()?
        };
        let mut items = Vec::new();
        let mut evidence = Vec::new();
        let mut suggestions = Vec::new();
        let mut field_state = Vec::new();
        for id in item_ids {
            if let Some(item) = ItemRepository::get(connection, &id)? { items.push(serde_json::to_value(item)?); }
            evidence.extend(Self::list_evidence(connection, &id)?.into_iter().map(serde_json::to_value).collect::<Result<Vec<_>,_>>()?);
            field_state.extend(Self::get_field_state(connection, &id)?.into_iter().map(serde_json::to_value).collect::<Result<Vec<_>,_>>()?);
            let mut statement = connection.prepare(
                "SELECT id,item_id,field_name,proposed_value,confidence,disposition,evidence_ids_json,conflicting_evidence_ids_json,influenced_rule_ids_json,verification_state,status,protected_value,created_at,decided_at FROM field_suggestions WHERE item_id=?1 ORDER BY created_at,id"
            )?;
            suggestions.extend(statement.query_map([&id], row_to_suggestion)?.collect::<Result<Vec<_>,_>>()?.into_iter().map(serde_json::to_value).collect::<Result<Vec<_>,_>>()?);
        }
        let rules = Self::list_rules(connection)?.into_iter().map(serde_json::to_value).collect::<Result<Vec<_>,_>>()?;
        let saved_searches = SearchRepository::list_saved_searches(connection)?.into_iter().map(serde_json::to_value).collect::<Result<Vec<_>,_>>()?;
        let category_schemas = Self::list_category_schemas(connection)?.into_iter().map(serde_json::to_value).collect::<Result<Vec<_>,_>>()?;
        let exported_at = Utc::now().to_rfc3339();
        let body = serde_json::json!({
            "format":"vault-intelligence-snapshot","version":1,"vaultId":vault_id,
            "revision":revision,"exportedAt":exported_at,
            "payload":{"items":items,"evidence":evidence,"suggestions":suggestions,"fieldState":field_state,"rules":rules,"savedSearches":saved_searches,"categorySchemas":category_schemas}
        });
        let checksum = json_checksum(&body)?;
        let mut envelope = body;
        envelope.as_object_mut().expect("snapshot is object").insert("checksum".into(), serde_json::Value::String(checksum));
        Ok(serde_json::to_string_pretty(&envelope)?)
    }

    pub fn import_mobile_changes(connection: &mut Connection, bundle_json: &str) -> Result<MobileImportResult, DatabaseError> {
        let mut envelope: serde_json::Value = serde_json::from_str(bundle_json)?;
        let object = envelope.as_object_mut().ok_or_else(|| DatabaseError::Validation("mobile bundle must be an object".into()))?;
        if object.get("format").and_then(|value| value.as_str()) != Some("vault-mobile-changes") || object.get("version").and_then(|value| value.as_i64()) != Some(1) {
            return Err(DatabaseError::Validation("unsupported mobile change bundle".into()));
        }
        let supplied_checksum = object.remove("checksum").and_then(|value| value.as_str().map(str::to_string)).ok_or_else(|| DatabaseError::Validation("mobile bundle checksum is required".into()))?;
        if json_checksum(&envelope)? != supplied_checksum { return Err(DatabaseError::Validation("mobile bundle checksum does not match".into())); }
        let vault_id = envelope.get("vaultId").and_then(|value| value.as_str()).unwrap_or_default();
        let current_vault: String = connection.query_row("SELECT vault_id FROM vault_identity WHERE singleton=1", [], |row| row.get(0))?;
        if vault_id != current_vault { return Err(DatabaseError::Validation("mobile bundle belongs to a different vault".into())); }
        let changes = envelope.get("changes").and_then(|value| value.as_array()).cloned().ok_or_else(|| DatabaseError::Validation("mobile bundle changes are malformed".into()))?;
        let mut ids = std::collections::HashSet::new();
        for change in &changes {
            let id = change.get("id").and_then(|value| value.as_str()).unwrap_or_default();
            if id.is_empty() || !ids.insert(id.to_string()) { return Err(DatabaseError::Validation("duplicate or empty mobile change id".into())); }
        }
        let transaction = connection.transaction()?;
        let mut applied = 0;
        let mut duplicates = 0;
        let mut conflicts = 0;
        for change in changes {
            let id = change.get("id").and_then(|value| value.as_str()).unwrap_or_default();
            let already_applied: i64 = transaction.query_row("SELECT count(*) FROM applied_mobile_changes WHERE change_id=?1", [id], |row| row.get(0))?;
            if already_applied > 0 { duplicates += 1; continue; }
            let kind = change.get("kind").and_then(|value| value.as_str()).unwrap_or_default();
            let record_id = change.get("recordId").and_then(|value| value.as_str()).unwrap_or_default();
            let value = change.get("value").cloned().unwrap_or_default();
            match kind {
                "suggestion-decision" => {
                    let action = value.get("action").and_then(|row| row.as_str()).unwrap_or_else(|| value.as_str().unwrap_or("reject"));
                    if action == "reject" {
                        transaction.execute("UPDATE field_suggestions SET status='rejected',verification_state='rejected',decided_at=?2 WHERE id=?1", params![record_id,Utc::now().to_rfc3339()])?;
                    } else {
                        let (item_id, field, proposed, protected): (String,String,String,Option<String>) = transaction.query_row(
                            "SELECT item_id,field_name,proposed_value,protected_value FROM field_suggestions WHERE id=?1", [record_id],
                            |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?,row.get(3)?)),
                        )?;
                        let final_value = value.get("value").and_then(|row| row.as_str()).unwrap_or(&proposed);
                        if protected.as_deref().is_some_and(|current| !current.eq_ignore_ascii_case(final_value)) {
                            conflicts += 1;
                        } else {
                            update_item_field(&transaction, &item_id, &field, final_value)?;
                            transaction.execute("UPDATE field_suggestions SET proposed_value=?2,status='accepted',verification_state='verified',decided_at=?3 WHERE id=?1", params![record_id,final_value,Utc::now().to_rfc3339()])?;
                            applied += 1;
                        }
                    }
                }
                "rule-edit" => {
                    let rule: CorrectionRuleRecord = serde_json::from_value(value)?;
                    validate_rule(&rule)?;
                    transaction.execute(
                        "INSERT INTO correction_rules(id,rule_kind,conditions_json,action_json,priority,evidence_count,enabled,explanation,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(id) DO UPDATE SET conditions_json=excluded.conditions_json,action_json=excluded.action_json,priority=excluded.priority,enabled=excluded.enabled,explanation=excluded.explanation,updated_at=excluded.updated_at",
                        params![rule.id,rule.rule_kind,rule.conditions_json,rule.action_json,rule.priority,rule.evidence_count,if rule.enabled{1}else{0},rule.explanation,rule.created_at,rule.updated_at],
                    )?;
                    applied += 1;
                }
                "saved-search" | "capture" => { applied += 1; }
                _ => { conflicts += 1; }
            }
            transaction.execute("INSERT INTO applied_mobile_changes(change_id,bundle_checksum,applied_at) VALUES(?1,?2,?3)", params![id,supplied_checksum,Utc::now().to_rfc3339()])?;
        }
        transaction.execute("UPDATE vault_identity SET intelligence_revision=intelligence_revision+1,updated_at=?1 WHERE singleton=1", [Utc::now().to_rfc3339()])?;
        let revision: i64 = transaction.query_row("SELECT intelligence_revision FROM vault_identity WHERE singleton=1", [], |row| row.get(0))?;
        transaction.commit()?;
        Ok(MobileImportResult { applied, duplicates, conflicts, revision })
    }
}

fn json_checksum(value: &serde_json::Value) -> Result<String, DatabaseError> {
    let bytes = serde_json::to_vec(value)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

pub struct SearchRepository;

impl SearchRepository {
    pub fn process_reindex_queue(connection: &mut Connection, limit: i64) -> Result<usize, DatabaseError> {
        let ids = {
            let mut statement = connection.prepare("SELECT item_id FROM search_reindex_queue ORDER BY requested_at LIMIT ?1")?;
            let rows = statement.query_map([limit.clamp(1, 1000)], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let mut processed = 0;
        for id in ids {
            if Self::reindex_item(connection, &id)? { processed += 1; }
        }
        Ok(processed)
    }

    pub fn reindex_item(connection: &mut Connection, item_id: &str) -> Result<bool, DatabaseError> {
        let transaction = connection.transaction()?;
        let item = transaction.query_row(
            "SELECT title,coalesce(description,''),coalesce(notes,''),coalesce(sku,''),coalesce(serial_number,''),coalesce(brand,''),coalesce(model,''),coalesce(edition,''),cast(coalesce(year,'') as text),category,condition,coalesce(storage_location_id,'') FROM items WHERE id=?1",
            [item_id],
            |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?,row.get::<_,String>(3)?,row.get::<_,String>(4)?,row.get::<_,String>(5)?,row.get::<_,String>(6)?,row.get::<_,String>(7)?,row.get::<_,String>(8)?,row.get::<_,String>(9)?,row.get::<_,String>(10)?,row.get::<_,String>(11)?)),
        ).optional()?;
        let Some((title,description,notes,sku,serial,brand,model,edition,year,category,condition,storage_id)) = item else {
            transaction.execute("DELETE FROM search_reindex_queue WHERE item_id=?1", [item_id])?;
            transaction.commit()?;
            return Ok(false);
        };
        let specifics: String = transaction.query_row(
            "SELECT coalesce(group_concat(key || ' ' || value, ' '),'') FROM item_specifics WHERE item_id=?1",
            [item_id], |row| row.get(0),
        )?;
        let ocr_text: String = transaction.query_row(
            "SELECT coalesce(group_concat(coalesce(raw_text,value), ' '),'') FROM scan_evidence WHERE item_id=?1",
            [item_id], |row| row.get(0),
        )?;
        let location: String = transaction.query_row(
            "SELECT coalesce((SELECT value FROM item_specifics WHERE item_id=?1 AND key='storagePath'), ?2)",
            params![item_id, storage_id], |row| row.get(0),
        )?;
        let identifiers = format!("{sku} {serial} {brand} {model} {edition} {year}");
        let now = Utc::now().to_rfc3339();
        transaction.execute(
            "INSERT INTO search_documents(item_id,title,description,ocr_text,identifiers,notes,specifics,category,condition_text,location,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(item_id) DO UPDATE SET title=excluded.title,description=excluded.description,ocr_text=excluded.ocr_text,identifiers=excluded.identifiers,notes=excluded.notes,specifics=excluded.specifics,category=excluded.category,condition_text=excluded.condition_text,location=excluded.location,updated_at=excluded.updated_at",
            params![item_id,title,description,ocr_text,identifiers,notes,specifics,category,condition,location,now],
        )?;
        transaction.execute("DELETE FROM search_documents_fts WHERE item_id=?1", [item_id])?;
        transaction.execute(
            "INSERT INTO search_documents_fts(item_id,title,description,ocr_text,identifiers,notes,specifics,category,condition_text,location) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![item_id,title,description,ocr_text,identifiers,notes,specifics,category,condition,location],
        )?;
        transaction.execute("DELETE FROM search_reindex_queue WHERE item_id=?1", [item_id])?;
        transaction.commit()?;
        Ok(true)
    }

    pub fn search_ids(connection: &Connection, request: IntelligentSearchRequest) -> Result<Vec<String>, DatabaseError> {
        let mut sql = String::from("SELECT DISTINCT i.id FROM items i JOIN search_documents d ON d.item_id=i.id WHERE 1=1");
        let mut values: Vec<Value> = Vec::new();
        if !request.fts_query.trim().is_empty() {
            sql.push_str(" AND i.id IN (SELECT item_id FROM search_documents_fts WHERE search_documents_fts MATCH ?)");
            values.push(request.fts_query.trim().to_string().into());
        }
        add_equal_filter(&mut sql, &mut values, "i.category", request.category);
        add_like_filter(&mut sql, &mut values, "d.specifics", request.color);
        add_equal_filter(&mut sql, &mut values, "i.brand", request.brand);
        if let (Some(operator), Some(value)) = (request.year_operator, request.year_value) {
            sql.push_str(&format!(" AND i.year {} ?", comparison_sql(&operator)?));
            values.push(value.into());
        }
        if let (Some(operator), Some(value)) = (request.value_operator, request.value_minor) {
            sql.push_str(&format!(" AND coalesce(i.median_amount_minor,0) {} ?", comparison_sql(&operator)?));
            values.push(value.into());
        }
        if let (Some(operator), Some(value)) = (request.quantity_operator, request.quantity_value) {
            sql.push_str(&format!(" AND i.quantity {} ?", comparison_sql(&operator)?));
            values.push(value.into());
        }
        add_equal_filter(&mut sql, &mut values, "i.status", request.status);
        add_like_filter(&mut sql, &mut values, "i.condition", request.condition);
        if let Some(location) = request.location {
            sql.push_str(" AND replace(replace(lower(d.location), '/', ' '), '  ', ' ') LIKE ?");
            values.push(format!("%{}%", location.to_lowercase().split_whitespace().collect::<Vec<_>>().join("%")) .into());
        }
        if let Some(listed) = request.listed {
            sql.push_str(if listed { " AND i.status='listed'" } else { " AND i.status<>'listed'" });
        }
        if request.missing_photos == Some(true) {
            sql.push_str(" AND NOT EXISTS(SELECT 1 FROM item_media im WHERE im.item_id=i.id) AND NOT EXISTS(SELECT 1 FROM item_photos ip WHERE ip.item_id=i.id) AND coalesce((SELECT value FROM item_specifics s WHERE s.item_id=i.id AND s.key='photos'),'[]')='[]'");
        }
        if request.review_needed == Some(true) {
            sql.push_str(" AND EXISTS(SELECT 1 FROM field_suggestions fs WHERE fs.item_id=i.id AND (fs.status='pending' OR fs.verification_state='flagged'))");
        }
        if request.unpriced == Some(true) {
            sql.push_str(" AND i.median_amount_minor IS NULL");
        }
        if request.unassigned == Some(true) {
            sql.push_str(" AND i.storage_location_id IS NULL AND coalesce((SELECT value FROM item_specifics s WHERE s.item_id=i.id AND s.key='storagePath'),'')=''");
        }
        if request.duplicate == Some(true) {
            sql.push_str(" AND EXISTS(SELECT 1 FROM item_photos ip JOIN duplicate_matches dm ON dm.photo_a_id=ip.id OR dm.photo_b_id=ip.id WHERE ip.item_id=i.id AND dm.status<>'dismissed')");
        }
        sql.push_str(" ORDER BY i.updated_at DESC LIMIT ?");
        values.push(request.limit.unwrap_or(200).clamp(1, 2000).into());
        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map(params_from_iter(values.iter()), |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }

    pub fn save_search(connection: &Connection, id: &str, name: &str, query_text: &str, parsed_json: &str, smart: bool) -> Result<(), DatabaseError> {
        let parsed_query = serde_json::from_str::<serde_json::Value>(parsed_json).map_err(|error| DatabaseError::Validation(error.to_string()))?;
        let query_json = serde_json::json!({
            "queryText": query_text,
            "parsedQuery": parsed_query,
            "isSmartCollection": smart
        }).to_string();
        let now = Utc::now().to_rfc3339();
        connection.execute(
            "INSERT INTO saved_searches(id,name,query_json,created_at,updated_at) VALUES(?1,?2,?3,?4,?4)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name,query_json=excluded.query_json,updated_at=excluded.updated_at",
            params![id,name,query_json,now],
        )?;
        Ok(())
    }

    pub fn record_search_history(connection: &Connection, id: &str, query_text: &str, parsed_json: &str, result_count: i64) -> Result<(), DatabaseError> {
        serde_json::from_str::<serde_json::Value>(parsed_json).map_err(|error| DatabaseError::Validation(error.to_string()))?;
        connection.execute(
            "INSERT INTO search_history(id,query_text,parsed_query_json,result_count,searched_at) VALUES(?1,?2,?3,?4,?5)",
            params![id,query_text,parsed_json,result_count,Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn list_saved_searches(connection: &Connection) -> Result<Vec<SavedSearchRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT id,name,query_json,created_at,updated_at FROM saved_searches ORDER BY name COLLATE NOCASE",
        )?;
        let rows = statement.query_map([], |row| Ok((
            row.get::<_,String>(0)?, row.get::<_,String>(1)?, row.get::<_,String>(2)?,
            row.get::<_,String>(3)?, row.get::<_,String>(4)?,
        )))?;
        let mut saved = Vec::new();
        for row in rows {
            let (id, name, query_json, created_at, updated_at) = row?;
            let envelope = serde_json::from_str::<serde_json::Value>(&query_json).unwrap_or_default();
            let query_text = envelope.get("queryText").and_then(|value| value.as_str()).unwrap_or_default().to_string();
            let parsed_query_json = envelope.get("parsedQuery").map(|value| value.to_string()).unwrap_or_else(|| query_json.clone());
            let is_smart_collection = envelope.get("isSmartCollection").and_then(|value| value.as_bool()).unwrap_or(false);
            saved.push(SavedSearchRecord { id, name, query_text, parsed_query_json, is_smart_collection, created_at, updated_at });
        }
        saved.sort_by(|left, right| right.is_smart_collection.cmp(&left.is_smart_collection).then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase())));
        Ok(saved)
    }

    pub fn list_search_history(connection: &Connection, limit: i64) -> Result<Vec<SearchHistoryRecord>, DatabaseError> {
        let mut statement = connection.prepare(
            "SELECT id,query_text,parsed_query_json,result_count,searched_at FROM search_history ORDER BY searched_at DESC LIMIT ?1",
        )?;
        let rows = statement.query_map([limit.clamp(1, 100)], |row| Ok(SearchHistoryRecord {
            id: row.get(0)?, query_text: row.get(1)?, parsed_query_json: row.get(2)?, result_count: row.get(3)?, searched_at: row.get(4)?,
        }))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DatabaseError::from)
    }
}

fn row_to_suggestion(row: &rusqlite::Row<'_>) -> rusqlite::Result<SuggestionRecord> {
    let evidence_json: String = row.get(6)?;
    let conflicts_json: String = row.get(7)?;
    let rules_json: String = row.get(8)?;
    Ok(SuggestionRecord {
        id: row.get(0)?, item_id: row.get(1)?, field_name: row.get(2)?, proposed_value: row.get(3)?, confidence: row.get(4)?, disposition: row.get(5)?,
        evidence_ids: serde_json::from_str(&evidence_json).unwrap_or_default(), conflicting_evidence_ids: serde_json::from_str(&conflicts_json).unwrap_or_default(),
        influenced_rule_ids: serde_json::from_str(&rules_json).unwrap_or_default(), verification_state: row.get(9)?, status: row.get(10)?, protected_value: row.get(11)?, created_at: row.get(12)?, decided_at: row.get(13)?,
    })
}

fn validate_rule(rule: &CorrectionRuleRecord) -> Result<(), DatabaseError> {
    const KINDS: [&str; 5] = ["alias", "category", "storage", "provider-route", "title-format"];
    if !KINDS.contains(&rule.rule_kind.as_str()) {
        return Err(DatabaseError::Validation(format!("invalid rule kind {}", rule.rule_kind)));
    }
    let conditions = serde_json::from_str::<serde_json::Value>(&rule.conditions_json)
        .map_err(|error| DatabaseError::Validation(error.to_string()))?;
    let action = serde_json::from_str::<serde_json::Value>(&rule.action_json)
        .map_err(|error| DatabaseError::Validation(error.to_string()))?;
    let field = conditions.get("field").and_then(|value| value.as_str()).unwrap_or_default().trim();
    let proposed = action.get("value").and_then(|value| value.as_str()).unwrap_or_default().trim();
    if field.is_empty() || proposed.is_empty() {
        return Err(DatabaseError::Validation("rule field and suggested value are required".into()));
    }
    if rule.rule_kind == "storage" {
        let category = conditions.get("category").and_then(|value| value.as_str()).unwrap_or_default().trim();
        if field != "storagePath" || category.is_empty() {
            return Err(DatabaseError::Validation("storage rules must target storagePath and include a category".into()));
        }
    } else if conditions.get("value").and_then(|value| value.as_str()).unwrap_or_default().trim().is_empty() {
        return Err(DatabaseError::Validation("non-storage rules require a condition value".into()));
    }
    Ok(())
}

fn record_learning_event(transaction: &Transaction<'_>, item_id: &str, suggestion_id: &str, field: &str, decision: &str, proposed: &str, final_value: Option<&str>, created_at: &str) -> Result<(), DatabaseError> {
    transaction.execute(
        "INSERT INTO learning_events(id,item_id,suggestion_id,field_name,decision,proposed_value,final_value,category,created_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,(SELECT category FROM items WHERE id=?2),?8)",
        params![Uuid::new_v4().to_string(),item_id,suggestion_id,field,decision,proposed,final_value,created_at],
    )?;
    if let Some(final_value) = final_value {
        let category: Option<String> = transaction.query_row("SELECT category FROM items WHERE id=?1", [item_id], |row| row.get(0)).optional()?;
        let count: i64 = transaction.query_row(
            "SELECT count(*) FROM learning_events WHERE field_name=?1 AND upper(trim(proposed_value))=upper(trim(?2)) AND upper(trim(final_value))=upper(trim(?3)) AND coalesce(category,'')=coalesce(?4,'') AND decision IN ('accepted','edited')",
            params![field, proposed, final_value, category.as_deref()],
            |row| row.get(0),
        )?;
        if count >= 2 && (field == "category" || !proposed.trim().eq_ignore_ascii_case(final_value.trim())) {
            let kind = match field {
                "category" => "category", "storagePath" => "storage", "pricingProvider" => "provider-route",
                "titleFormat" => "title-format", _ => "alias",
            };
            let conditions = if kind == "storage" {
                serde_json::json!({"field": field, "category": category.clone().unwrap_or_default()}).to_string()
            } else {
                serde_json::json!({"field": field, "value": proposed, "category": category}).to_string()
            };
            let action = serde_json::json!({"value": final_value}).to_string();
            let id = format!("rule:{kind}:{}:{}:{}:{}", rule_slug(field), rule_slug(category.as_deref().unwrap_or_default()), rule_slug(proposed), rule_slug(final_value));
            let explanation = format!("Replace or route “{proposed}” with “{final_value}” after {count} accepted corrections.");
            transaction.execute(
                "INSERT INTO correction_rules(id,rule_kind,conditions_json,action_json,priority,evidence_count,enabled,explanation,created_at,updated_at)
                 VALUES(?1,?2,?3,?4,100,?5,1,?6,?7,?7)
                 ON CONFLICT(id) DO UPDATE SET evidence_count=excluded.evidence_count,explanation=excluded.explanation,updated_at=excluded.updated_at",
                params![id,kind,conditions,action,count,explanation,created_at],
            )?;
        }
    }
    Ok(())
}

fn rule_slug(value: &str) -> String {
    let mut result = String::new();
    let mut separator = false;
    for character in value.chars().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            result.push(character);
            separator = false;
        } else if !separator && !result.is_empty() {
            result.push('-');
            separator = true;
        }
    }
    result.trim_matches('-').to_string()
}

fn update_item_field(transaction: &Transaction<'_>, item_id: &str, field: &str, value: &str) -> Result<(), DatabaseError> {
    let now = Utc::now().to_rfc3339();
    match field {
        "title" => transaction.execute("UPDATE items SET title=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "category" => transaction.execute("UPDATE items SET category=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "condition" => transaction.execute("UPDATE items SET condition=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "brand" => transaction.execute("UPDATE items SET brand=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "model" => transaction.execute("UPDATE items SET model=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "serialNumber" => transaction.execute("UPDATE items SET serial_number=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "sku" => transaction.execute("UPDATE items SET sku=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "edition" => transaction.execute("UPDATE items SET edition=?2,updated_at=?3 WHERE id=?1", params![item_id,value,now])?,
        "year" => {
            let parsed = value.parse::<i64>().map_err(|_| DatabaseError::Validation("year must be numeric".into()))?;
            transaction.execute("UPDATE items SET year=?2,updated_at=?3 WHERE id=?1", params![item_id,parsed,now])?
        }
        _ => transaction.execute(
            "INSERT INTO item_specifics(item_id,key,value) VALUES(?1,?2,?3) ON CONFLICT(item_id,key) DO UPDATE SET value=excluded.value",
            params![item_id,field,value],
        )?,
    };
    Ok(())
}

fn comparison_sql(operator: &str) -> Result<&'static str, DatabaseError> {
    match operator {
        "lt" => Ok("<"), "lte" => Ok("<="), "eq" => Ok("="), "gte" => Ok(">="), "gt" => Ok(">"),
        _ => Err(DatabaseError::Validation(format!("invalid comparison operator {operator}"))),
    }
}

fn add_equal_filter(sql: &mut String, values: &mut Vec<Value>, column: &str, value: Option<String>) {
    if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
        sql.push_str(&format!(" AND lower({column})=lower(?)"));
        values.push(value.into());
    }
}

fn add_like_filter(sql: &mut String, values: &mut Vec<Value>, column: &str, value: Option<String>) {
    if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
        sql.push_str(&format!(" AND lower({column}) LIKE lower(?)"));
        values.push(format!("%{value}%").into());
    }
}
