use std::collections::BTreeMap;
use vault_catalogue_lib::db::{items::ItemRepository, models::{ItemDraft,SearchRequest}, open_database};

fn draft(title:&str)->ItemDraft { ItemDraft{id:None,title:title.into(),category:"cards".into(),subcategory:Some("Trading Card Games".into()),status:Some("private".into()),condition:"Near Mint".into(),condition_notes:None,description:Some("Private listing".into()),quantity:Some(1),sku:Some("CARD-1".into()),serial_number:None,brand:Some("Pokemon".into()),model:None,year:Some(1999),edition:Some("Shadowless".into()),purchase_price:None,median_value:None,suggested_price:None,minimum_price:None,storage_location_id:None,acquired_at:None,notes:None,specifics:BTreeMap::from([("cardNumber".into(),"#4".into())])} }

#[test]
fn creates_searches_updates_and_archives_items(){
 let mut connection=open_database(std::path::Path::new(":memory:")).unwrap();
 let created=ItemRepository::create(&mut connection,draft("Charizard Base Set")).unwrap();
 assert_eq!(created.specifics.get("cardNumber").map(String::as_str),Some("#4"));
 let found=ItemRepository::search(&connection,SearchRequest{query:"Charizard".into(),category:None,status:None,limit:None,offset:None}).unwrap();
 assert_eq!(found.len(),1);
 let mut changed=draft("Charizard Base Set Shadowless"); changed.sku=Some("CARD-2".into());
 let updated=ItemRepository::update(&mut connection,&created.id,changed).unwrap();
 assert!(updated.title.contains("Shadowless"));
 ItemRepository::archive(&connection,&created.id).unwrap();
 assert_eq!(ItemRepository::get(&connection,&created.id).unwrap().unwrap().status,"archived");
}
