export type VisionField={field:string;value:string;confidence:number;source?:string};
export type VisionCandidate={rawText:string;fields:VisionField[];barcodes:string[];engine:string;warnings:string[]};
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
const first=(text:string,re:RegExp)=>clean(text.match(re)?.[1]??'');
const push=(rows:VisionField[],field:string,value:string,confidence:number,source='ocr')=>{if(value&&!rows.some(r=>r.field===field&&r.value===value))rows.push({field,value,confidence,source})};
export function normalizeBarcode(value:string){return value.replace(/[^0-9A-Z]/gi,'').toUpperCase()}
export function parseVisionText(rawText:string,barcodes:string[]=[]):VisionCandidate{
 const text=rawText.replace(/\r/g,'');const lines=text.split('\n').map(clean).filter(Boolean);const fields:VisionField[]=[];const warnings:string[]=[];
 const year=first(text,/\b((?:18|19|20)\d{2})\b/);
 const isbn=first(text,/\b(?:ISBN(?:-1[03])?[: ]*)?((?:97[89][ -]?)?\d[\d -]{8,16}[\dX])\b/i).replace(/[ -]/g,'');
 const vin=first(text,/\b([A-HJ-NPR-Z0-9]{17})\b/i).toUpperCase();
 const serial=first(text,/\b(?:S\/?N|SERIAL(?: NUMBER)?|SN)[\s:#-]*([A-Z0-9-]{4,32})\b/i);
 const model=first(text,/\b(?:MODEL|MOD(?:EL)?\.?)[\s:#-]*([A-Z0-9._\/-]{2,32})\b/i);
 const card=first(text,/\b(?:#|NO\.?\s*)([A-Z0-9-]{1,16})\b/i);
 const size=first(text,/\b(?:SIZE|SZ)\s*[:#-]?\s*([A-Z0-9.\/-]{1,12})\b/i);
 const upc=barcodes.map(normalizeBarcode).find(v=>/^\d{12}$/.test(v));
 const ean=barcodes.map(normalizeBarcode).find(v=>/^\d{13}$/.test(v));
 if(lines[0])push(fields,'title',lines.slice(0,2).join(' — ').slice(0,120),.66);
 push(fields,'year',year,.92);push(fields,'isbn',isbn,[10,13].includes(isbn.length)?.98:0);push(fields,'vin',vin,.99);
 push(fields,'serialNumber',serial,.93);push(fields,'model',model,.9);push(fields,'cardNumber',card,.84);push(fields,'size',size,.82);
 push(fields,'upc',upc??'',.99,'barcode');push(fields,'ean',ean??'',.99,'barcode');
 if(vin&&vin.length!==17)warnings.push('VIN candidate is not 17 characters');
 if(isbn&&![10,13].includes(isbn.length))warnings.push('ISBN candidate failed length validation');
 if(lines.length>0&&fields.length===1)warnings.push('OCR text found, but identifiers need manual review');
 return{rawText:text,fields,barcodes:barcodes.map(normalizeBarcode),engine:'Vault Vision parser',warnings};
}
export function mergeVisionCandidates(candidates:VisionCandidate[]):VisionCandidate{
 const scored=new Map<string,VisionField>();
 for(const c of candidates)for(const f of c.fields){const key=f.field;const prior=scored.get(key);if(!prior||f.confidence>prior.confidence)scored.set(key,f)}
 return{rawText:candidates.map(c=>c.rawText).filter(Boolean).join('\n---\n'),fields:[...scored.values()],barcodes:[...new Set(candidates.flatMap(c=>c.barcodes))],engine:[...new Set(candidates.map(c=>c.engine))].join(' + '),warnings:[...new Set(candidates.flatMap(c=>c.warnings))]};
}
export function listingTitle(fields:Record<string,string>,fallback='Untitled item'){
 return clean([fields.brand,fields.model,fields.name||fields.title,fields.year,fields.edition,fields.cardNumber&&`#${fields.cardNumber}`,fields.size&&`Size ${fields.size}`].filter(Boolean).join(' ')).slice(0,80)||fallback;
}
