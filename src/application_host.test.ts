import { describe, expect, it } from 'vitest';
import { isCrmApplicationHost } from './application_host';

describe('isCrmApplicationHost', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '[::1]',
    'website-crm-one.vercel.app',
    'website-lkttknp00-hans-says-projects.vercel.app',
    'WEBSITE-CRM-ONE.VERCEL.APP.'
  ])('treats %s as a CRM application host', hostname => {
    expect(isCrmApplicationHost(hostname)).toBe(true);
  });

  it.each([
    'hanssays.com',
    'pressurepro.io',
    'customer.example.com',
    'vercel.app.evil.example'
  ])('keeps %s available for public-site resolution', hostname => {
    expect(isCrmApplicationHost(hostname)).toBe(false);
  });
});
