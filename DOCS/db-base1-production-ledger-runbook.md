# DB-BASE1 production migration-ledger handoff

DB-BASE1 restores the historical schema required to bootstrap a new, empty
Supabase environment. Production already contains that schema, so the baseline
migration must never execute there.

Production integration requires a separate, explicitly authorized task:

1. Verify the production project identity, current migration ledger, and schema
   equivalence against the DB-BASE1 contract using metadata-only reads.
2. Confirm `20260325170300` is absent from the production ledger while all
   existing versions beginning with `20260325170301` remain unchanged.
3. Mark only `20260325170300` as applied with the pinned Supabase CLI migration
   repair command. This changes the ledger only and must not execute baseline DDL.
4. Re-list local and remote migration histories and require exact agreement.
5. Run a production `db push --dry-run` and require that no DB-BASE1 bootstrap
   DDL is pending before any ordinary deployment resumes.

Never use `--include-all` to apply DB-BASE1 to production. Never use a linked
database reset, and stop if schema equivalence or ledger identity is uncertain.
