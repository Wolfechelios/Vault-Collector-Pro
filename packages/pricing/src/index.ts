export type SaleComparable={id:string;provider:string;title:string;soldAmountMinor:number;shippingMinor?:number;soldAt?:string|null;condition?:string|null;url?:string|null;quantity?:number;included?:boolean;exclusionReason?:string|null;matchScore?:number};
export type PricingContext={query:string;condition?:string|null;now?:Date};
export type PricingSummary={medianMinor:number;weightedMedianMinor:number;lowMinor:number;highMinor:number;sampleCount:number;included:SaleComparable[];excluded:SaleComparable[];confidence:number;providers:string[]};
const tokens=(s:string)=>new Set(s.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(v=>v.length>1));
export function titleMatchScore(query:string,title:string){const a=tokens(query),b=tokens(title);if(!a.size||!b.size)return 0;let hit=0;for(const t of a)if(b.has(t))hit++;return hit/a.size}
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)};
const quantile=(xs:number[],p:number)=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.max(0,Math.floor((s.length-1)*p)))]??0};
function weightedMedian(rows:{value:number;weight:number}[]){const s=[...rows].sort((a,b)=>a.value-b.value);const total=s.reduce((n,r)=>n+r.weight,0);let n=0;for(const r of s){n+=r.weight;if(n>=total/2)return r.value}return s.at(-1)?.value??0}
export function calculatePricing(rows:SaleComparable[],ctx:PricingContext):PricingSummary{
 const now=ctx.now??new Date();const prepared=rows.map(r=>{const total=r.soldAmountMinor+(r.shippingMinor??0);const match=titleMatchScore(ctx.query,r.title);const ageDays=r.soldAt?Math.max(0,(now.getTime()-new Date(r.soldAt).getTime())/86400000):90;const recency=Math.max(.35,1-Math.min(ageDays,730)/1000);return{...r,soldAmountMinor:total,matchScore:match,_weight:Math.max(.05,match*recency)}});
 const initial=prepared.filter(r=>Number.isFinite(r.soldAmountMinor)&&r.soldAmountMinor>0&&(r.quantity??1)===1&&(r.matchScore??0)>=.45);
 if(!initial.length)return{medianMinor:0,weightedMedianMinor:0,lowMinor:0,highMinor:0,sampleCount:0,included:[],excluded:prepared.map(({_weight,...r})=>({...r,included:false,exclusionReason:r.exclusionReason??'Invalid, lot, or weak title match'})),confidence:0,providers:[]};
 const vals=initial.map(r=>r.soldAmountMinor),q1=quantile(vals,.25),q3=quantile(vals,.75),iqr=q3-q1,lo=Math.max(1,q1-1.5*iqr),hi=q3+1.5*iqr;
 const good=initial.length<4?initial:initial.filter(r=>r.soldAmountMinor>=lo&&r.soldAmountMinor<=hi);const ids=new Set(good.map(r=>r.id));
 const included=good.map(({_weight,...r})=>({...r,included:true,exclusionReason:null}));
 const excluded=prepared.filter(r=>!ids.has(r.id)).map(({_weight,...r})=>({...r,included:false,exclusionReason:r.exclusionReason??((r.matchScore??0)<.45?'Weak title match':(r.quantity??1)>1?'Multi-item lot':'Statistical outlier')}));
 const prices=good.map(r=>r.soldAmountMinor);const providers=[...new Set(good.map(r=>r.provider))];const avgMatch=good.reduce((n,r)=>n+(r.matchScore??0),0)/good.length;
 const confidence=Math.min(.99,Number((.12+Math.min(good.length,12)/12*.48+Math.min(providers.length,3)/3*.2+avgMatch*.2).toFixed(2)));
 return{medianMinor:median(prices),weightedMedianMinor:weightedMedian(good.map(r=>({value:r.soldAmountMinor,weight:r._weight}))),lowMinor:quantile(prices,.15),highMinor:quantile(prices,.85),sampleCount:good.length,included,excluded,confidence,providers};
}
