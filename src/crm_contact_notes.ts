import { CrmMutationError, type CrmMutationClient } from './crm_production_mutations';
import type { Activity } from './types';

export interface ContactNoteInput { requestKey: string; contactId: string; text: string }
export interface ContactNoteResult { activity: Omit<Activity,'user_id'> & {created_at: string}; replayed: boolean }
export function normalizeContactNote(text: string): string {
  const value = text.trim();
  const characters=[...value];
  if (!value || characters.length > 5000 || value.includes('\0')
    || characters.some(char=>char.length===1 && char.charCodeAt(0)>=0xD800 && char.charCodeAt(0)<=0xDFFF))
    throw new CrmMutationError('INVALID_INPUT','Enter a note of 1 to 5000 valid characters.');
  return value;
}
export async function createContactNote(client: CrmMutationClient, input: ContactNoteInput): Promise<ContactNoteResult> {
  const text = normalizeContactNote(input.text);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestKey) || !input.contactId || input.contactId.length > 200)
    throw new CrmMutationError('INVALID_INPUT','This contact is unavailable.');
  const result = await client.rpc('create_crm_contact_note',{p_request_key:input.requestKey,p_contact_id:input.contactId,p_note:text});
  if (result.error) {
    const code = (result.error as {code?:string}).code;
    if (code === '42501') throw new CrmMutationError('INVALID_INPUT','Note access changed. Reload this contact and try again.');
    if (code === '22023') throw new CrmMutationError('INVALID_INPUT','Enter a note of 1 to 5000 characters.');
    if (code === 'PGRST202' || code === '42883') throw new CrmMutationError('INVALID_INPUT','Note saving is temporarily unavailable. Keep the text and retry after refreshing this contact.');
    if (code === '23505' || code === '40001') throw new CrmMutationError('CONFLICT','This note request changed or its saved activity is unavailable. Reload and review the activity before starting another note.');
    throw new CrmMutationError('UNAVAILABLE');
  }
  const data = result.data as {activity?:Record<string,unknown>;replayed?:unknown} | null;
  const row = data?.activity;
  if (!row || typeof data?.replayed !== 'boolean' || typeof row.id !== 'string' || !row.id
    || row.contact_id !== input.contactId || row.type !== 'note' || row.description !== text
    || row.completed !== true || row.due_date !== null || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at)))
    throw new CrmMutationError('INVALID_RESPONSE');
  // Legacy Activity uses an empty string for absent dates. No due date is fabricated.
  return {activity:{id:row.id,contact_id:input.contactId,type:'note',description:text,due_date:'',completed:true,created_at:row.created_at},replayed:data.replayed};
}
