import { normalizeContactNote, type ContactNoteInput } from '../../crm_contact_notes';
const prefix='washops:contact-note:1:';
/** Same-tab interrupted requests only, never credentials. Clear on verified sign-out/account change. */
export function contactNoteStorage(): Storage | undefined {try {return window.sessionStorage;} catch {return undefined;}}
export function contactNoteAttempt(storage: Storage | undefined, owner: string, contactId: string) {
  const key=prefix+JSON.stringify([owner,contactId]);
  return {
    restore(): ContactNoteInput | null {
      try {
        const value=JSON.parse(storage?.getItem(key) ?? 'null');
        if (!value || value.contactId!==contactId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestKey)
          || typeof value.text!=='string' || normalizeContactNote(value.text)!==value.text) return null;
        return {requestKey:value.requestKey,contactId,text:value.text};
      } catch { return null; }
    },
    remember(input: ContactNoteInput) {
      try { if (!storage) throw new Error();storage.setItem(key,JSON.stringify(input)); }
      catch { throw new Error('This browser could not preserve a safe retry. No note was sent. Enable session storage before saving.'); }
    },
    forget(input?: ContactNoteInput) {
      try { if (input && JSON.parse(storage?.getItem(key) ?? 'null')?.requestKey===input.requestKey) storage?.removeItem(key); }
      catch { /* A stale key can only replay the same request. */ }
    }
  };
}
export function clearContactNoteAttempts(storage: Storage | undefined, keepOwner?: string) {
  if (!storage) return;
  try {
    const keys=Array.from({length:storage.length},(_,index)=>storage.key(index));
    for (const key of keys) {
      if (!key?.startsWith(prefix)) continue;
      let keep=false;
      try { keep=!!keepOwner && JSON.parse(key.slice(prefix.length))[0]===keepOwner; } catch { /* Remove malformed own-namespace entry. */ }
      if (!keep) storage.removeItem(key);
    }
  } catch { /* Storage unavailable: save itself fails closed before RPC. */ }
}
