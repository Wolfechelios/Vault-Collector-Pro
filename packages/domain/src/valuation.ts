export type Comparable = { id:string; provider:string; title:string; soldAmountMinor:number; soldAt?:string|null; url?:string|null; included?:boolean; exclusionReason?:string|null };
export type ValuationSummary = { medianMinor:number; lowMinor:number; highMinor:number; sampleCount:number; included:Comparable[]; excluded:Comparable[]; confidence:number };
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)};
export function calculateValuation(rows:Comparable[]):ValuationSummary{
 const positive=rows.filter(r=>Number.isFinite(r.soldAmountMinor)&&r.soldAmountMinor>0);
 if(!positive.length)return{medianMinor:0,lowMinor:0,highMinor:0,sampleCount:0,included:[],excluded:rows.map(r=>({...r,included:false,exclusionReason:'Invalid price'})),confidence:0};
 const base=median(positive.map(r=>r.soldAmountMinor));
 const lo=base*.35,hi=base*2.85;
 const included=positive.filter(r=>r.soldAmountMinor>=lo&&r.soldAmountMinor<=hi).map(r=>({...r,included:true,exclusionReason:null}));
 const excluded=rows.filter(r=>!included.some(i=>i.id===r.id)).map(r=>({...r,included:false,exclusionReason:r.exclusionReason??'Statistical outlier'}));
 const vals=included.map(r=>r.soldAmountMinor).sort((a,b)=>a-b);
 const med=vals.length?median(vals):base;
 const q=(p:number)=>vals[Math.min(vals.length-1,Math.max(0,Math.floor((vals.length-1)*p)))]??med;
 const sources=new Set(included.map(r=>r.provider)).size;
 const confidence=Math.min(.99,Math.max(.1,(included.length/10)*.65+(sources/3)*.25+.1));
 return{medianMinor:med,lowMinor:q(.15),highMinor:q(.85),sampleCount:included.length,included,excluded,confidence:Number(confidence.toFixed(2))};
}
