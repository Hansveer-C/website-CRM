const allowedOrigins=new Set(['http://127.0.0.1:4218','https://127.0.0.1:56429']);
const prohibited=/\/api\/(leads|sms|calls|messages|payments|emails|websites\/generate)|\/rpc\/(accept_crm_quote|create_invoice_from_accepted_quote|create_initial_website)/;
export function isLocalCrmQaUrl(value:string): boolean {
  try {const url=new URL(value);return allowedOrigins.has(url.origin) && !prohibited.test(url.pathname);}
  catch {return false;}
}
export function isLocalCrmQaBackendUrl(value:string,pathname:string): boolean {
  try {const url=new URL(value);return url.origin==='https://127.0.0.1:56429' && url.pathname===pathname && isLocalCrmQaUrl(value);}
  catch {return false;}
}
