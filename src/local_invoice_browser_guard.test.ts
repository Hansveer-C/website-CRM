import {describe,it,expect} from 'vitest';
import {isLocalCrmQaUrl,isLocalCrmQaBackendUrl} from '../tests/fixtures/local_invoice_browser_guard';
describe('synthetic local invoice browser traffic guard',()=>{
 it('allows only the explicit loopback invoice RPC in addition to existing review paths',()=>{
  const path='/rest/v1/rpc/create_invoice_from_accepted_quote';
  expect(isLocalCrmQaBackendUrl('https://127.0.0.1:56429'+path,path)).toBe(true);
  for(const origin of ['https://example.supabase.co','https://127.0.0.1.evil:56429','http://127.0.0.1:56429'])expect(isLocalCrmQaUrl(origin+path)).toBe(false);
  for(const url of ['https://127.0.0.1:56429/rest/v1/rpc/accept_crm_quote','http://127.0.0.1:4218/api/sms','http://127.0.0.1:4218/api/payments','http://127.0.0.1:4218/api/websites/generate'])expect(isLocalCrmQaUrl(url)).toBe(false);
 });
});
