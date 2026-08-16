function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

/** Hosts that serve the CRM shell rather than a customer-facing public website. */
export function isCrmApplicationHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
    || normalized.endsWith('.vercel.app');
}
