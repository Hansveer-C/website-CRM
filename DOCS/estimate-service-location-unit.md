# WASHOPS CRM - estimate/service-location association unit

Status: authenticated Add Lead draft based on deployed main
`f4534e90fe846970a8e54e04a463ce0b5539d291`. PR60 onboarding and PR59 property
entry are released. Current work closes the ordinary production lead-entry gap.
Earlier property/estimate browser proofs seeded customer prerequisites: they are
NOT empty-account end-to-end proof. The current unit below explicitly seeds only
local Auth identities/profiles and creates every CRM record through normal UI.
PR58 remains draft; PR48 and later job/history/SMS work remain untouched.

This is the established execution checklist/evidence record, not a competing
roadmap. Canonical product authority remains `CRM Roadmap.ods`. This unit may be
published as a draft only; no merge or hosted test records are authorized here.
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
requires HTTPS Supabase configuration, so at that checkpoint full-app browser QA against the
HTTP-only disposable stack was not claimed; component browser QA plus actual local
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

## Full authenticated local application verification

Current result: **PASS locally, remote release held**. This supersedes the earlier
component-only browser limitation. The real application ran with browser fixtures
disabled, real disposable Supabase Auth/PostgREST/database/Storage, and a temporary
loopback-only HTTPS proxy. A one-day test certificate was generated outside the
repository; only the test browser accepted it. No application HTTPS check, system
trust, hosted credentials, external access or deployment configuration was changed.

Two existing production-path defects were reproduced before repair:

1. Clients & Leads requested `/api/contacts`, whose implementation existed only
   inside the development fixture interceptor. With fixtures disabled, the real
   application showed “Contacts could not be loaded”. Production now reads the
   established authenticated contact hydration only when ready, with an owner filter.
2. Production estimate creation posted to `/api/quotes`, also present only in that
   fixture interceptor. It now calls the existing authenticated `saveProductionQuote`
   adapter directly. Request-key idempotency, server authorization and protected
   async/navigation guards remain; returned quote/contact/items/opportunity ownership
   is checked before changing displayed collections. No parallel API was introduced.

The opt-in `tests/e2e/quote-service-location-authenticated.spec.ts` passed its complete
real-application scenario against strict localhost ports and synthetic accounts:

- [x] Real login, authenticated quote hydration and contacts display.
- [x] Customer switching in the estimate composer; other businesses' customers and
  other customers' service locations remain absent.
- [x] Estimate created through the real UI/RPC, draft location selection/cancel/save,
  with database revision and association verified.
- [x] Same-status commercial refresh changes actual displayed line item and price
  before the new revision can be used for acceptance.
- [x] Real stale-revision conflict followed by refresh and successful retry.
- [x] Deliberately lost response after a successful local database write; retry sends
  the same request key, replays success and advances revision only once.
- [x] Actual typed-name/signature attestation acceptance through the UI and RPC.
- [x] Accepted service address stays frozen after editing the source property;
  recorded, explicit unassigned and historical missing-evidence displays are distinct.
  The historical shape is an explicit synthetic fixture; the earlier SQL test remains
  the evidence for genuine pre-migration acceptance preservation.
- [x] Unchanged invoice conversion RPC and replay succeeded for this accepted quote,
  then a full application reload hydrated the issued synthetic invoice into its
  workspace. Invoice-conversion **UI remains intentionally unavailable** in
  authenticated mode, so no end-to-end conversion-button claim is made.
- [x] Real logout and second-business login clear the previous account's data;
  direct navigation to the first business's estimate shows “Quote unavailable”.
- [x] No browser page errors in the passing scenario. External browser requests are
  blocked. Independent review found a retry-route override could bypass the broad
  deny route; repair cycle 1 adds an exact local-origin check before every fetch or
  continue. The passing browser regression proves a matching `.invalid` URL is
  intercepted and aborted before network access or request processing.

Verification: one complete authenticated Chromium E2E passed (10.2 seconds, final
run 17.0 seconds including setup), plus **154/154 focused Vitest assertions across
9 files**. App/API TypeScript checks and Vite 5.1 build passed; the largest entry is
877.17 kB and still exceeds the existing 550 kB warning threshold. No lint command
is defined. No migration/schema change was needed for these application-path fixes.
Independent review passed after the harness guard correction; reviewer independently
ran 40 relevant mutation/hydration/UI tests and whitespace checks.

Real local UI evidence (synthetic data only):

- [Saved draft location](evidence/estimate-service-location-2026-10-21/authenticated-draft-location.png)
- [Frozen accepted location after source edit](evidence/estimate-service-location-2026-10-21/authenticated-accepted-frozen-location.png)

Harness corrections were Windows ESM URL syntax and selectors that initially missed
navigation badges/duplicated screen-reader text. An invoice created outside the SPA
needed a full reload rather than hash-only navigation to refresh the existing cached
collections. Cleanup was corrected to delete synthetic invoice items before invoices;
the two retained synthetic fixture accounts from that failed cleanup were verified
and removed before the passing rerun. These were local fixture operations only.
Final database checks returned **0 synthetic Auth accounts, 0 synthetic contacts and
0 synthetic quotes**. Only the session-owned disposable stack was stopped; unrelated
worker containers and the original checkout's pre-existing work were preserved.
The two execution-only host/config files were removed from the workspace. Seven
verified session-owned temporary TLS directories (certificate/key files only) and
the local credential-bearing startup log were removed; QA ports 4218/56429 are closed.

Reproduction prerequisites for the opt-in spec: an unlinked copied local project
with the already-replayed migrations at API `http://127.0.0.1:56421` and database
`127.0.0.1:56422`, a temporary HTTPS loopback proxy at `https://127.0.0.1:56429`,
and real Vite application at `http://127.0.0.1:4218`. Configure publication/media as
`supabase`, browser fixtures `false`, the local proxy URL and local anon key only
(no browser service-role key). The test process receives
`WASHOPS_LOCAL_AUTH_QA=true` and `WASHOPS_LOCAL_QA_STATUS` from the local CLI's captured
JSON status; never print or commit that JSON. Use a temporary Playwright config with
only this spec, one Chromium worker, certificate errors ignored in that test context,
and trace/video disabled. Run the existing Playwright CLI against that temporary
config. These are test-only prerequisites, not proposed persistent product services.

Remaining: production trigger-policy investigation/PR55 dependency before any remote
push or merge; authenticated invoice-conversion UI and customer-location creation UI
remain separate product work. No jobs/scheduling, live providers, communications,
production data, new paid service or customer-facing activation was involved.

## Isolated release candidate after C04 / roadmap merge

Fresh base: main `7c60be847370365c5680681168c7f1cc51100488`.
Original reviewed implementation commits `b5756b8`, `9c90cf2`, `8d14235` were
cherry-picked normally with their plan/evidence commits; no code conflicts arose.
PR48 and all later local product/SMS work are unchanged and excluded.

Pending migration delta is exactly:
- `20261021052454_associate_quote_service_property.sql`: nullable quote property,
  private idempotency ledger, owner-derived assignment RPC and frozen acceptance
  service-location projection, preserving legacy acceptance/commercial semantics.
- `20261021054957_read_accepted_quote_service_location.sql`: owner-derived minimal
  accepted-location read RPC; no private signer evidence returned.

Target remains ledger54. Merge would apply these two migrations and deploy the UI;
this draft does not activate either. No backfill or guessed legacy location.
Git revert can recover UI; it does not undo applied SQL or frozen acceptance data.
Use forward corrective migrations after deployment rather than destructive rollback.

Release gates: fresh-base tests/types/build, independent aggregate review, exact-head
CI, final two-migration ACL/default-grant and acceptance/invoice compatibility review,
then staged Supabase/Vercel observation and authenticated disposable-test smoke.
Historical real local browser proof is evidence, not fresh-base or hosted certification.
Customer-location creation UI, scheduling/jobs, payments and live communications are
separate scope; this draft does not claim an end-to-end completed CRM.

Fresh isolated worktree verification (2026-10-21): 83/83 focused Vitest cases across
six files passed; app/API TypeScript checks and Vite production build passed.
Existing 877.17kB entry warning remains. Missing ignored dependency junctions were
restored to existing cached packages; no dependency/version/install change.
No lint command configured; git diff --check passed. SQL/concurrency/real Auth browser
evidence above is reused from byte-identical original implementation; not rerun here.

## Fresh isolated verification supersedes inherited-evidence limitation

Actual PR57 composition replayed from zero with cached CLI2.116.0 and Supabase
Postgres17.6.1.165:56 versioned migrations, latest20261021054957, no later units.
Initial start restored an older local backup; explicit disposable-local reset
replaced it before testing. No restored-stack results counted as fresh evidence.

- C04 SQL40/40 and location SQL61/61 PASS on actual fresh56 schema.
- Unchanged acceptance/invoice SQL regressions PASS. Execution seed supplies required
  funnel names and synthetic password hashes; initial missing-hash fixture error
  corrected in seed only. Transactions rolled back; no schema/product adjustment.
- Four observed-lock concurrency cases PASS using unchanged guarded runner on a
  network-none/no-port schema copy of actual56. Local copy needed schema-owner and
  default-ACL bootstrap completion; table/function counts and private ledger ACL
  matched source before testing. No remote data or credentials transferred.
- Real local Chromium Auth/UI/REST/Postgres journey PASS: login/customer isolation,
  estimate create, save/cancel, stale conflict, lost-response retry, frozen accepted
  address after source edit, legacy/unassigned reads, invoice RPC replay, navigation,
  mobile view and account switch. No page errors; fixture cleanup passed. No invoice
  conversion UI claim. Vite/TLS proxy stopped; temporary certificate/key removed.
  Fresh synthetic screenshots retained in Temp/washops-pr57-auth-proof/results;
  no trace/video/credentials. No hosted Auth/provider request.
- Genuine legacy-forward proof PASS: disposable reset to54, old-RPC acceptance,
  apply exactly52454/54957, verify unchanged signature/snapshot/revision/time,
  replay and invoicing. No hosted DDL.

CI root cause: five unchanged Builder expected-failure queries attached rejection
assertions after another transaction committed and released their locks. Rejection
could arrive before the handler, causing an unhandled error despite passing checks.
Fresh-main and oldPR57 normal21-case baselines passed; a temporary exact-main copy
with25ms continuation delay reproduced unhandledPT404. Corrected delayed copy passed.
No product regression established. Same-class publication23503 surfaced after first
partial fix, so all five sites were corrected in the same file.

Separate commits8665771/4062819 modify only delete_builder_page.test.ts: immediate
per-query outcome capture, then Error/exactSQLSTATE/original-message checks after
unchanged real lock waits/commits. No global suppression, skips or weakened checks.
Fresh combined159/159 PASS without unhandled errors; all21 delete cases PASS with
25ms delayed continuation at all five sites. Independent exact4062819 review PASS;
all ten exact-head CI jobs PASS. Earlier fresh83 unit/types/build remain valid;
only test/docs changed since and CI repeats broad/types/build.

PR53 exact main7c60be8 Vercel Production READY:
https://vercel.com/hans-says-projects/website-crm/Cgo2uPrTCx3bVMV6EYT1X3wp4K24
Exact-SHA Supabase check SUCCESS; fresh hosted ledger54/latestC04 unchanged.
No manual retrigger, SQL mutation or settings change. Executor lacks dashboard
session, so no detailed workflow-log claim is made. PR57 stays draft/unmerged;
two-migration staged rollout and postdeployment authenticated test verification remain.

## Current service-location entry draft packet

Design grounded in canonical C04: customer washing service locations are distinct
from billing addresses. Choose the smallest existing entry point: Quotes -> Preview
for an owned draft/sent estimate, whose customer identity is already fixed. The
inline Add service location form creates via existing create_crm_property, selects
that safe returned location, then requires a separate Save service location action
through the existing association RPC. No duplicate property domain, new migration,
permission grant, update/delete API, sent-state mutation or invoice feature.

The adapter sends only the existing nine RPC arguments, never user/tenant authority.
It normalizes and validates bounds, rejects private/unexpected response fields and
foreign-customer results, and sanitizes permission/validation/conflict errors.
Server auth.uid ownership/RLS remains authoritative. Country code is explicit;
no billing address or country is inferred. Canonical form primitives provide
escaped labels/values, full-width touch inputs, native required state and focus.

Cancel/Escape before submission makes no write. Creation locks quote selection,
refresh and acceptance while the form is active. Double clicks coalesce; uncertain
responses retain the same normalized payload/key and disable editing/cancel so a
retry cannot silently change intent. A visible warning explains that leaving may
leave a saved location; return and inspect existing locations first. Late results
after leaving the quote/account cannot select a property or hijack navigation.
Existing accepted-location snapshots remain read-only; no creation form there.

Fresh checks on this unit (no hidden PR58 or later work):
- Clean local Supabase reset applied exactly the current 56 migrations. No new SQL.
- C04 40/40 and location 61/61 SQL assertions passed on actual local Auth/Storage
  stack; fixtures rolled back, private response/owner/idempotency contract unchanged.
- Focused tests 107/107 across six files, app/API types and whitespace passed.
- Fresh Auth accounts start with customer prerequisites only: no preseeded property,
  quote or acceptance. The real DEV browser creates draft estimates and properties
  through the actual UI/RPC; validation/cancel/focus/mobile, double click, dropped
  committed response/replay, separate association, permission denial, navigation race,
  customer/business isolation and zero acceptances passed.
- Actual production build and the same authenticated fresh-account journey passed.
  No property feature QA flag is needed; no fixture/backdoor path exists in product.
- New local fixture guard rejects URL query/hash overrides, protocol/path/user/host
  drift before creating pg.Client. Independent review identified that gap; fixed
  with a nonconnecting regression. Reviewer independently ran 32 focused tests.

Browser harness corrections were label matching, waiting for the exact select
instead of an enclosing accessible form, and normal deep-link reload after login.
The existing dashboard website-onboarding overlay can obstruct sidebar navigation
and has no dismiss button. This unit does not remove/bypass it in product; the
supported /#/quotes address reload reaches the actual CRM. No forced clicks, DOM
modal deletion, hidden fixture flag or website-generation submission was used.

Remaining private workflow: after a future reviewed merge, sign in with an existing
authorized account, open /#/quotes (reload if onboarding obstructs), create a draft
for an owned customer, Preview -> Add service location -> Create -> Save service
location. Form cancellation can be checked without persistence. Hosted quote sending
is still disabled; there is no deliberate non-sending sent/acceptance transition
for a newly created draft. Full acceptance/frozen-history flow needs that separately
reviewed contract; this unit does not mark drafts sent or send any communication.
PR58 invoice UI remains QA-only and is not merged for convenience.

Persistence/recovery limits before merge decision: successful creation is a durable
property row; Save association advances quote revision. Cancel/Back/Git revert do
not undo committed data. There is no property edit/delete/undo UI or delete RPC;
address duplication across different deliberate request keys is not prohibited.
No destructive cleanup/reset is proposed. Application rollback is a Git revert;
existing schema/records remain. No production test records were created here.

Final regression: existing real authenticated acceptance/frozen-location/legacy and
invoice RPC/replay browser journey passed (1/1, 9.4 seconds) on this exact code.
The onboarding dismissal prerequisite is tracked separately; no terms acceptance
or website publication is authorized by this property-entry draft.
## Current CRM-only onboarding prerequisite

Separate draft based on deployed main e4b8c0a2cffb2329ef50131e2cc96f59ecffbbd1.
PR57 is merged; earlier release-packet statuses above are historical. Property
creation is independently published as draft PR59, not included in this unit.
PR58 remains draft and PR48 remains untouched.

Fresh hosted owner verification identified a blocking website setup dialog with
no Close/Skip/Cancel/Later. This bounded correction adds Set up website later,
explicitly without website generation or website terms acceptance. Deferral is a
browser-local preference scoped to the exact account, distinct from onboarding_seen
or any website/completion/consent record. It survives reload and dashboard visits;
the existing Website -> Create your website action explicitly reopens setup.
Generation remains unchanged and deferral is disabled while generation is in flight.
A stale dashboard response from a different acting account cannot open its dialog.
No schema, grants, providers, accounts, security settings or backend writes change.

Validation: 71 focused onboarding/client/contract/authority tests and app/API types
passed. Actual production-build browser proof used two fresh disposable local Auth
owners, no preseeded websites and no browser fixture flag. Keyboard/mobile dismissal,
normal Clients & Leads/Quotes navigation, reload, explicit setup reopening and
account-scoped deferral passed; zero generation requests, zero website records,
no onboarding_seen completion flag and no page errors. Initial setup attempts found
missing ignored cached dependency links, then an ambiguous responsive-navigation
locator; resolved without installing dependencies or weakening assertions.

Known independent gap: website-generation terms sentence has no URL. This change
does not invent legal terms or consent, generate/publish a website, or activate
sending. Hosted QA after a future reviewed merge: sign in, choose Set up website
later, open Clients & Leads, then Quotes; reload/dashboard stays usable. Website ->
Create your website still opens the form; choose Later again without submitting.
PR59 must separately land before Add service location is available. New draft
estimates still have no deliberate non-sending sent/acceptance transition.

No production test records, messages or provider actions were performed. Rollback
is an application Git revert; only an account-scoped local preference may remain.
Clearing that preference reoffers setup; no data deletion or hosted cleanup needed.
## Current staged release refresh after PR60

PR60 merged as 2468a0d05320d151227b08a5cd5fb56122b51f4f. Exact-SHA Supabase
check SUCCESS; Vercel Production READY at
https://vercel.com/hans-says-projects/website-crm/35NTRGAiMADrjcNBZEJrYLVTRXVP .
Root and app asset HTTP200, released Later button present. Hosted ledger unchanged:
56 versions, latest 20261021054957, digest 92dc3533d42950746420ac1b4e38b6fa.
No manual migration, settings, credentials, website generation or hosted records.

PR59 refreshed using normal merge ca5a2c0; only overlapping appended documentation
required resolution and both sections were preserved. Onboarding source merged
without functional conflict. Earlier no-dismiss/deep-link observations remain
historical; the refreshed actual production browser test now uses Set up website
later and normal Quotes navigation. No QA flag is needed for either product UI.

Fresh composition validation:
- All 56 versioned migration files byte-match the disposable stack and hosted
  ledger has the same versions, zero pending SQL. Historical non-versioned
  manual_deploy_rls_bundle.sql is excluded and never executed.
- Clean local Supabase reset/replay, C04 40/40 and association 61/61 pgTAP PASS.
- 113/113 focused tests across seven files, app/API types and production build PASS.
- Real production-build fresh-account property journey PASS (1/1, 9.2 seconds),
  including normal onboarding dismissal, create/replay/privacy/permission/mobile/
  navigation isolation and explicit draft-only association.
- Real production-build acceptance/frozen-address/legacy/invoice RPC regression
  PASS (1/1, 8.8 seconds); no invoice conversion UI imported.
- Real production-build onboarding/account/reload/navigation regression on this
  same composition PASS (1/1, 6.3 seconds), zero generation requests/website rows.
- Existing real concurrency proof PASS all four cases: same-key replay, competing
  assignment conflict, assignment-before-acceptance and acceptance-before-assignment.
  Ran unchanged assertions on a fresh network-none/no-port disposable PostgreSQL
  instance with schema-only application/Auth copy from the replayed local stack.
  Two stock image bootstrap approaches failed before the race proof; replaced with
  an independently initialized plain server process. All owned failed/successful
  race containers removed; no production access/data or test assertions changed.

PR58 stays draft, PR48 untouched. Release rollback is application revert only;
property creation and assignment are durable once committed. No delete/undo API
or destructive hosted cleanup is proposed. Parent will independently perform hosted
synthetic UI checks after release. New draft sending/acceptance and missing website
terms URL remain explicit gaps; no live messages or site publication are needed.
## Authenticated Add Lead entry draft

Full empty-account inspection: released onboarding dismissal works; existing
production quote create and service-property create/association call authoritative
RPCs directly. Add Lead alone posted to an absent /api/leads handler; its existing
createProductionLead branch was inside disabled fixture dispatch. This draft wires
the ordinary authenticated form directly to the existing create_internal_crm_lead
RPC through the established adapter. Local/fixture behavior stays separate. No
schema, grant, credential, provider, dependency or release-setting changes.

Existing six required form fields and RPC bounds are preserved. Visible bounded
validation, normalized name/email, safe permission/validation/conflict errors,
Cancel/Escape, saving and replay states use existing form/button primitives.
Owner comes from the authenticated server identity; the browser sends no owner or
tenant parameter. Returned contact/opportunity graph is checked for the current
owner and relationship before updating the existing CRM collections.

Double clicks coalesce. Unknown outcomes freeze payload/key and disallow editing
or Cancel; retries use the same key, including ordinary view navigation/return in
the current page session. A late committed result cannot hijack another view; on
return, View saved lead reuses the result without a new mutation. Authentication
changes clear in-memory drafts/results. No PII or keys are persisted to storage.
A full reload intentionally loses in-memory intent: the visible warning says to
reload Clients & Leads and inspect saved records before starting another lead.
Confirmed creation persists contact, opportunity and inquiry ledger; Cancel or a
Git revert does not undo committed data. No delete/undo feature is introduced.

Cold browser verification exposed an adjacent loading race: ensureProductionCrmData
skipped awaiting an already-loading request for the same owner, so Contacts could
render before its data was ready. The bounded correction awaits the hydrator's
existing deduplicated promise. A held real contact request proves cold navigation
waits and ends in the genuine empty state. Retry button text now updates its
accessible label too. A harness locator was corrected for the ordinary contact
count badge; no assertions, security checks or intended concurrency were weakened.

Executed verification on the actual composition:
- 102/102 focused tests across nine files, app/API types and whitespace PASS.
- Existing hardened lead SQL suite PASS on the real 56-migration local Supabase
  stack: role permissions, same-key replay, repeated inquiries, identity-conflict
  atomicity, cross-business/missing-funnel denial. Separate SQL fixtures rolled back.
- Actual production build PASS with browser fixture mode disabled; no lead QA
  activation flag exists in product.
- Real local Auth production-browser suite 2/2 PASS (10.9 seconds): held cold-load
  navigation and an actually empty account through Later -> Clients & Leads ->
  Add Lead -> lead RPC/replay -> New quote -> property create -> explicit Save.
- Browser setup seeds Auth users/profiles ONLY, with zero contacts, opportunities,
  inquiry ledgers, properties, quotes, acceptances, invoices, messages, calls and
  websites verified beforehand. No hidden fixture dispatcher or /api/leads request.
- Browser exercises blank/email validation, Cancel/Escape, real local permission
  revoke/restore, mobile layout, duplicate clicks, committed-response loss/retry,
  navigating away/returning, late commit recovery, account switch and draft isolation.
  End-state acceptance/invoice/message/call/website counts remain zero. All fixtures
  are synthetic/local; no hosted Auth, production records or outgoing provider calls.

Hosted QA is pending a reviewed future merge, using the existing signed-in test
owner: Later -> Clients & Leads -> Add Lead. Enter a clearly synthetic name,
reserved fictional phone (+1 613 555 0101), example.test email, synthetic address,
service selection and 'Synthetic private QA only; do not contact' details. Submit
once; verify the contact appears and persists after reload. Then normal Quotes ->
New quote -> select that contact -> Basic washing line quantity 1 / price 25 ->
Create -> Preview -> Add service location -> explicit country CA -> Create -> Save.
Cancel validation may be tested first without writes. Do not send/accept an
estimate, create an invoice, call/text, generate/publish a website or delete data.
New draft sent/acceptance wiring and missing website terms URL remain explicit
separate gaps; this is a draft-only private-flow prerequisite, not completed MVP.
