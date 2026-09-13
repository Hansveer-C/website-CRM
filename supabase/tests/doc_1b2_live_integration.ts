import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createInvoiceDocumentPdfHandler } from '../../api/_lib/invoice_document_pdf_handler.js';
import { renderIssuedInvoicePdf } from '../../src/documents/issued_invoice_pdf.js';

const assert = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const statusResult = spawnSync(command, ['--yes', 'supabase@2.116.0', 'status', '-o', 'json'], { encoding: 'utf8' });
assert(statusResult.status === 0, 'local Supabase is not running');
const start = statusResult.stdout.indexOf('{');
const end = statusResult.stdout.lastIndexOf('}');
assert(start >= 0 && end > start, 'local Supabase status did not return JSON');
const status = JSON.parse(statusResult.stdout.slice(start, end + 1));
const api = new URL(status.API_URL);
assert(['127.0.0.1', 'localhost'].includes(api.hostname), 'DOC-1B2 live test must target localhost');
const publicKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
assert(publicKey && serviceKey, 'local Supabase credentials are unavailable');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(status.API_URL, serviceKey, options);
const anonymous = createClient(status.API_URL, publicKey, options);
const createdUsers: string[] = [];
const objectPaths = new Set<string>();
const suffix = randomUUID();
const password = `Local-${randomUUID()}-9a!`;
const contactId = randomUUID();
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function requireData<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function createTenant(email: string) {
  const user = await requireData(service.auth.admin.createUser({ email, password, email_confirm: true }), 'create auth user');
  assert(user.user, 'auth user was not returned');
  createdUsers.push(user.user.id);
  const client = createClient(status.API_URL, publicKey, options);
  const session = await requireData(client.auth.signInWithPassword({ email, password }), 'sign in');
  assert(session.session?.access_token, 'access token was not returned');
  return { id: user.user.id, client, token: session.session.access_token };
}

async function createSpec(tenant: Awaited<ReturnType<typeof createTenant>>, invoiceNumber: number) {
  const quoteId = randomUUID();
  const acceptanceId = randomUUID();
  const invoiceId = randomUUID();
  await requireData(service.from('quotes').insert({ id: quoteId, user_id: tenant.id, contact_id: contactId, request_key: randomUUID(), request_fingerprint: randomUUID(), status: 'approved', total_amount: 25, selected_tier: 'standard', revision: 2 }).select(), 'insert quote');
  await requireData(service.from('quote_acceptances').insert({ id: acceptanceId, user_id: tenant.id, quote_id: quoteId, quote_revision: 1, request_key: randomUUID(), request_fingerprint: randomUUID(), accepted_total_amount: 25, accepted_currency: 'USD', signer_name: 'Private Signature Evidence', actor_user_id: tenant.id, signature_kind: 'typed', accessible_declaration: true, quote_snapshot: { frozen: true } }).select(), 'insert acceptance');
  await requireData(service.from('invoices').insert({ id: invoiceId, user_id: tenant.id, contact_id: contactId, quote_id: quoteId, quote_acceptance_id: acceptanceId, source_quote_revision: 1, request_key: randomUUID(), request_fingerprint: randomUUID(), invoice_number: invoiceNumber, currency: 'USD', total_amount: 25, customer_name: 'José García', customer_email: 'customer@example.test', customer_phone: '555-0100', billing_address: '10 Montréal Way', due_at: '2026-09-15T00:00:00Z' }).select(), 'insert invoice');
  await requireData(service.from('invoice_items').insert([{ user_id: tenant.id, invoice_id: invoiceId, source_quote_item_order_index: 0, service_name: 'Exterior wash', description: 'Élite package', quantity: 1, unit_price: 10 }, { user_id: tenant.id, invoice_id: invoiceId, source_quote_item_order_index: 1, service_name: 'Interior wash', description: 'Long but bounded description', quantity: 1, unit_price: 15 }]).select(), 'insert invoice items');
  const result = await requireData(tenant.client.rpc('create_issued_invoice_document_spec', { p_invoice_id: invoiceId, p_request_key: randomUUID() }), 'create frozen document spec');
  return result.document as { id: string; specification: { issuer: Record<string, unknown>; invoice: Record<string, unknown>; items: Array<Record<string, unknown>> } };
}

async function invoke(token: string, specId: string) {
  const handler = createInvoiceDocumentPdfHandler({ SUPABASE_URL: status.API_URL, SUPABASE_PUBLISHABLE_KEY: publicKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey });
  const response = await handler(new Request('http://localhost/api/invoices/documents/pdf', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ document_spec_id: specId }) }));
  return { response, body: await response.json() };
}

async function main() {
  const tenantA = await createTenant(`doc-a-${suffix}@example.test`);
  const tenantB = await createTenant(`doc-b-${suffix}@example.test`);
  await requireData(service.from('contacts').insert({ id: contactId, user_id: tenantA.id, name: 'Mutable Customer', email: 'mutable@example.test', address: 'Mutable Address' }).select(), 'insert contact');
  await requireData(service.from('tenant_business_identities').insert({ user_id: tenantA.id, business_name: 'Café WashOps', phone: '555-0199', email: 'billing@example.test' }).select(), 'insert identity');

  const canonical = await createSpec(tenantA, 1001);
  const expectedBytes = await renderIssuedInvoicePdf(canonical.specification);
  await requireData(service.from('contacts').update({ name: 'Changed Current Customer' }).eq('id', contactId).select(), 'mutate current contact');
  await requireData(service.from('tenant_business_identities').update({ business_name: 'Changed Current Issuer' }).eq('user_id', tenantA.id).select(), 'mutate current issuer');
  await requireData(service.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: tenantA.id, p_document_spec_id: canonical.id }), 'probe server claim');
  const first = await invoke(tenantA.token, canonical.id);
  assert(first.response.status === 201, `initial handler call failed (${first.response.status}: ${JSON.stringify(first.body)})`);
  assert(first.body.artifact.status === 'ready', 'artifact did not become ready');
  assert(first.body.artifact.object_path === `${tenantA.id}/invoice-document-spec/${canonical.id}.pdf`, 'object path is not deterministic');
  objectPaths.add(first.body.artifact.object_path);
  const stored = await requireData(service.storage.from('commercial-documents').download(first.body.artifact.object_path), 'download canonical PDF');
  const storedBytes = new Uint8Array(await stored.arrayBuffer());
  assert(Buffer.from(storedBytes).subarray(0, 5).toString() === '%PDF-', 'stored artifact is not a PDF');
  assert(Buffer.compare(Buffer.from(storedBytes), Buffer.from(expectedBytes)) === 0, 'stored bytes differ from frozen-spec render');
  assert(first.body.artifact.sha256 === sha256(storedBytes), 'artifact SHA-256 does not match stored bytes');
  assert(first.body.artifact.byte_size === storedBytes.byteLength, 'artifact byte size does not match stored bytes');
  assert(!Buffer.from(storedBytes).includes(Buffer.from('Private Signature Evidence')), 'acceptance signature evidence leaked into PDF');

  const replay = await invoke(tenantA.token, canonical.id);
  assert(replay.response.status === 200 && replay.body.replayed === true && replay.body.artifact.id === first.body.artifact.id, 'completed retry was not idempotent');
  const rows = await requireData(service.from('invoice_document_artifacts').select('id').eq('invoice_document_spec_id', canonical.id), 'read artifact rows');
  assert(rows.length === 1, 'duplicate canonical artifact metadata was created');

  const anonRead = await anonymous.from('invoice_document_artifacts').select('*');
  assert(anonRead.error, 'anonymous artifact-table access was not denied');
  const crossRead = await tenantB.client.from('invoice_document_artifacts').select('*').eq('id', first.body.artifact.id);
  assert(crossRead.error, 'cross-tenant artifact-table access was not denied');
  const browserWrite = await tenantA.client.from('invoice_document_artifacts').update({ status: 'ready' }).eq('id', first.body.artifact.id);
  assert(browserWrite.error, 'authenticated browser artifact mutation was not denied');
  const browserClaim = await tenantA.client.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: tenantA.id, p_document_spec_id: canonical.id });
  assert(browserClaim.error, 'authenticated browser claim RPC was not denied');
  const browserUpload = await tenantA.client.storage.from('commercial-documents').upload(`blocked-${suffix}.pdf`, expectedBytes, { contentType: 'application/pdf', upsert: false });
  assert(browserUpload.error, 'authenticated browser canonical upload was not denied');
  const crossDownload = await tenantB.client.storage.from('commercial-documents').download(first.body.artifact.object_path);
  assert(crossDownload.error, 'cross-tenant Storage read was not denied');
  const publicUrl = service.storage.from('commercial-documents').getPublicUrl(first.body.artifact.object_path).data.publicUrl;
  assert(!(await fetch(publicUrl)).ok, 'public URL exposed the private PDF');

  const pending = await createSpec(tenantA, 1002);
  const pendingClaims = await Promise.all([
    requireData(service.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: tenantA.id, p_document_spec_id: pending.id }), 'claim pending artifact A'),
    requireData(service.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: tenantA.id, p_document_spec_id: pending.id }), 'claim pending artifact B'),
  ]);
  assert(pendingClaims[0].id === pendingClaims[1].id, 'concurrent claims created conflicting artifacts');
  const pendingClaim = pendingClaims[0];
  const deniedUpload = await tenantA.client.storage.from('commercial-documents').upload(pendingClaim.object_path, expectedBytes, { contentType: 'application/pdf', upsert: false });
  assert(deniedUpload.error, 'simulated failed upload unexpectedly succeeded');
  const pendingRow = await requireData(service.from('invoice_document_artifacts').select('status').eq('id', pendingClaim.id).single(), 'read pending artifact');
  assert(pendingRow.status === 'pending', 'failed upload produced a false ready state');

  const orphan = await createSpec(tenantA, 1003);
  const orphanClaim = await requireData(service.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: tenantA.id, p_document_spec_id: orphan.id }), 'claim orphan artifact');
  const orphanBytes = await renderIssuedInvoicePdf(orphan.specification);
  await requireData(service.storage.from('commercial-documents').upload(orphanClaim.object_path, orphanBytes, { contentType: 'application/pdf', upsert: false }), 'upload orphan bytes');
  objectPaths.add(orphanClaim.object_path);
  const recovered = await invoke(tenantA.token, orphan.id);
  assert(recovered.response.status === 201 && recovered.body.artifact.status === 'ready', 'orphan retry did not safely converge');

  const collision = await createSpec(tenantA, 1004);
  const collisionClaim = await requireData(service.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: tenantA.id, p_document_spec_id: collision.id }), 'claim collision artifact');
  const unrelated = new TextEncoder().encode('%PDF-1.4\n% unrelated bytes\n%%EOF\n');
  await requireData(service.storage.from('commercial-documents').upload(collisionClaim.object_path, unrelated, { contentType: 'application/pdf', upsert: false }), 'upload collision bytes');
  objectPaths.add(collisionClaim.object_path);
  const conflict = await invoke(tenantA.token, collision.id);
  assert(conflict.response.status === 409 && conflict.body.error === 'ARTIFACT_INTEGRITY_CONFLICT', 'unexpected object collision did not fail closed');
  const collisionRow = await requireData(service.from('invoice_document_artifacts').select('status').eq('id', collisionClaim.id).single(), 'read collision artifact');
  assert(collisionRow.status === 'pending', 'collision produced a false ready artifact');

  const bucket = await requireData(service.storage.getBucket('commercial-documents'), 'read commercial-documents bucket');
  assert(bucket.public === false, 'commercial-documents bucket is public');
  console.log('DOC-1B2 live DB/RLS/Storage/artifact lifecycle: pass');
}

main().finally(async () => {
  if (objectPaths.size) await service.storage.from('commercial-documents').remove([...objectPaths]);
  if (createdUsers.length) for (const id of createdUsers) await service.auth.admin.deleteUser(id);
}).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
