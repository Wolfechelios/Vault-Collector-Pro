export type VaultBackup<T>={format:'vault-backup';version:2;exportedAt:string;checksum:string;items:T[]};
function fnv1a(text:string){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(16).padStart(8,'0')}
export function createBackup<T>(items:T[]):VaultBackup<T>{const exportedAt=new Date().toISOString();const body=JSON.stringify({version:2,exportedAt,items});return{format:'vault-backup',version:2,exportedAt,checksum:fnv1a(body),items}}
export function verifyBackup<T>(backup:VaultBackup<T>):boolean{if(backup.format!=='vault-backup'||backup.version!==2||!Array.isArray(backup.items))return false;const body=JSON.stringify({version:2,exportedAt:backup.exportedAt,items:backup.items});return fnv1a(body)===backup.checksum}
