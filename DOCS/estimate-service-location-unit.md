# WASHOPS CRM — estimate/service-location association unit

Status: implemented, tested and separately reviewed locally. No remote activation.
Owner: this project lane. Dependency: reviewed PR55 `b5a171081c192a94334c0be08efb460ec6c50828`.
Base main inspected: `7d361596e6994e0371ac20ef18a85cb833de5651`.
Branch: `codex/estimate-service-location`, isolated from PR53/PR55 worktrees.

This is an engineering execution record under DOCS, not another product roadmap.
The canonical communication-first roadmap remains CRM Roadmap.ods / PR53.
Neither PR53 nor PR55 may merge until the production migration trigger gate is known.

## Verified contracts

- `20260812150626_reject_nonfinite_quote_amounts.sql`: `save_crm_quote` creates a
  quote and all tier items atomically; it checks customer/opportunity ownership,
  validates finite bounded amounts and totals only the selected tier. Its request
  fingerprint and six-argument RPC signature are established contracts.
- `20260831190000_create_crm_quote_acceptance.sql`: `accept_crm_quote` locks a sent
  quote, checks its current revision, saves one acceptance with the PRE-approval
  revision, freezes the complete quote/all-tier items, then increments the live
  revision. Idempotent replay happens before stale-version rejection. Its signature
  and private signature-evidence handling must remain unchanged.
- `20260831200000_create_crm_invoice_from_accepted_quote.sql`: invoice creation
  requires `quote.revision = acceptance.quote_revision + 1`; it derives selected
  tier from frozen `quote_snapshot.quote`, filters frozen items to that tier and
  verifies their sum against snapshot/accepted totals. Do not introduce a second
  pricing representation or change this RPC in the association unit.
- PR55 properties are customer-owned service addresses, independent of billing
  addresses. Authentication is from auth.uid(); browser writes/deletes are denied;
  creation/replay responses omit owner/request metadata. No property update/delete
  RPC or job-domain deletion contract currently exists.
- `src/crm_production_mutations.ts` is the existing authenticated RPC adapter;
  `src/main.ts` uses it for production quotes and acceptance with async actor guards.
  Do not invent a parallel persistence layer or a placeholder Conversation table.

## Bounded schema/API design

Create one forward migration AFTER PR55, using installed/cached Supabase CLI's
`migration new` once implementation starts; do not fabricate a timestamp or edit
the reviewed PR55 migration. The migration and its domain contract have one owner.

1. Add nullable `quotes.property_id uuid`; no backfill or guessed address match.
   Add unique `(id, contact_id, user_id)` on properties, and a composite quote FK
   `(property_id, contact_id, user_id)` to enforce same-customer, same-tenant identity
   even for privileged writes. Index referencing quote property fields.
   Proposed FK action is `NO ACTION`, not `RESTRICT` or silent `SET NULL`: individual
   deletion of a referenced property is rejected; the existing customer cascade
   can delete quote and property in one statement. Prove this ordering behavior
   locally before adopting it. Do not silently clear a link without a quote revision.
2. Add tenant-owned `quote_property_assignment_requests` for durable idempotency:
   owner/request-key primary key; quote ID; JSON request fingerprint; resulting
   revision and property ID. FK to `(quote_id,user_id)` with quote cascade. No FK
   from historical request payload to property; do not add accidental retention
   restrictions when a quote is reassigned. Enable RLS and explicitly deny direct
   anon/authenticated/service-role access; the authenticated RPC is the write path.
3. Add `set_crm_quote_service_property(p_quote_id uuid, p_expected_revision integer,
   p_property_id uuid, p_request_key uuid) returns jsonb`. Only authenticated execute;
   fixed empty search_path; derive owner from auth.uid(), never a tenant input.
   Validate non-null IDs/revision/key; acquire owner/request advisory lock, then
   quote FOR UPDATE. An exact request-key retry returns its stored result before
   version checks; different payload conflicts. Allow only draft/sent quotes;
   require a matching owned customer/property and expected quote revision; increment
   revision and updated_at atomically. Return only quote_id, property_id, resulting
   revision and replayed, not ownership/idempotency internals. Store this small
   committed result so retries after later assignments are stable, not misleading
   re-reads of a newer quote. No detach action is needed in this first unit.
4. Extend the existing `accept_crm_quote` body in the new migration without changing
   its signature, replay logic, signer validation or price evidence. Once the quote
   lock is held, resolve its associated property with matching customer/owner and
   a property row lock; freeze an explicit safe projection under
   `quote_snapshot.service_location` with schema_version=1, property_id, label,
   address lines, locality, administrative_area, postal_code and country_code.
   Add envelope `service_location_status: 'recorded'` when that object is present.
   Exclude user_id, request_key and request_fingerprint. Lock quote then property
   consistently in both operations. Never copy contact.address as service location.
5. Add a typed `setProductionQuoteServiceProperty` helper to the existing production
   mutation module and a nullable optional property_id on Quote. Pass only the four
   RPC arguments; verify returned quote/property/revision and sanitize errors using
   the established INVALID_INPUT/CONFLICT/UNAVAILABLE handling. Do not overload
   `save_crm_quote`, couple two client calls under a false atomic-success message,
   expose a new public endpoint or wire UI/provider actions in this backend unit.

## Legacy and immutable-evidence rules

- Already accepted quotes and signature/quote_snapshot bytes remain untouched.
  An absent location key is `legacy_unrecorded`, not a location to infer from
  today's property/customer record. Association of approved/rejected quotes fails.
- For backwards compatibility, unassociated legacy draft/sent quotes can retain
  the existing acceptance behavior; new acceptance records explicitly mark an
  unassigned location (`service_location: null`, `service_location_status: 'unassigned'`). A linked
  quote must snapshot its actual linked location or fail atomically. Do not
  retroactively require or synthesize a property for existing acceptance replay.
- Consumers distinguish `recorded`, `unassigned` and `legacy_unrecorded`; future
  job conversion must require recorded accepted evidence and an explicit remediation
  path for older records. No job conversion or new job policy is implemented here.
- Frozen service evidence is independent from subsequent property/customer edits.
  Existing quote/customer cascade and invoice-backed delete restrictions remain
  the current lifecycle; do not claim immutable means undeletable forever.
- Preserve quote_snapshot.quote and quote_snapshot.items in their established shape.
  All tiers remain historical evidence. Selected-tier amount validation remains
  canonical in invoice conversion; location does not alter amount/currency/tier.

## Acceptance tests (synthetic, local only)

| Case | Required outcome |
| --- | --- |
| Valid draft/sent association | Correct customer/location link; revision increments once; prices/status/opportunity unchanged |
| Same tenant, different customer; foreign tenant; missing IDs | Denied without leaking address or committing request/quote changes |
| Anonymous or authenticated role without auth.uid() | Fail closed; direct table writes and RPC metadata exposure denied |
| Same request key, same payload | Stable stored result; no second revision increment |
| Same key, changed property/quote/expected revision | Explicit conflict; no mutation |
| Two competing assignments at same expected revision | Exactly one commits; loser conflicts; no stale overwrite |
| Assignment versus acceptance, both lock orders | One valid ordering; never mismatched location/revision or deadlock |
| Acceptance after assignment | Snapshot uses linked normalized service address, not billing address; acceptance revision is pre-approval revision; live revision is +1 |
| Acceptance replay after later source edits | Identical frozen location, commercial evidence and signer metadata; no duplicate acceptance |
| Privileged synthetic edit of source address/label | Accepted location snapshot stays byte-identical; no live-address reconstruction |
| Referenced property deletion; customer cascade without invoice | Property-only deletion fails; existing quote/property customer cascade still succeeds atomically |
| Invoice-backed customer delete | Existing invoice restrictions remain; no policy broadening |
| Pre-migration acceptance and replay | Snapshot bytes unchanged; existing invoice RPC still works; location reports legacy_unrecorded |
| Unassociated legacy sent quote | Existing acceptance remains valid, explicitly unassigned; no invented location |
| Selected premium with basic/standard alternatives | Acceptance retains all tiers; existing invoice conversion produces only selected-tier lines/total |
| Wrong accepted revision, mismatched selected-tier total, malformed amount | Existing conflict/validation behavior remains; no partial invoice |
| RPC adapter failures / malformed response | Explicit safe error; no provider/SQL details or false success |

Use actual pgTAP/SQL assertions plus two-session lock/concurrency checks, not only
source-string tests. Replay the relevant full local chain with proper Supabase
Auth/Storage bootstrap if available; a minimal-prerequisite database is explicitly
limited evidence, never a substitute for full replay. Run existing C04 40 assertions,
quote-acceptance/invoice regression SQL and relevant production-mutation unit tests.
Run app/API typechecks and build once implementation exists. Do not npm-ci over
tracked node_modules or claim a skipped SQL suite passed. Respect LOOPS: initial
implementation and at most two repair passes; stop on plateau/security ambiguity.

## File ownership and release bounds

Owned files: new migration `20261021052454_associate_quote_service_property.sql`;
new association SQL suite, real-concurrency runner and before/after legacy fixtures;
bounded additions to `src/crm_production_mutations.ts`, a new adapter/evidence-reader
test file and the Quote type.
The acceptance SQL/RPC contract is shared and exclusively owned by this unit while
changing it; recheck other workers before edits. `src/main.ts`/quote UI are protected
from this first backend unit; later UI wiring must independently prove async actor
guards, clear error/conflict state, responsiveness and accessibility.

Protected: PR48 invoice/PDF implementation; prior PR53 workbook/overlay;
reviewed PR55 migration/tests/config; existing invoice RPC; all job/scheduling,
communication-provider, Control Plane, production and credential/access settings.
No deployment suppression is copied blindly to the next branch: no remote push
is part of this local preparation. Main auto-deploy is confirmed; Supabase production
trigger policy still requires the authenticated read-only handoff.

Rollback before deployment is the local branch/commit diff; no production schema or
data action is authorized here. Future additive migration rollout/rollback must be
reviewed separately without destructive production DDL.

## Durable completion checklist

- [x] Read exact save/acceptance/invoice RPCs, production adapters and SQL tests.
- [x] Verify PR55 dependency and isolated branch; no competing next-unit worktree found.
- [x] Document API, legacy behavior, commercial/revision invariants and test matrix.
- [x] Parent accepted scope for reversible local implementation; final diff needs separate review.
- [x] Implement one bounded migration/RPC/client unit, with no UI/provider activation.
- [x] Execute actual SQL, concurrency, adapter/type/build regressions below.
- [x] Separate independent review PASS on implementation commit
  `b5756b82dd5d927860b2bc696a674860a903ce91`; no material findings. Reviewer also
  independently ran the 37 new client tests and whitespace check successfully.
- [ ] Resolve production integration gate and verify merged PR55 before remote release.
- [ ] Only then consider customer-facing association UX, followed by job/visit conversion.

## Executed local verification

- New SQL suite: **52/52 pgTAP assertions passed** against the isolated domain schema.
  Repeated successfully after a fresh relevant-domain replay. These are the same
  52 cases, not 104 independent tests.
- Actual legacy-forward test: create a signed acceptance using the old RPC BEFORE
  the new migration; afterward verify unchanged snapshot text, signature bytes,
  acceptance revision/time, exact retry and invoice conversion. Passed.
- Four two-session checks passed, each observing a real PostgreSQL lock wait:
  concurrent same-key assignment (one mutation/one replay), competing assignments
  (one stale loser/no ledger row), association-before-acceptance and
  acceptance-before-association (frozen original location retained).
  Reproduce with `node supabase/tests/crm_quote_service_location_concurrency.mjs
  washops-pr55-review-20261021 --local-only` against the prepared disposable DB.
  Runner refuses containers with network access or published ports and cleans only
  its unique synthetic fixtures; it never reads a host database URL/credential.
- Unchanged `crm_quote_acceptance.test.sql`,
  `crm_invoice_from_accepted_quote.test.sql` and C04's **40 assertions** passed.
- Vitest **57/57** in `crm_quote_service_location.test.ts` (37), existing production
  mutations (14), existing acceptance migration (3), existing invoice migration (3).
  Exact Vitest 1.6.0 was reused from local cache.
- App/API TypeScript checks passed. Lockfile-installed Vite 5.1.0 production build
  passed with output directed to Temp, preserving tracked dist. A >550 kB chunk
  warning remains (largest entry 866.59 kB); no bundle-size correction or unsupported
  claim that this warning is new/pre-existing is made in this backend unit.
- `git diff --check` passed; protected UI, prior migrations, invoice RPC, dependencies,
  workflows and deployment configuration are unchanged.

Database used: session-owned Docker container `washops-pr55-review-20261021`,
network mode `none`, no published ports, cached Supabase Postgres 17.6.1.165.
The fresh DB `washops_location_fresh_20261021` replayed canonical legacy baseline,
quote creation/nonfinite, acceptance, invoice, reviewed C04 and the new migration.
It used a minimal local auth.uid fixture, **not** full Supabase Auth/Storage bootstrap;
this does not certify the entire repository migration chain or live infrastructure.
The fresh harness required pgTAP extensions-schema usage for authenticated/service
roles, then anon; these two deterministic harness-only setup corrections were made
within the bounded loop. No protected-data access policy was loosened.

Missing checkout packages initially blocked Vitest and typechecks. Tracked
node_modules was not reinstalled. Only absent packages were linked to an isolated
Temp installation of the unchanged lockfile (install scripts disabled). One offline
cache attempt failed; normal public-registry fetch of those already-pinned packages
succeeded. No new dependency, credential, paid API or provider was introduced.

At this backend checkpoint no UI was wired: this verified a backend/RPC/client-adapter dependency, not the
finished customer workflow or CRM. Production migration-trigger evidence and merged
PR55 remain prerequisites for any later remote release.

## Independent review checkpoint

The separate reviewer verified authorization/customer FK, stable historic replay
results, revisions, lock order, explicit accepted-location projection and preserved
legacy/commercial/invoice contracts. It reviewed SQL/concurrency/legacy fixtures and
the execution evidence, but did not independently rerun the database suites.
The follow-up evidence commit changes this record only; implementation remains
byte-identical to the reviewed commit. No remote push/merge or production operation
was performed. The session-owned disposable container is stopped at handoff; its
synthetic databases remain available for review. Pre-existing worktrees are intact.

## Estimate UI unit (local, dependent on PR55 and the backend above)

Scope owner: this worktree. Changed shared `src/main.ts` only for the existing
estimate preview integration; no competing worker or jobs/scheduling scope.
Protected: prior migrations/RPC mutations, PR48, PR53, PR55, dependencies,
deployment/workflow settings, Control Plane and all pre-existing dirty files.

- [x] Draft/sent estimate preview loads only service locations for its customer;
  property SELECT uses C04's safe columns and server RLS, never an owner-column grant.
- [x] Explicit loading, empty and error states; select/cancel/save and refresh;
  repeated clicks suppressed; uncertain retries retain their original request key
  and payload; conflicts require authoritative refresh. Navigating or switching
  accounts/estimates discards late results.
- [x] Approved estimates display frozen accepted evidence, with distinct historical
  missing-evidence and explicit unassigned states. Current customer/billing data
  never fills an absent accepted address. Local fixtures explicitly identify that
  service-location persistence is available in authenticated CRM mode.
- [x] Acceptance is blocked during loading, unsaved selections and uncertain saves.
  Refresh fetches quote and owned items, checks revision/status again, then replaces
  and renders the complete preview before adopting that revision for acceptance.
- [x] New authenticated-only `read_crm_accepted_service_location` returns location
  evidence only. Acceptance ledger direct-read grants remain denied; no signature,
  signer or pricing record is exposed by this read function.
- [x] Focused Vitest: 77/77 (19 UI controller/integration regressions, 12 existing
  quote rendering, 9 signature, 37 backend location adapter tests). App/API type
  checks pass. No repository lint script is defined; whitespace check is used.
- [x] Four Chromium browser scenarios passed against the actual mounted component
  with synthetic injected load/save dependencies: these are simulated network
  results, not authenticated full-application/backend browser certification.
  Covers loading/error/empty, cancel/save/repeated clicks, uncertain retry, stale
  conflict, navigation and 375px accepted snapshot display.
- [x] Full timestamped local migration-chain replay now passed using cached
  Supabase CLI 2.116.0 in a separate copied project, unique ID
  `washops-location-ui-20261021`, ports 56421/56422, with actual Auth/PostgREST/
  Storage containers. Non-timestamp manual SQL bundle is intentionally skipped by
  the CLI. This supersedes the earlier raw-Postgres-only verification limitation.
- [x] Existing Auth/RLS/Storage smoke passed on that stack: synthetic Auth fixtures,
  database tenant isolation, commercial-document Storage boundaries and media
  bucket regression, including fixture cleanup. Harness changed only local project
  identity and cached CLI invocation, outside the repository; hosted configuration
  and production data were not used.
- [x] Independent re-review passed after repair cycle 1; reviewer independently ran
  19 UI and 37 adapter tests and whitespace checks. No residual material findings.
- [x] Final SQL suite: 61/61, including missing identity and unchanged direct-ledger
  denial. Full local ledger contains all 55 timestamped migrations.
- [x] Final production build passed with the existing bundle threshold warning;
  largest entry is 876.20 kB at this checkpoint. No bundle optimization claimed.

Independent initial review found a real stale-display acceptance risk: the first
UI implementation replaced quote revision without rerendering changed pricing/items.
Repair cycle 1 adds authoritative quote+items refresh, synchronous preview replacement
and the actual integration-helper/rendering regression described above. No scope
expansion into quote editing or jobs was needed.

Local browser/full-stack commands initially required escalation for localhost/
Docker access. A sandbox Temp-path difference was resolved using a workspace-local
temporary browser config; no access policy or global setting was changed. Generated
runtime credentials are synthetic and confined to the disposable local stack.

Remote push/merge/deployment remains pending the parent's Supabase integration
trigger-policy investigation. No production capability was activated. The application
currently requires HTTPS Supabase configuration, so full-app browser QA against the
HTTP-only disposable stack is not claimed; component browser QA plus actual local
SQL/Auth/Storage tests are distinct evidence. New estimate creation remains the
existing flow; selection is performed in the saved estimate's preview. Creating
new customer service locations in the UI is outside this association unit.

Commands: cached Vitest 1.6 `run src/ui/quotes/quote_service_location.test.ts
src/ui/quotes/quotes.test.ts src/ui/quotes/quotes_signature.test.ts
src/crm_quote_service_location.test.ts --pool=forks --poolOptions.forks.singleFork`;
TypeScript `-p tsconfig.app.json` and `-p tsconfig.api.json`; Vite 5.1 build to an
isolated Temp output directory. Browser spec is compatible with existing Playwright
configuration; this run used a temporary config selecting only that spec, cached
Chromium, Vite localhost port 4217 and Temp artifacts to avoid the repository's
historical D-drive output location. Mobile screenshot was visually inspected:
readable wrapped location/evidence, established card styling, no horizontal overflow.
Only this run's generated tracked Vite metadata was restored to its clean initial
bytes. The temporary workspace browser config was removed; no runtime settings changed.
