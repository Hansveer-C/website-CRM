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
### Final review corrections and resumed verification

Execution transport disconnected after base 77c6048; inspection on reconnect found
that head unchanged and only expected review corrections dirty. Existing owned
Supabase stack was already running; no duplicate services or test accounts were
started. No push/merge had occurred during the interruption.

Independent review found a P1 test-harness issue: specialized route handlers could
override the global blocker without first verifying origin. A shared local-only
policy now applies before every browser case, including cold hydration; both RPC
and contacts overrides require the exact loopback backend origin/path before
fetch/continue. Regression tests reject matching remote, userinfo-spoofed, suffix,
wrong-protocol and malformed URLs, plus prohibited acceptance/site generation.
No security assertions were weakened. Product review had no material findings.

The form also captures the existing application-navigation token, so a newly
started navigation invalidates UI delivery before the next view renders. This
uses the established operation guard; its behavior is unchanged. A real-guard
unit regression proves a late saved lead cannot redirect the new navigation.

Final resumed checks: 104/104 focused tests across nine files PASS; app/API types,
whitespace and actual production build PASS. Real local production-browser suite
2/2 PASS (27.4 seconds), including cold hydration and the fully empty-account path
with no seeded CRM records. Successful logout response is awaited before the
second account login. Existing hardened lead SQL suite rerun PASS on the local
56-migration stack; all separate SQL fixtures rolled back. No hosted writes,
acceptance, invoice, provider, website-generation or external sends were executed.
Final exact-head independent review and remote CI remain draft-publication gates.

### Hosted usability regressions after PR61 — local correction candidate

Base: `cab1d53b5333d4836949ae3a1d10651152ed6760`. Parent's normal hosted
synthetic-account QA saved a lead, then found Contact View returning to the list
with "Contact not found". Source inspection proves the detail and timeline routes
called `/api/contacts/...`, which exists only in the browser simulator. Production
has no such API handler. This is not evidence of missing database grants.

The correction resolves detail from the same authenticated hydrated owner data
as Clients & Leads, denies missing/foreign/account-transition/unavailable data,
and offers an ordinary retry when hydration failed. Activity rendering uses only
already-loaded owner/contact activity records, escaping content and handling
nullable due dates deterministically. This does not implement call/SMS history.
No schema, grants, private columns or production API surface are added.

The same hosted session reported quote validation rejecting visible service,
Qty 1 and Price 1. That exact rejection did not reproduce locally: the unchanged
production composer successfully persisted the selected contact/opportunity and
one Basic item at Qty 1 / Price 1. A narrower synchronization defect is proven:
while typing a service name, the model remains empty until blur because its
handler used `change`. A deliberate production-browser red regression observed
that empty model; using `input` keeps service/description synchronized. Existing
tier, numeric, selected-tier, authorization and RPC validation are unchanged.
Do not represent this as a confirmed explanation of the hosted rejection;
repeat the normal hosted flow after a reviewed release before closing it.

Validation, independent review and draft-publication evidence follow below.
At this candidate checkpoint, merge and hosted fixture mutations were held.

Local validation: 108/108 affected regressions across ten files PASS; app/API
type checks and actual production build PASS. Production-build Playwright suite
3/3 PASS, using real disposable local Auth/database and ordinary UI: no CRM data
seeded, contact keyboard View/mobile layout/reload/back, cross-owner deep-link
denial, failed contact hydration/retry, selected opportunity plus Basic Qty 1 /
Price 1 persisted at total 1.00, then explicit service-location creation/save.
Existing frozen lead replay/navigation checks remain exercised. Simulator-only
contact API calls are blocked and asserted absent. The denied-hydration case
uses a synthetic 403; successful reads and writes use the real local stack.
Independent review corrected nullable due-date handling; final working diff
PASS with 17/17 independently executed contact/composer tests. No migration or
configuration files changed. The local stack retains 56 migration versions;
this candidate has zero pending SQL. Hosted contact/quote retest remains open.

### PR62 automatic release verification

Subsequent owner delegation authorized release of reviewed head
`f16872ff56ca882faf4d47c64ceb5a3bcc4e63fa` only. Immediately before release,
main/base remained `cab1d53b5333d4836949ae3a1d10651152ed6760`, exact-head independent
review PASS and all ten CI jobs PASS (run `39673041538`). Six-file diff remained
unchanged, with no migration/API-handler/configuration changes. PR62 merged at
20:49:40 UTC on October 21 as `e976a250cd19083cc93d3292b9ea66f3c7960eef`; its tree
matches the reviewed head exactly. PR48 and draft PR58 were unchanged.

Vercel production deployment `dpl_HYRWkY8Cwy91vZNUr2g7veNRUasP` reached READY
for that exact main SHA and assigned `website-crm-one.vercel.app`:
https://vercel.com/hans-says-projects/website-crm/HYRWkY8Cwy91vZNUr2g7veNRUasP
The live page and `/assets/index-vHpsi5Vn.js` return HTTP 200; the live asset
contains the new contact unavailable and nullable activity states. Exact-SHA
Supabase integration check (named "Supabase Preview" by the app even on main)
completed success at 20:50:18 UTC; connected project remains ACTIVE_HEALTHY.

Read-only pre/post metadata on project `jkwfocgqgltdmprhdmji`: ledger 56, latest
`20261021054957`, version digest `92dc3533d42950746420ac1b4e38b6fa` unchanged.
The same catalog-only table/RLS/column/ACL/policy/function/default-grant digest
remained `db21d695ef59d73d3c153c72fa82459a` before merge and after terminal
integration success. No hosted records were read or mutated, and no manual SQL
mutation, credentials, settings, provider actions or charges were introduced.

Remaining gate: parent's normal authenticated hosted UI retest against its
preserved synthetic contact, including View/reload/back and the reported Basic
Qty 1 / Price 1 quote creation path. Static release smoke and successful local
tests do not establish that the exact hosted quote rejection is resolved.
This verification record is committed locally only; no second release implied.

### Hosted private-flow verification supplied by parent after PR62

Parent reports normal authenticated production UI verification on the released
PR62 app. This lane did not independently repeat those hosted mutations.
Synthetic contact `bcc17ea5-4bf9-4304-9a3a-7d886bef848a` now opens through View,
survives full reload, and returns to the contact list. Normal Quotes > New quote
saved draft `33d737ba-07e8-4576-8d84-799aac8b8f89` with Basic service
"QA driveway wash — synthetic draft only", quantity 1, price 1 and total $1.
The hosted check explicitly pressed Tab to blur: it does NOT independently
establish without-blur behavior. Without-blur synchronization remains supported
by the separate local production-browser red/green regression above.

Parent created service location `5a40cabf-861c-4198-8965-b7e6d0583427`, label
"QA service location 20261021 2030", and associated it using Save service location.
Back/reopen and full reload preserve selection; Save remains disabled until a
change. No send, acceptance, provider action, website terms acceptance or site
generation occurred. The reported quote rejection did not recur on this tested
explicit-blur path; do not generalize that result to every input mechanism.
This closes the bounded hosted contact/draft/location private-flow check, not
acceptance, invoicing, jobs, payments or communication-first MVP completion.

### Next proposed production-usable unit — persistent contact notes

Planning only; no implementation or release authorized by this record. Reviewed
the canonical workbook's current-status tab, its evidence overlay, current main
`e976a250`, existing worktrees and open PRs. PR48 and draft PR58 remain separate;
no competing contact-note implementation was found. The accumulated local history
feature still requires a DEV/loopback QA gate and is not a released inbox.

Recommend the existing Contact Detail Note action persisting an internal note
to the existing `activities` table and showing it through the released owned
activity read. `main.ts` currently refuses production activity creation/updates;
`activities_repo.ts` is server-only legacy caller-supplied upsert/mock fallback,
not a safe browser adapter. No existing note-creation RPC was found in migrations.
Existing schema already has note description, nullable due date and a server
`created_at`; reuse these rather than creating a parallel conversation store.
This is immediately usable for manually recording a customer conversation; it
does not send, simulate delivery, provision a number or claim live communications.

Minimum proposed contract: authenticated server-derived owner, same-owner contact
validation inside the transaction, bounded nonblank text, fixed note type and
server creation time. Stable request identity must provide atomic same-payload
replay and reject changed-payload/foreign-owner reuse without overwriting another
activity. Account for existing owner CRUD when designing the replay ledger: an
edited/deleted activity must not become a silently successful unchanged replay.
Return minimal safe activity fields; no request fingerprint/private metadata.
Keep existing contact/user cascade semantics, with no new retention or independent
history promise. No note edit/delete, task scheduling, quote status, call/SMS or
team assignment scope. Present actual created time distinctly from a due date.

Ordinary production UI acceptance: open owned contact > Note > enter/save text >
exactly one persisted activity appears and survives reload; validation/cancel
causes no write, double click coalesces, lost response retains the retry key/text,
denied permissions are recoverable, and late results never repaint another contact
or account. Mobile keyboard/focus and escaped multiline text are required.
No QA-only route/flag, fixture contact prerequisite or privileged frontend client.

Test plan before release: isolated full-chain Supabase replay plus SQL tests for
anonymous/foreign contact/foreign request denial, malformed text, concurrent replay,
payload conflict, edited/deleted source and contact-deletion races. Real local
production-build Auth/UI flow starts with no CRM seed, creates lead normally,
saves/cancels/retries note and verifies persistence, account/navigation isolation
and zero outbound requests. Run affected hydration/contact/XSS/operation-guard
regressions, app/API types/build and independent exact-head review. Then staged
draft/CI/release assessment, expected additive migration inventory/ACL comparison
and rollback limits, followed by separately authorized normal hosted synthetic QA.

No new credentials, external access, paid provider, number purchase or commercial
decision is needed to implement/test this proposal locally. Any additive RPC and
its narrow authenticated execution grant require the existing schema/security
review and explicit release gate; no blanket access-policy exception is proposed.
Live communication still separately needs approved sender/use case/consent and
recipient/spend limits, provider verification/configuration and activation approval.
New-draft delivery/sent/acceptance semantics, PR58 production usability, PR48 PDF,
jobs/scheduling, payments, team permissions and launch documentation remain open.

### Persistent contact notes — implemented local draft candidate

Supersedes the proposal-only status above for this bounded implementation.
Base/main inspected: `e976a250cd19083cc93d3292b9ea66f3c7960eef`; open PR48/58
and all prior worktrees preserved. The two local documentation-only records above
are carried forward into this draft; no unrelated product implementation is imported.

- [x] Ordinary authenticated Contact Detail > Note opens a visible accessible form.
  Save persists an internal `note` in existing `activities`; cancel/Escape writes
  nothing. Text renders escaped and multiline, with server creation time distinct
  from an absent due date. Contact-list latest activity recognizes undated notes.
  No DEV/loopback activation flag or server-only legacy repository import.
- [x] `create_crm_contact_note(uuid,text,text)` derives its owner from `auth.uid()`;
  locks and validates an owned contact, trims boundary whitespace, bounds text and
  atomically creates the activity plus an owner/request retry record. No browser
  owner argument, external send, status transition, or note edit/delete feature.
- [x] Concurrent replay uses the same result; changed payload is rejected. Deleted
  or owner-edited source activity cannot silently become an unchanged replay.
  Existing contact/user cascade and owner activity CRUD remain unchanged; no
  immutable/independent note-history or retention guarantee is introduced.
- [x] Same-tab session storage retains only an interrupted note's text/contact/key,
  not credentials. It survives reload until confirmed, is scoped by verified owner
  and contact, and clears on verified sign-out/account change. Blocked storage
  prevents a fresh RPC; retry-storage failure preserves an already-uncertain key.
  Late completion cannot erase a newer request. Tab closure/sign-out ends this
  browser recovery boundary; reload history before manually starting another note.
- [x] Saving disables duplicate submit/cancel/edit. Unknown outcomes preserve the
  request; permission/validation failures keep text repairable. Contact/account
  navigation guards prevent late repaint. Missing RPC during schema rollout keeps
  text repairable and does not call a different persistence path.

Only migration: `20261021210325_create_crm_contact_note.sql`. It adds private
hash-only `crm_contact_note_requests` with RLS/no client/service-role table grants
and the narrow authenticated RPC. Response excludes owner/request/fingerprint
metadata. It adds no column, backfill, existing-table grant or policy exception.
Tombstones contain contact/activity IDs, server time and request hash, not a note
copy; they survive source deletion to prevent retry resurrection, and cascade on
owner deletion. This is local schema 57 against hosted/main schema 56.

Executed verification on this composition:

- [x] Clean complete 57-version Supabase replay (no seed, no hosted connection).
- [x] Transactional `supabase/tests/crm_contact_note.test.sql`: actual anon denial,
  owner/foreign/missing-contact authorization, private-ledger denial/RLS, invalid
  and Unicode whitespace inputs, safe response, create/replay, payload conflict,
  owner-edited/deleted activity, cross-owner key reuse and source-delete tombstone.
  SQL fixtures rolled back.
- [x] `supabase/tests/crm_contact_note_concurrency.mjs`: five observed real lock
  races — concurrent identical replay, payload conflict, contact-delete first,
  note-create first followed by contact deletion, and activity deletion after a
  locked replay. Fixtures cleaned. Requires explicit local opt-in and owned
  loopback database URL; never supply a hosted URL or print credentials.
- [x] 134/134 affected regressions across 11 files; app/API types and production
  builds PASS. Independent current implementation review PASS with 37/37 tests.
  Review found and corrected uncertain retry-key loss on storage failure; its
  navigation test setup now mirrors actual beginUnbound/bindCurrent semantics.
- [x] Real local production-build Auth/browser note scenario 1/1 PASS (12.0s),
  starting with Auth profiles only and zero CRM records. Normal UI creates the
  contact, saves/cancels a note, injects a denied execute permission, double-clicks,
  loses the real committed RPC response, reloads and replays the same key, verifies
  escaped XSS/multiline text, mobile/keyboard use and contact/account races. The
  initial harness's network-idle wait was corrected because a deliberately held
  request cannot become idle; no application assertions were weakened.
- [x] Existing actual production-build empty-account lead/quote/property/contact
  regression 3/3 PASS (19.1s) against the same 57-version composition. All browser
  requests are restricted to exact owned app/backend loopback origins; specialized
  handlers revalidate origin/path before fetching. No external messages, calls,
  acceptance, invoice creation, site generation or terms acceptance occurred.

SQL/concurrency/browser suites are opt-in local evidence, not claims that the
existing GitHub workflow automatically executes them. Exact committed-head review,
normal draft push and exact-head CI are publication gates. No merge this unit.
Before any later merge, recheck main/head/review/CI, exact one-version migration
delta and narrow ACLs, then monitor both automatic integrations. Git revert can
remove UI wiring; it does not undo additive SQL, stored notes or retry tombstones.
Dropping objects/deleting stored data would be a separate destructive action;
no downgrade SQL, production migration or cleanup is authorized here. Hosted
normal-UI note verification remains a later release gate. This does not activate
telephony, provision a business number, complete the inbox or resolve PR48/58.

Post-test local metadata: Auth fixtures 0, race profiles 0, ledger 57/latest
`20261021210325`, note RPC authenticated execute true/anon false, private-ledger
authenticated/service-role SELECT false, ledger RLS true, lead execute restored.
PR58 still contains the older unpublished migration
`20261021064220_read_accepted_quote_invoice_evidence.sql`. If notes lands first,
that later release must reconcile migration ordering against the new ledger;
do not bulk-merge the old local stack or manually repair hosted history. PR58 is
unchanged here and is not a prerequisite for notes.

### PR63 draft publication checkpoint

Published normal branch `codex/authenticated-contact-notes` as draft PR63:
https://github.com/Hansveer-C/website-CRM/pull/63
Exact remote head `7145de8f22fdbd4d3aa1c2987e29827accdc5be7` received independent
exact-head PASS (37/37 independently run tests; no residual findings). All ten
workflow jobs PASS on that SHA:
https://github.com/Hansveer-C/website-CRM/actions/runs/39678635155
Vercel preview completed; Supabase preview was skipped. The PR is still draft,
unmerged and clean against unchanged main `e976a250cd19083cc93d3292b9ea66f3c7960eef`.
No hosted SQL, fixtures, credentials, provider or settings changes occurred.
Local Auth/race fixtures are zero, the owned stack is stopped, TLS files and app
listeners are removed, and unrelated newsletter services remain running. This
checkpoint is local documentation only; it changes no reviewed PR source bytes.
Next action is the scoped release/migration-risk decision above, not automatic
merge or a claim that hosted notes or the communications-first MVP are complete.

### PR63 approved automatic database/application release

After the owner explicitly approved merging PR63 and allowing its additive
automatic database update, the release rechecked unchanged reviewed head
`7145de8f22fdbd4d3aa1c2987e29827accdc5be7`, main/base `e976a250`, independent
exact-head PASS and all ten successful CI jobs. Candidate inventory contained
57 versions; excluding only `20261021210325` matched all 56 hosted versions
(digest `92dc3533d42950746420ac1b4e38b6fa`). No materially changed risk appeared.

PR63 merged at 21:53:50 UTC October 21 as
`e7f766aedb36e9bb1f3f90285433ad199888d547`; tree exactly matches reviewed head.
Vercel production for that exact SHA is READY, assigned website-crm-one.vercel.app:
https://vercel.com/hans-says-projects/website-crm/GcHqEfj8e73Jtm4kWhrVCSxts2C8
The live page and `/assets/index-CUhSiucD.js` return HTTP 200; the asset includes
the note editor, RPC wiring and retry state. Exact-SHA Supabase integration check
completed SUCCESS at 21:54:28 UTC; project `jkwfocgqgltdmprhdmji` ACTIVE_HEALTHY.

Read-only catalog verification after terminal success:

- Ledger 56 -> 57, with only `20261021210325` added; latest equals that version.
  Full version digest `d544127b75ed71be63e9142c9fa32793`; excluding the new version
  still matches the prior 56-version digest above.
- Pre-existing object/column/default/constraint/function/grant/RLS-policy catalog
  digest unchanged: `8e298e0a3f354c223f0fd42280853835`, excluding only the expected
  new private ledger/PK and public note RPC from both pre/post comparisons.
- Private retry ledger exists, RLS true, no policies and no anon/authenticated/
  service-role CRUD grants. RPC authenticated execute true; anon/service-role
  execute false. SECURITY DEFINER and empty search_path match reviewed source.
  Hosted RPC source digest `0760cd76cc609e69235665325a274643` exactly equals the
  reviewed migration body, including ownership checks and safe JSON projection.
- No non-internal triggers are attached to public.activities. No hosted note RPC
  or records were invoked/read by this lane; no manual SQL mutations, settings,
  credentials, provider actions, external communications or spending occurred.

PR48 and draft PR58 exact heads remain unchanged. PR58's unpublished migration
`20261021064220` now precedes the applied latest version; its separate future
release must reconcile that ordering against fresh main before merging, without
manual hosted ledger repair or blindly publishing the accumulated local stack.
Rollback remains limited as described above: a UI revert leaves SQL/data; no
destructive downgrade is authorized. Parent will now run normal hosted Note UI
verification on its preserved synthetic contact. Until that evidence arrives,
do not claim hosted note-save/reload usability from deployment/catalog checks.
This release evidence is a local documentation commit, not another deployment.

### Hosted PR63 Note usability verified by parent

Parent's normal authenticated production browser check on existing synthetic
contact `bcc17ea5-4bf9-4304-9a3a-7d886bef848a` saved exactly one reported marker
`QA internal note20261021 2158` at `2026-10-21T21:58:39.835574Z`. Full reload
retained that marker once with the same creation timestamp. Literal HTML-like
text (`<b>not bold</b>`, an ampersand and quoted text) displayed as text, with
no B element. A second unsaved `QA CANCEL ONLY` note was cancelled; reopening
showed an empty textarea, and full reload showed the cancelled marker absent
and saved marker once. No external sends occurred. This is supplied hosted UI
evidence, not an independent repetition or hosted-record query by this lane.
The bounded hosted Note save/cancel/render/reload gate is now passed. It does
not certify live communications, estimate delivery/acceptance or invoicing.

### Next coherent milestone proposal — customer estimate review and acceptance

Read-only planning on main `e7f766aedb36e9bb1f3f90285433ad199888d547`; no code,
migration, new access grant, provider action or production change this turn.
The canonical workbook's dated current-status tab and existing reconciliation
overlay still anchor communication-first direction and the customer -> estimate
-> service-location -> job -> invoice journey. Their older snapshot labels do
not supersede the named deployed/hosted evidence above or certify later modules.

Recommended user-facing outcome: an owner prepares an estimate, deliberately
creates a restricted customer review link, the recipient reviews scope/options
and service location, accepts a selected option, and the owner sees a durable
accepted estimate with matching frozen evidence after reload. A copy-link/manual
sharing pilot is proposed to avoid live provider activation; do not claim copying
a link means it was delivered. Deliver the complete reviewed flow as a usable
milestone, not another hidden QA-only conversion or a fake Send button. Actual
SMS/email delivery and its conversation integration remain separately gated.

Verified implementation gaps:

- Production `sendQuote` refuses sending; the visible list hides Send/option
  controls when `editable=false`. The legacy send path mutates arrays and runs
  automations; it must not become the real delivery contract. No review-link,
  customer capability or delivery transaction was found in current source.
- Production acceptance UI exists for an already-`sent` owned quote, but ordinary
  new drafts have no server transition into that state. `accept_crm_quote` requires
  `auth.uid()` ownership and `status='sent'`; `actor_user_id` is a non-null owner
  user FK. An unauthenticated customer link cannot safely call it by pretending to
  be that owner or by placing a service key in the browser. A distinct recipient
  authorization/audit contract must be designed before exposing this path.
- New quotes default to Basic. Production option selection is disabled, while
  acceptance snapshots all tiers. Recipient choice needs atomic server validation
  of a nonempty selected tier and its recomputed amount, not a client total or
  unreviewed status update. Preserve existing USD evidence, pre-acceptance revision
  R, approved quote revision R+1 and invoice input `acceptance.quote_revision=R`.
- The composer labels `quote.notes` "Internal notes or terms", while preview
  renders it as Additional notes. It cannot simply be copied into a customer
  projection. Customer-facing terms/scope must be distinguished from internal
  notes and frozen as the exact text reviewed; no legal terms are invented here.
- A review link must bind the exact released quote/options/location/terms.
  Quote revision or service-address changes after issue must revoke/reject stale
  review/acceptance, not sign a different amount/address than the recipient saw.
  Preserve existing legacy/unassigned acceptance behavior rather than backfilling
  an address or silently inventing a new retention policy.

Bounded contract/design decisions before implementation/release:

1. Confirm copy-link/manual sharing versus an actual provider send for the pilot,
   and define truthful issued/shared/delivered state semantics. Do not label a
   newly generated link "sent" without an agreed contract; existing sent-state
   acceptance rules cannot be bypassed by a browser update.
2. Agree the minimal recipient-visible fields, customer terms/source/version,
   whether customers choose among tiers, and the acceptance actor model. A bearer
   link proves possession, not independently verified customer identity. Do not
   forge an owner actor or reuse website-generation consent as service terms.
3. Define owner revoke/replace behavior, expiry, one-estimate/revision scope and
   already-accepted/retry behavior. Proposed capability storage is hash-only,
   high-entropy and private; raw links/signatures must stay out of logs, analytics,
   referrers and public storage. Raw-link recovery/rotation after response loss
   needs explicit behavior rather than storing recoverable credentials by default.
4. Public recipient access is a new narrow security surface, not authority already
   granted by PR63's note migration approval. Prepare a concrete local design and
   synthetic proof, then obtain scoped owner approval before production exposure
   or changed acceptance actor/access grants. Routine local reversible code/test
   preparation needs no provider credentials or paid service. No extra access or
   persistent server secret is presumed available/authorized.

Proposed implementation boundary after those choices: reuse existing quote/item,
acceptance and service-location evidence through a reviewed shared canonical
transaction; add only necessary private review-session/audit/idempotency metadata
and narrow owner/recipient operations. No anonymous table reads, private signer
evidence projection, automatic send/call, invoice/job creation, routing or campaign.
Use ordinary production UI and a restricted recipient route; keep internal contact
history truthful (link issued/accepted are events, not fake SMS delivery records).

PR48/58 and migration sequencing:

- PR48 remains `2b1954d6c43d850569f1eabbe21456391d88ea03`, invoice PDF only.
  Its stated 52-migration blocker is stale: `20260901110000` is already canonical
  main and applied per earlier read-only release evidence. Main/PR48 migration
  blob is identically `d1d1c1bce7d837c7bf8f1a1b047c34ffb6336c6d`. Do not rerun
  it or repurpose invoice PDFs as estimate delivery. Fresh-base review, private
  Storage and deployed server configuration/authorization still need verification;
  no readiness claim or credentials/bucket change is made in this planning turn.
- PR58 remains draft `ae5a23d2490bb362844f0a3a5c0effda55544c92`, explicitly
  DEV/loopback-only invoice conversion, preserving selected-tier/revision contracts.
  Its old `20261021064220` evidence-read migration precedes deployed latest
  `20261021210325`; a future refreshed release must reconcile ordering and rerun
  fresh-chain/legacy tests. Do not merge it unchanged just to add another hidden
  surface. Production invoice wiring is a later useful continuation once ordinary
  estimates can actually become accepted; preserve issued-invoice financial rules.
- Any new estimate-review migration is generated with the established CLI on fresh
  main after version `20261021210325`. Exact pending versions, additive/rollback
  effects and access changes must be reviewed before a separately authorized
  automatic release. No manual ledger repair, baseline DDL or bulk local-stack
  publication. PR48 and PR58 are not modified or made dependencies unnecessarily.

Milestone end-to-end acceptance tests: start with an empty authenticated local
owner, create lead/draft/items/location through normal production-build UI; issue
and copy a restricted review link without provider calls; open a separate synthetic
recipient context, review exactly the frozen projection, choose an eligible tier
and accept once; owner reload shows approved status and matching frozen scope,
amount/currency/location/terms. Exercise foreign owner, quote-ID enumeration,
missing/invalid/expired/revoked capability, cross-revision/address edits, concurrent
owner edits/revoke versus acceptance, lost-response/double-click replay and changed
payload conflict, already accepted, malformed signature/typed declaration, XSS,
mobile/keyboard, account/navigation races and zero private evidence leakage.
Run clean full-chain SQL/ACL and existing legacy owner acceptance/invoice regression
tests, including all-tier snapshots with selected-tier-only invoice amounts and
R/R+1 checks. Invoice compatibility tests use disposable synthetic local records;
do not issue real invoices or accept an actual customer agreement during QA.
Independent exact-head review, CI, actual automatic deployment checks and separately
approved hosted synthetic owner/recipient UI testing finish the release. Live
telephony still separately needs sender/use-case/consent/recipient/spend approval;
this plan buys nothing and does not imply that dedicated-number service is built.

## Local estimate review/response proof — production access held

Implementation base: main `e7f766aedb36e9bb1f3f90285433ad199888d547`
(PR63). The three existing local PR63 publication/release/hosted-note evidence
commits were carried forward unchanged above. This section supersedes the earlier
proposal only for the bounded LOCAL proof; it does not approve public launch.
PR48 and PR58 remain unchanged and are not dependencies.

Implemented scope:

- Owner deliberately generates/revokes one unrevoked review link per estimate.
  Issue/replay is atomic and owner-derived. Raw 256-bit random token exists only
  in page memory and a URL fragment; only SHA-256 is stored privately. No token
  recovery, local/session storage, analytics, automatic sharing or delivery claim.
  Lost issue responses retain exactly the same key/token/text until confirmed.
  Reload without the raw link requires deliberate revoke/reissue.
- Default 24-hour expiry is an ACCESS lifetime, not a promise of price validity
  or new legal terms. Expired/revoked links cannot read or respond. An owner may
  record a response actually received before expiry if not revoked and the
  commercial/location source is unchanged. Revoking blocks recording; it does
  not delete private evidence. Quote/owner deletion cascades this proof metadata;
  no new retention policy is represented as settled.
- Customer projection is only explicit customer-facing review text, estimate
  service names/descriptions, quantity/unit price/line total, available tiers,
  USD, exact revision and service address. No `quote.notes`, contact name,
  phone/email/billing address, activity/internal notes, ownership IDs, request
  fingerprints, signatures or raw tokens are returned. Property label is omitted.
  Customer-controlled strings render through DOM text nodes, never HTML.
- Source snapshot/hash includes all disclosed items/prices/location plus source
  identity/revision/status/selection/total. Locks protect quote/property/items;
  source changes without a revision bump also invalidate pending review.
- Recipient chooses an existing tier and types their own name with explicit
  scope/price confirmation. Possession is not verified identity. Response is
  PRIVATE proof, not immediate canonical approval. Owner deliberately records
  that actual response in a second step through unchanged `accept_crm_quote`.
  Canonical actor remains the owner; recipient name/confirmation proof stays
  separately attributable. This avoids pretending the existing owner RPC is an
  anonymous customer actor. No invented signature, payment or agreement text.
- Compatibility state `sent` exists only inside the owner-recording transaction;
  no committed delivery transition or communication event is created. The RPC
  refuses custom quote/acceptance triggers before this step. Accepted revision
  remains R, live approved revision R+1; selected-tier amounts feed the unchanged
  invoice conversion contract. No UI invoice creation or invoice PDF work added.
- UI uses normal existing lead/estimate/location screens and local-only review
  entry/recipient route. Unsaved/loading/conflicting service-location selection
  blocks issuance/recording. Busy/unknown requests freeze payloads and prevent
  duplicate clicks; malformed successful responses preserve keys and token.
  Account/navigation/root guards reject stale paints. Accepted estimates cannot
  issue replacements after revocation.

Migration `20261021221056_local_quote_review.sql` adds two PRIVATE RLS tables and
narrow owner/capability functions. It changes no existing table policies/grants,
quote acceptance implementation, invoices, provider configuration or credentials.
Runtime defaults OFF. No recipient EXECUTE is granted to anon/authenticated/
service_role. Four owner functions have authenticated EXECUTE but reject while
OFF. Only explicitly guarded disposable local tests enable the runtime and grant
recipient execution; cleanup restores disabled/no-recipient-access state. The
front end additionally requires DEV=true, explicit local QA flag and BOTH exact
owned loopback app/backend endpoints. Production with that flag enabled denies
the route and makes zero review RPC calls. This is LOCAL proof, not a usable
hosted customer acceptance feature yet.

Verification on this composition:

- Complete clean 58-version local Supabase replay PASS, no seed or hosted access.
- `supabase/tests/crm_quote_review_local.mjs`: 50 assertions PASS. Default private
  table/capability denial, runtime-off denial, foreign owner denial, token
  enumeration/malformed denial, minimal disclosure, eligible-tier validation,
  identical/changed retry, canonical actor/revision/snapshot, stale item mutation,
  revoked/expired access, timely response recorded after expiry, reused canonical
  acceptance key rejection and selected-tier invoice compatibility are exercised.
  Six observed real lock races cover same-key response, conflicting response,
  quote-delete-first, both revoke/finalize orderings and concurrent finalization.
- Real local Auth/browser proof starts with Auth identity/profile ONLY and zero
  contacts/properties/quotes/activities/acceptances. Ordinary UI creates lead,
  draft/items/location, issues review, opens separate anonymous browser context,
  confirms actual scope/price/name, records owner acceptance, reloads and revokes.
  XSS text, mobile width/keyboard, lost issue response and malformed committed
  create/recipient/finalization responses are checked with identical retry keys.
  Messages/calls/invoices/websites remain zero. No external sends or site terms.
- Production build with `VITE_LOCAL_ESTIMATE_REVIEW_QA=true`: unavailable route,
  zero review RPC requests, actual browser PASS. Local runtime restored OFF and
  recipient grant revoked afterward. No hosted public link was created.
- Affected unit/type/build checks and independent exact-byte review are recorded
  below after final validation. Existing tests are reused; no assertions weakened.
  Independent review found and corrected premature pending-key disposal on
  malformed responses and floating-point total mismatch; cents arithmetic and
  malformed-ID regressions now protect these boundaries.

Before production activation, obtain scoped decisions/approval for bearer-link
recipient disclosure/access and the additive persistence, 24h access/revoke and
owner-recording semantics. Confirm whether direct customer canonical acceptance
is desired instead (it would require a separately reviewed actor contract). Agree
pilot recipient identity/disclosure and explicit customer text; no new legal terms
are assumed. A later reviewed activation must choose production route/RPC gating,
manual sharing versus actual provider delivery, public endpoint abuse/recipient
limits, link confidentiality/referrer/log controls and hosted synthetic QA.
Do not enable anonymous functions or toggle the private runtime in hosted SQL as
an ad hoc workaround. This unit is neither merged nor deployed and authorizes no
provider send, number purchase, hosted migration, access grant or credential.
Git revert removes wiring but cannot erase added private objects/evidence;
destructive downgrade/retention choices require separate approval. PR58 migration
ordering still needs reconciliation before its own release. PR48 stays separate.

Final validation receipt: 171/171 affected unit regressions across 14 files,
app/API TypeScript PASS, real local empty-account/recipient proof 1/1 PASS,
and actual flag-on production build/browser negative 1/1 PASS. Nine existing SQL
suites passed on schema 58: properties, service location, transactions, acceptance,
invoice conversion, tier/nonfinite hardening, document specs and internal notes.
The first standalone legacy acceptance invocation lacked its documented fixture
users/contact; it stopped on the FK before mutation. Re-running the legacy group
with the canonical synthetic prerequisite records inside one rolled-back
transaction passed; no schema/auth function replacement or assertion change.
Independent review PASS after fixing malformed response and fractional-total
findings. Exact committed-head confirmation follows the implementation commit.
Local cleanup metadata: 58 versions, latest `20261021221056`, runtime false,
anon/authenticated capability execution false, 0 review rows, 0 profiles and 0 Auth users.
Remote read-only PR inventory still contains only PR48/58 at their recorded heads.
No draft was published and no new CI/deployment or hosted QA is claimed here.