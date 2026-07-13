export type OcrField = { field: string; value: string; confidence: number; verified?: boolean };
export type VisionResult = { rawText: string; fields: OcrField[]; barcodes: string[]; engine: string };

const first = (text:string, re:RegExp) => text.match(re)?.[1]?.trim() ?? '';
export function inferFields(rawText:string): OcrField[] {
  const text=rawText.replace(/\r/g,'');
  const lines=text.split('\n').map(v=>v.trim()).filter(Boolean);
  const fields:OcrField[]=[];
  const year=first(text,/\b((?:19|20)\d{2})\b/);
  const isbn=first(text,/\b(?:ISBN(?:-1[03])?[: ]*)?((?:97[89][ -]?)?\d[\d -]{8,16}[\dX])\b/i).replace(/[ -]/g,'');
  const vin=first(text,/\b([A-HJ-NPR-Z0-9]{17})\b/i).toUpperCase();
  const card=first(text,/\b(?:#|NO\.?\s*)([A-Z0-9-]{1,12})\b/i);
  const serial=first(text,/\b(?:S\/?N|SERIAL(?: NUMBER)?)[\s:#-]*([A-Z0-9-]{4,32})\b/i);
  const model=first(text,/\bMODEL[\s:#-]*([A-Z0-9._/-]{2,32})\b/i);
  if(lines[0]) fields.push({field:'title',value:lines[0],confidence:.62});
  if(year) fields.push({field:'year',value:year,confidence:.9});
  if(isbn.length in [10,13]) fields.push({field:'isbn',value:isbn,confidence:.95});
  if(vin) fields.push({field:'vin',value:vin,confidence:.98});
  if(card) fields.push({field:'cardNumber',value:card,confidence:.8});
  if(serial) fields.push({field:'serialNumber',value:serial,confidence:.9});
  if(model) fields.push({field:'model',value:model,confidence:.86});
  return fields;
}
