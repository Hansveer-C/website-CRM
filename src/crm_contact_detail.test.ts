import { describe, it, expect } from 'vitest';
import { resolveHydratedContact, renderHydratedContactActivity } from './crm_contact_detail';
import type { Contact, Activity } from './types';

const contact = { id:'c1', user_id:'owner', name:'Synthetic' } as Contact;
describe('authenticated contact detail reads', () => {
  it('uses the owned list data and denies foreign or missing contacts', () => {
    expect(resolveHydratedContact('owner','owner',true,[contact],'c1')).toEqual({status:'ready',contact});
    expect(resolveHydratedContact('other','other',true,[contact],'c1').status).toBe('missing');
    expect(resolveHydratedContact('owner','owner',true,[contact],'missing').status).toBe('missing');
  });
  it('fails closed on unavailable data or an account transition', () => {
    for (const args of [['owner','owner',false],['other','owner',true],['','',true]] as const)
      expect(resolveHydratedContact(...args,[contact],'c1').status).toBe('unavailable');
  });
  it('distinguishes empty activity from unavailable activity', () => {
    expect(renderHydratedContactActivity('owner','c1',true,[])).toContain('No activities recorded.');
    expect(renderHydratedContactActivity('owner','c1',false,[])).toContain('could not be loaded');
  });
  it('handles nullable or absent due dates without inventing chronology', () => {
    const items = [{id:'b',user_id:'owner',contact_id:'c1',description:'second',due_date:null},
      {id:'a',user_id:'owner',contact_id:'c1',description:'first'}] as unknown as Activity[];
    const html = renderHydratedContactActivity('owner','c1',true,items);
    expect(html.match(/No due date/g)).toHaveLength(2);
    expect(html.indexOf('first')).toBeLessThan(html.indexOf('second'));
    expect(renderHydratedContactActivity('','c1',true,items)).not.toContain('first');
  });
  it('filters both owner and contact, escapes content and orders deterministically', () => {
    const activity = {id:'a',user_id:'owner',contact_id:'c1',description:'<img src=x>',due_date:'2026-10-21'} as Activity;
    const html = renderHydratedContactActivity('owner','c1',true,[activity,
      {...activity,id:'foreign',user_id:'other',description:'PRIVATE'},
      {...activity,id:'unrelated',contact_id:'c2',description:'UNRELATED'},
      {...activity,id:'b',description:'newer',due_date:'2026-10-22'}]);
    expect(html).not.toContain('PRIVATE'); expect(html).not.toContain('UNRELATED');
    expect(html).toContain('&lt;img src=x&gt;'); expect(html.indexOf('newer')).toBeLessThan(html.indexOf('&lt;img'));
  });
});
