import React from 'react';
import { MobileIntelligenceRepository } from './data/mobileIntelligenceDb';
import { MobileCapture } from './features/capture/MobileCapture';
import { BundleExchange } from './features/exchange/BundleExchange';
import { MobileScanReview } from './features/review/MobileScanReview';
import { MobileCollections, MobileSearch } from './features/search/MobileSearch';
import { MobileRules } from './features/rules/MobileRules';
import './styles.css';

type Tab='capture'|'review'|'search'|'collections'|'rules';
const repository=new MobileIntelligenceRepository();
const download=(name:string,value:string)=>{const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();URL.revokeObjectURL(url)};
export function MobileApp({initialTab='capture'}:{initialTab?:Tab}) { const[tab,setTab]=React.useState<Tab>(initialTab);const[items,setItems]=React.useState<any[]>([]);const[suggestions,setSuggestions]=React.useState<any[]>([]);const[evidence,setEvidence]=React.useState<any[]>([]);const[rules,setRules]=React.useState<any[]>([]);const[status,setStatus]=React.useState('Ready offline');
  const refresh=React.useCallback(async()=>{if(typeof indexedDB==='undefined')return;setItems(await repository.listItems());setSuggestions(await repository.listSuggestions());setEvidence(await repository.listEvidence());setRules(await repository.listRules());},[]);
  React.useEffect(()=>{void refresh()},[refresh]);
  async function append(kind:any,recordId:string,value:any){const meta=await repository.getSnapshotMeta();if(!meta){setStatus('Import a desktop snapshot first');return;}await repository.appendChange({id:`mobile:${kind}:${recordId}:${Date.now()}`,kind,recordId,value,baseFingerprint:'',createdAt:new Date().toISOString()});setStatus('Change saved offline');}
  async function importBundle(bundle:any){try{await repository.importSnapshot(bundle);await refresh();setStatus(`Imported revision ${bundle.revision} · ${bundle.payload.items.length} items`)}catch(error){setStatus(`Import rejected: ${String(error)}`)}}
  async function exportBundle(){try{const bundle=await repository.exportChanges();download(`vault-mobile-changes-${Date.now()}.json`,JSON.stringify(bundle,null,2));setStatus(`Exported ${bundle.changes.length} change(s)`)}catch(error){setStatus(String(error))}}
  return <main><header className="top"><p className="eyebrow">WOLFEVAULT MOBILE INTELLIGENCE</p><h1>Your vault, offline</h1><BundleExchange onImport={importBundle} onExport={exportBundle} status={status}/></header><div className="workspace">
    {tab==='capture'&&<MobileCapture onCapture={value=>void append('capture',`capture-${Date.now()}`,value)}/>} 
    {tab==='review'&&<MobileScanReview suggestions={suggestions} evidence={evidence} onDecision={(id,action,value)=>void append('suggestion-decision',id,{action,value})}/>} 
    {tab==='search'&&<MobileSearch items={items} onSave={query=>void append('saved-search',`search-${Date.now()}`,{query})}/>} 
    {tab==='collections'&&<MobileCollections items={items} suggestions={suggestions}/>} 
    {tab==='rules'&&<MobileRules rules={rules} onChange={rule=>void append(rule._operation==='delete'?'rule-delete':'rule-edit',rule.id,rule)}/>}
  </div><nav className="tabs">{(['capture','review','search','collections','rules'] as Tab[]).map(name=><button key={name} aria-current={tab===name?'page':undefined} onClick={()=>setTab(name)}>{name[0].toUpperCase()+name.slice(1)}</button>)}</nav></main>;
}
