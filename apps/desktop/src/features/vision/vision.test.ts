import {describe,expect,it} from 'vitest';
import {inferFields} from '@vault/domain';
describe('inferFields',()=>{
 it('extracts model serial and year',()=>{const f=inferFields('Sony Receiver\nMODEL STR-DH590\nSERIAL: ABC12345\n2018');expect(f.find(x=>x.field==='model')?.value).toBe('STR-DH590');expect(f.find(x=>x.field==='serialNumber')?.value).toBe('ABC12345');expect(f.find(x=>x.field==='year')?.value).toBe('2018')});
 it('extracts VIN',()=>{expect(inferFields('1HGCM82633A004352').find(x=>x.field==='vin')?.value).toBe('1HGCM82633A004352')});
});
