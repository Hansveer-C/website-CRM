/** Nonconnecting guard for disposable property-entry Auth/DB fixtures only. */
export function assertLocalPropertyQaStatus(status: { API_URL?: string; DB_URL?: string }) {
  try {
    const db = new URL(status.DB_URL ?? '');
    if (status.API_URL !== 'http://127.0.0.1:56421' || !['postgres:', 'postgresql:'].includes(db.protocol)
      || db.hostname !== '127.0.0.1' || db.port !== '56422' || db.username !== 'postgres'
      || db.pathname !== '/postgres' || db.search || db.hash) throw new Error();
  } catch { throw new Error('Only the exact disposable local property QA endpoints are allowed.'); }
}
