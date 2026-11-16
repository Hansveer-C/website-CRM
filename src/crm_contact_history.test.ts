import { describe, expect, it } from 'vitest';
import { loadContactCommunicationHistory, renderContactCommunicationHistory, renderContactCommunicationHistoryError, renderContactHistoryTimeline } from './crm_contact_history';
import { renderHydratedContactActivity } from './crm_contact_detail';
import type { Activity } from './types';

function client(rows: Record<string, unknown[]>, failures: string[] = []) {
  const calls: Array<{ table: string; filters: Array<[string, string]>; limit?: number }> = [];
  return { calls, from(table: string) {
    const call = { table, filters: [] as Array<[string, string]>, limit: undefined as number | undefined }; calls.push(call);
    const chain: any = {
      select() { return chain; }, eq(column: string, value: string) { call.filters.push([column, value]); return chain; },
      order() { return chain; }, limit(value: number) { call.limit = value; return chain; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: rows[table] ?? [], error: failures.includes(table) ? new Error('failed') : null })); }
    };
    return chain;
  }};
}

const message = { id:'m1', user_id:'owner', contact_id:'contact', direction:'inbound', content:'<script>private</script>', status:'received', created_at:'2026-11-12T10:00:00Z' };
const call = { id:'c1', user_id:'owner', contact_id:'contact', direction:'outbound', status:'completed', duration:61, created_at:'2026-11-12T11:00:00Z' };

describe('authenticated read-only customer communication history', () => {
  it('queries both stores with owner and contact bounds and returns stable newest-first results', async () => {
    const fake = client({ messages:[message], calls:[call] });
    const result = await loadContactCommunicationHistory(fake as any, 'owner', 'contact', 25);
    expect(fake.calls).toEqual([
      {table:'messages',filters:[['user_id','owner'],['contact_id','contact']],limit:25},
      {table:'calls',filters:[['user_id','owner'],['contact_id','contact']],limit:25}
    ]);
    expect(result.map(item => item.id)).toEqual(['c1','m1']);
    expect(result[0].detail).toBe('completed · 61s');
  });
  it('fails closed for missing identity, query errors, foreign rows, and malformed rows', async () => {
    await expect(loadContactCommunicationHistory(client({}) as any, '', 'contact')).rejects.toThrow('Invalid');
    await expect(loadContactCommunicationHistory(client({}) as any, 'owner', "contact' onclick='alert(1)")).rejects.toThrow('Invalid');
    await expect(loadContactCommunicationHistory(client({}, ['calls']) as any, 'owner', 'contact')).rejects.toThrow('could not');
    await expect(loadContactCommunicationHistory(client({messages:[{...message,user_id:'other'}]}) as any, 'owner', 'contact')).rejects.toThrow('ownership');
    await expect(loadContactCommunicationHistory(client({calls:[{...call,created_at:'not-a-date'}]}) as any, 'owner', 'contact')).rejects.toThrow('created_at');
  });
  it('bounds the merged page and deterministically breaks timestamp ties', async () => {
    const tied = {...message,created_at:call.created_at};
    const result = await loadContactCommunicationHistory(client({messages:[tied],calls:[call]}) as any, 'owner', 'contact', 1);
    expect(result).toHaveLength(1); expect(result[0].kind).toBe('call');
  });
  it('renders safe accessible history and a distinct empty state', () => {
    const html = renderContactCommunicationHistory([{id:'m1',kind:'message',direction:'inbound',createdAt:message.created_at,summary:'Received SMS',detail:message.content}]);
    expect(html).toContain('aria-label="Customer communication history"');
    expect(html).toContain('&lt;script&gt;private&lt;/script&gt;'); expect(html).not.toContain('<script>');
    expect(renderContactCommunicationHistory([])).toContain('No communication history recorded.');
  });
  it('renders pending, failed, and sent outbound messages distinctly and truthfully', async () => {
    const statuses = ['pending', 'failed', 'sent'] as const;
    const result = await loadContactCommunicationHistory(client({messages:statuses.map((status, index) => ({
      ...message, id:`m${index}`, direction:'outbound', status, created_at:`2026-11-12T10:00:0${index}Z`
    }))}) as any, 'owner', 'contact');
    const html = renderContactCommunicationHistory(result);
    expect(result.map(item => item.summary)).toEqual(['SMS sent', 'SMS failed', 'SMS pending']);
    expect(html).toContain('SMS sent'); expect(html).toContain('SMS failed'); expect(html).toContain('SMS pending');
    expect(html).not.toContain('Sent SMS'); expect(html).not.toMatch(/delivered|read/i);
  });
  it('keeps an existing activity visible while communications load, succeed, or fail', () => {
    const activities = [{id:'a1',user_id:'owner',contact_id:'contact',type:'note',description:'Saved note',created_at:'2026-11-12T09:00:00Z'}] as Activity[];
    const activityHtml = renderHydratedContactActivity('owner', 'contact', true, activities);
    for (const communicationHtml of [
      '<p role="status">Loading communication history…</p>',
      renderContactCommunicationHistory([{id:'m1',kind:'message',direction:'inbound',createdAt:message.created_at,summary:'Received SMS',detail:'Hello'}]),
      renderContactCommunicationHistoryError('contact')
    ]) {
      const html = renderContactHistoryTimeline(activityHtml, communicationHtml);
      expect(html).toContain('Saved note'); expect(html).toContain('aria-label="Communications"');
    }
  });
  it('includes a newly saved note when the production timeline composition rerenders activities', () => {
    const activities: Activity[] = [];
    const render = () => renderContactHistoryTimeline(
      renderHydratedContactActivity('owner', 'contact', true, activities), renderContactCommunicationHistory([]));
    expect(render()).not.toContain('Newly saved note');
    activities.push({id:'a2',user_id:'owner',contact_id:'contact',type:'note',description:'Newly saved note',created_at:'2026-11-12T12:00:00Z'} as Activity);
    expect(render()).toContain('Newly saved note');
  });
});
