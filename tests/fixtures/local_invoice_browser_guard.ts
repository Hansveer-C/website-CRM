import {isLocalCrmQaUrl as isLocalCrmQaUrlBase} from './local_crm_browser_guard';
// This additional mutating endpoint is permitted ONLY for the synthetic local invoice proof.
const invoicePath='/rest/v1/rpc/create_invoice_from_accepted_quote';
export function isLocalCrmQaUrl(value:string):boolean {
  if(isLocalCrmQaUrlBase(value))return true;
  try{const url=new URL(value);return url.origin==='https://127.0.0.1:56429' && url.pathname===invoicePath;}catch{return false;}
}
export function isLocalCrmQaBackendUrl(value:string,pathname:string):boolean {
  try{const url=new URL(value);return url.origin==='https://127.0.0.1:56429' && url.pathname===pathname && isLocalCrmQaUrl(value);}catch{return false;}
}
