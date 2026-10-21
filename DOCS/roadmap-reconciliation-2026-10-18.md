# WashOps CRM — Roadmap Reconciliation (2026-10-18)

**Status:** Documentation reconciliation updated 2026-10-21; PR53 remains draft pending validation/release gates.

**Canonical product roadmap:** `CRM Roadmap.ods`. Open its first/active tab, `Current status 2026-10-21`: rows 1–5 explain authority and evidence, row 6 defines the six columns, rows 7–23 record current direction/status/acceptance, and rows 24–25 define evidence labels and sources. Original `Sheet1` and `Sheet2` remain historical evidence, preserved verbatim; their Done labels are not current product certification. The dated sheet is the current reconciliation within the same canonical workbook, not another roadmap.

**Canonical repository:** `Hansveer-C/website-CRM`.

**Verified remote main:** `7d361596e6994e0371ac20ef18a85cb833de5651` (2026-10-21).

**Evidence scope:** this update inspects local exact-head code, original workbook XML, GitHub PR/check/deployment metadata and supplied source decisions. Prior September Stage-2 capability audit and Stage-3–6 research remain historical. This is **not** a fresh 160-capability or production audit. Production database and live telephony were not inspected. A focused PR55 SQL rerun is separately identified below; no production readiness is inferred.

## Authority and reconciliation rules

1. Current verified WashOps implementation and tests outrank historical roadmaps. September Stage-2 maturity scores are **historical baseline only**, not current completion claims.
2. `CRM Roadmap.ods` remains the product roadmap; the Builder roadmap remains its subsystem roadmap. The current-status sheet and this dated evidence/decision overlay reconcile that existing authority, not a separate management system. Status labels distinguish verified main, pending PR, source-reported evidence, limited independent tests, proposed scope and unverified work.
3. The October 18 `DOCS/control-plane-pilot.json` planning record has `ACCEPTED_FOR_PILOT_PLANNING_ONLY` and `PARKED`. PR54 subsequently adds only the authority specified in `DOCS/control-plane-executable-pilot-v1.json`. Do not broaden that authority or equate planning acceptance with product implementation, deployment, or launch authorization. This reconciliation activates nothing.
4. Do not import another project's commits, tasks, agents, milestones or architecture into WashOps. Preserve human merge/deploy/production gates.

## Verified current GitHub facts

- `main` at `7d361596e6994e0371ac20ef18a85cb833de5651` includes PR #54's narrowly defined read-only pilot authority after PR #52 planning acceptance. Read the exact pilot contract for its limits; this roadmap change activates no routing or production capabilities. Control Plane work does not complete CRM product capabilities.
- The intervening September 8–12 merges concern agent/skill instructions and routing cleanup, not proof of new CRM product modules.
- **PR #48** (`feat(invoices): add server-side invoice PDF artifacts`), head `2b1954d6c43d850569f1eabbe21456391d88ea03`, is **OPEN and UNMERGED** as checked October 21. Its historical description and later source-reported production migration counts conflict. Verify exact project binding and schema read-only; never rerun migration `20260901110000` based on stale PR wording. Do not count its invoice-PDF functionality on `main`.
- **PR #55**, reviewed foundation head `e61cdb8fb6be55e95ba649a022653f335bafc97e`, is **OPEN and UNMERGED**. It adds customer service-location storage, creation RPC and RLS, not rental management or a finished customer workflow. Hans subsequently returned correction ownership to this project lane after Hermes's review; this documentation PR changes none of its implementation files. Ten foundation-head CI jobs passed, but do not run its new SQL suite. The author reports full local replay and concurrent retry proof; independently, 36/36 original assertions passed with minimal contact/RLS prerequisites. The later response-boundary correction `b5a171081c192a94334c0be08efb460ec6c50828` passes 40/40 focused assertions and a separate static review. Focused tests do **not** certify full local Supabase replay, production compatibility or UI completion; recheck exact-head CI before merge.
- `DOCS/db-base1-production-ledger-runbook.md` separately documents the `20260325170300` baseline ledger-repair gate. **These are distinct migration versions and tasks**; do not conflate them or assume either is resolved.
- `DOCS/ARCHITECTURE.md` includes older `user_id` and mock-interceptor wording. The September audit identified coexistence of `user_id` tenancy and `tenant_business_identity` as intentional compatibility/debt; validate current contracts before editing architecture prose or tenancy.

## Capability status: evidence and remaining verification

| Area | Last verified product maturity (September Stage 2) | October 18 status |
| --- | --- | --- |
| Auth, tenant/RLS | P02/P03 maturity 3 | Preserve foundation; current authorization and compatibility still require fresh verification |
| Leads/customers/opportunities/activities | C01 4; C03/C05/C06 3 | Existing foundation, not an assertion of full launch readiness |
| Customer service locations/service catalog | C04/C12 0 | C04 foundation pending PR55; limited independent SQL evidence above. No service-catalog completion claim |
| Estimates/acceptance/invoices | S01/S02/S04/S08 3 | Foundation; end-to-end commercial lifecycle still needs verification |
| Invoice PDF | S09 2 | PR #48 open/unmerged; production migration gate unresolved from available evidence |
| Jobs/scheduling | J01–J14 0 | Historical gap; must verify before scheduling UI/provider adoption |
| Payments | S10–S14 0 | Historical gap; Payment/Allocation/idempotency contract before provider choice |
| Communications | M01 0; M04/M07/M09/M10 2 | Confirmed communication-first direction and supplied business number; existing Message/Call/configured sender foundations. Canonical Conversation/BusinessNumber lifecycle and live phone readiness not verified |
| Website Builder | W01–W04/W07 4; W05 and many others 2–3 | Strongest historical subsystem; preserve draft/live, tenant, server-authoritative publish; no fresh maturity promotion |
| Automations/AI/reporting | A01–A09 and R01–R08 0 | Historical gaps; Control Plane planning does not complete these |
| Production ops | I05 1; I06/I07/I09 0 | Stage-6 research complete for observability/alerts/abuse, not implementation |
| UI/mobile/docs | U01/U02 2; U09/U10 0 | UX and required Quick Start + searchable User Manual remain launch gates |

**Research status:** Stage 5A broad discovery and Stage 6 deep dives T04 (governance), T03 (operations), T02 (media), T01 (estimate PDF) are complete **as research only**. Stage 7 technical due diligence remains next for shortlisted candidates; Stages 8–10 licensing/security/integration review and explicit adoption decisions remain. Preserve gated SOON research dependencies. Supabase native image transformations + TUS/Uppy are preferred *candidates*, not adopted product capabilities; pdfmake/pdfme are estimate-PDF candidates, not replacements for PR #48's existing invoice artifact work.

## Launch and product-scope decision register

**Launch calendar:** Prior September Launch V1 freeze / September–October Seed Launch dates are stale and must not be displayed as active commitments. The later discussed strategy is private user testing/hardening before commercial exposure, with a *proposed* founding cohort in early 2027. No new fixed launch date or revenue/customer commitment is established here.

**Confirmed product direction:** WashOps is a **communication-first CRM**, with a dedicated business VoIP number provided as part of the service. Conversations anchor customer → estimate → service location → job → invoice continuity. A configured SMS sending number or call simulator does not satisfy this direction.

**Launch V1 scope (requires explicit scope freeze):** the detailed communications specification labels its list **Recommended Launch V1**, not a blanket approval of every capability. Define the supported calls/SMS, browser calling/call-through, assignment and commercial journey based on acceptance tests. Mobile VoIP is conditional; recording, transcription, AI and advanced routing remain later. Include the required service-location, scheduling, payment, permissions, operational and onboarding boundaries; do not certify any without current evidence.

**Packaging:** Starter / Growth / Pro, phone, and AI Receptionist capacity are *provisional* packaging concepts, not verified pricing or an implementation entitlement contract. Require explicit human commercial decision before binding billing/entitlements or public claims.

**Communications evidence:** `src/types.ts` contains Message and Call, but no Conversation or BusinessNumber interface. `src/calls_api.ts` explicitly calls inbound/end endpoints secured simulation; a browser simulator is not WebRTC. `src/smsService.ts` uses configured `sending_phone_number`, not a verified per-business provision/port lifecycle. No live telephony validation was performed. Historical sending-number Done labels (Sheet1 row36; Sheet2 row31) and inbound-number planning (Sheet1 row89), conversation grouping (Sheet2 row26), Twilio selection (row29), outbound timeline (row49), missed-call SMS (row56) are historical foundations, not proof of the supplied-number experience.

**Open communication decisions:** WashOps-owned architectural contracts do not imply team-assignee ownership. Shared inbox assignment/handoff/queues, customer export/history portability, port-out/offboarding and retention lack acceptance contracts. Track them as gaps; do not promise them as built. Define synthetic tenant-routing, callback-signature, delivery/call-state, retries/duplicate events, permissions and continuity tests. Provider economics, packaging and included allowances remain undecided; no number purchase or live metered validation is authorized by this reconciliation.

## Dependency-driven execution frontier (proposed, not autonomous authorization)

1. **Baseline/roadmap status audit — first bounded unit.** Verify repository identity, remote, branch, HEAD, worktree; inspect `CRM Roadmap.ods` and current product contracts/tests; reconcile 160 capability IDs and relevant accepted completion reports against `main`. Produce evidence-backed status/delta, explicit blockers, and proposed minimal roadmap edits. No application mutation or launch date invention. **Done:** every status change has a code/test/merged-PR reference and uncertain items remain unknown.
2. **Product scope and launch gates — human decision.** Freeze V1 inclusions/deferments, communications minimum, pricing/entitlement assumptions, and private-test success criteria. **Done:** approved decision record and revised milestone calendar; no unapproved dates.
3. **Implement bounded product dependencies within authorized scope.** Communication-first contracts anchor the journey. After Hans completes PR55 and its merge is verified, check lane ownership, then associate estimates with customer service locations and freeze accepted location snapshots before job/visit conversion. Preserve acceptance revision/current+1 and selected-tier validation consistent with invoice conversion. Define Conversation/BusinessNumber and Payment/Allocation boundaries alongside those dependencies; do not defer communication architecture until the commercial journey is finished. **Done:** per-unit tenant/auth, concurrency, persistence, failures, migrations, responsive/accessibility and tests pass; production and no-spend gates remain.
4. **Production hardening and launch readiness.** Complete observability, abuse controls, backups/restore validation, documentation, onboarding, commercial billing, end-to-end test flows and private user testing. **Done:** verified operational and customer acceptance gates, not merely UI screenshots.

## Immediate known gates

- PR #48 production migration `20260901110000` status must be checked independently against exact binding/schema; do not merge or execute DDL on historical PR text alone.
- DB-BASE1 ledger repair `20260325170300` is a separate production-sensitive gate; require exact production identity/schema equivalence and human approval.
- No Control Plane execution, roadmap registration, routing, or automatic continuation without separate authorization.
- No Stage-7 candidate integration or license/security exceptions without the required checks and approvals.
- Workbook update is explicitly authorized October 21. Preserve original sheets; use the dated current-status sheet for evidence-backed reconciliation. No historical checkbox completion percentage.

## Proposed documentation acceptance

Review this as a **documentation reconciliation**, including the current-status sheet inside the canonical workbook. It updates direction and verification status, not product implementation or a fixed launch commitment. The historical 160-capability audit remains historical; broader row-level implementation verification is still open.

**Sources:** `CRM Roadmap.ods`; `DOCS/control-plane-pilot.json`; `DOCS/ARCHITECTURE.md`; `DOCS/db-base1-production-ledger-runbook.md`; PR #48; September Stage-2 audit, Stage-3–6 reports, Builder Canonical Roadmap; project execution directive.

## October 21 source decisions and completion checklist

- [Confirmed communication-first / supplied-number direction](https://chatgpt.com/c/6a904058-61c0-83e8-8626-cbeef88ceba3?messageId=5e694638-2b5f-4578-a78c-244d111c20c4).
- [Recommended Launch V1 specification, including conditional/later capabilities](https://chatgpt.com/c/6a904058-61c0-83e8-8626-cbeef88ceba3?messageId=e7be0a08-4549-45b5-8c25-540582ff6cf2).
- [Conceptual pricing and number economics, not a settled commercial contract](https://chatgpt.com/c/6a904058-61c0-83e8-8626-cbeef88ceba3?messageId=9bcfa7e7-e2c7-4ae8-b7e8-5557c9b3176d).
- [C04 source completion report; pending-PR evidence, not main completion](https://chatgpt.com/c/6ad7751f-ebb4-83e8-86a8-489957efb078?messageId=7ed2c913-2613-49bd-8f94-8ebcf7299297).

These source decisions were supplied through the parent coordination thread; this lane did not independently retrieve the conversations. Local code and remote PR states were inspected separately.

- [x] Inspect canonical origin, exact PR53 head/ownership, worktrees and existing dirty work. PR53 head remained `098857b90950b99182ff214b8387ad3ab2ee1c9e`; no existing local worktree or newer remote writer found before editing.
- [x] Read original workbook XML and preserve both historical worksheet XML blocks verbatim. Add 25 rows in one dated current-status sheet inside the same canonical workbook. Formatting adds scoped column/cell/page styles and selects the current sheet on open; other archive entry contents are unchanged except `content.xml`, `styles.xml` and `settings.xml`.
- [x] Render through installed LibreOffice Calc and visually inspect both current-status pages. Initial export exposed missing column definitions; corrected with explicit widths, wrapped/merged cells, repeated headers, first/active tab and A3 landscape print layout. Final export is readable in two pages, followed by the unchanged historical sheets.
- [x] Reconcile communication-first direction, dedicated supplied number, proposed launch scope, conditional/later capabilities and undecided economics; replace unsupported completion implications with evidence/acceptance gaps.
- [x] Distinguish verified main, pending PR48/PR55, source/author reports, limited independently repeated SQL and unbuilt/unverified workflows. Keep this documentation PR separate from the delegated PR55 correction and its merge gates.
- [x] Remove PR53's four trailing-space errors. Restrict changes to the workbook and this established overlay.
- [x] Verify normal Hobby push has no added Vercel build cost and no production/provider hooks in tracked CI/build, then update existing draft PR53; no duplicate PR. Preview build is expected, not a no-deployment claim.
- [ ] Complete exact-head independent document review and applicable CI before any merge. Local semantic/ZIP checks do not prove product functionality.
- [ ] After verified C04 merge and lane ownership check, implement accepted estimate/service-location snapshots, then job/visit continuity with communication-first contracts; validate the complete journey.
- [ ] Finish payments, team permissions, phone lifecycle/communication experience, operational hardening, private tests, onboarding and practical user documentation with current executable evidence.

**Remote safety assessment:** PR53's previous SHA has a Vercel Preview deployment/check; main also has successful Production deployment records. Read-only `get_git_deployment_context` verifies the exact linked project/team is Hobby. Parent verification of current Vercel plans/builds documentation establishes standard Hobby Basic builds are included and pause at limits rather than charge overages; numeric remaining quota is unknown. This is not a statement that paid-team builds are free. The earlier `costs_not_found` response alone established nothing. Existing repository configuration has no docs-only ignore rule. Its package build is TypeScript + Vite, with no lifecycle install/build migration/provider hooks; CI uses local PostgreSQL URLs, no injected provider/production credentials, and excludes the SMS backend test. The repository is public and uses standard hosted CI runners. No application, dependency, workflow, deployment setting or PR55 change is needed for this docs-only push. A preview build may occur; no production migration hook was found. Merge to main may produce a Production deployment of unchanged application code and must be assessed separately. Production schema compatibility and the reported fresh-schema grant concern remain separate gates.

**Superseding PR55 handoff (October 21):** the earlier Hans/Hermes ownership pause above is historical. Hans supplied Hermes's `CHANGES_REQUIRED` report and delegated the project back: smallest correction is to omit `user_id` from both create/replay RPC responses and add two absence assertions. Contact deletion cascade is a follow-up for future immutable job/service-location history, not a blocker requiring a new job-domain contract. Keep feature-branch deployment suppression until reviewed. This documentation unit changes no PR55 code; perform the correction next in isolation, rerun actual SQL tests, independently review and verify deployment/out-of-repository triggers before merge. The roadmap current-status C04 row reflects this new handoff; C04 remains unmerged.

**Superseding budget (October 21):** this unit continues with existing/free resources. New subscriptions may be proposed only within a combined CA$30/month ceiling, including taxes/FX, after proving value for WashOps **and** other running projects. A specific service/merchant has not been selected; required transaction approvals still apply. This is not authorization for speculative metered APIs, live phone purchases, production mutations or an upgrade. The current worksheet row 5 reflects this conditional policy; no subscription or other purchase was made.

## Local-only product evidence reconciliation — 2026-10-21

Supersedes the earlier "not started" frontier for the isolated product lane only.
`codex/estimate-service-location` implementation head
`1e44605a33517638286ae63ae22628618094f09e` passed independent exact-head review.
Its established `DOCS/estimate-service-location-unit.md` records service-location
association/frozen acceptance UI and DEV-only RPC-backed persisted invoice conversion.
Invoice-unit verification: 56 clean local migrations, 79 SQL assertions, 218 affected
regressions, app/API types/build, authenticated DEV browser 2/2 and actual production
QA-flag-on negative proof 1/1. The production action remains fail-closed. Screenshots
are synthetic; QA stack/TLS/listeners cleaned and local permissions restored.
These are local branch results, not merged main, remote CI or production certification.
Observed local main ref is now 12021c2 (PR50 skill cleanup); remote heads and production
were not refreshed in this documentation turn. Earlier exact-head remote facts remain
dated evidence, not current assertions.

Proposed next smallest useful unit: authenticated read-only customer communication
history using existing Message/Call storage, timeline ordering/grouping and contact
workspace conventions. No Conversation/BusinessNumber schema, shared-inbox semantics,
provider purchase/provisioning, send/call activation or job domain starts here.
Require auth.uid-based authorization, cross-customer/tenant denial, minimal fields,
stable bounded ordering/pagination, loading/empty/error/retry and account/navigation
race handling. Prove real local Auth/database/browser behavior with synthetic records,
safe rendering and mobile/keyboard use; separately review and run affected checks.
Local worktree/branch inventory shows no matching communication-history owner; running
process names are inconclusive. Parent/remote ownership recheck precedes implementation.

Remaining release: exact production integration-trigger policy, current base/dependent
PR reconciliation, production schema/ledger/grant compatibility read-only, reviewed
production wiring and rollback/post-release evidence. Phone lifecycle, shared ownership,
portability/retention, jobs/scheduling/payments/permissions, private testing, onboarding
and practical documentation remain open. No remote action or implementation in this
reconciliation. The canonical workbook now labels this evidence local-only.

## Aggregate release audit through 39c43ac — local proof, production blocked

Supersedes the earlier next-unit suggestions in this overlay. The existing execution
record `DOCS/estimate-service-location-unit.md` on codex/estimate-service-location
contains the aggregate release packet; it remains evidence under this canonical
workbook/overlay, not another roadmap. Implementation head is
39c43acfeec847884229463b52bc5902cdcec3a2. Communication history, job backend and local
create/read job UI are now tested local increments; canonical Conversation/business
number lifecycle, scheduling, assignments, payments and launch readiness remain open.
No product completion percentage or merged/production completion is claimed.

Reused exact implementation evidence: 307 regression tests, 220 SQL assertions,
59 timestamped clean migrations, 4 authenticated local browser scenarios, production
QA-flags-enabled negative test, app/API types/build and unit-specific reviews. The
aggregate independent adversarial review separately passed 209 tests and found no new
implementation defect, but production is BLOCKED. Invoice/history/job UI flags do NOT
disable their authenticated database RPCs; service-location UI and authenticated quote
saving are not behind those flags. Main automatically deploying is therefore material.

Audit-only focused checks additionally verified the same acceptance creates matching
job/invoice scope totals while keeping billing and service location distinct. A clean
local replay with auto_expose_new_tables=false reproduced missing authenticated read
grants on legacy users/contacts/opportunities/activities. This is a pre-existing fresh-
schema compatibility gap, not evidence production has those ACLs or permission to
issue broad grants. New private job tables and column-limited properties stayed closed.
Resolve exact project/trigger policy, schema/ledger/effective grants, owner erasure,
non-destructive recovery and exact candidate CI/review before release. PR48 remains a
separate non-overlapping PDF lane; do not rerun its migration from stale PR wording.
PR53 remote ceab505 and these newer local documentation edits are distinct. No remote
publication or deployment occurred; workbook historical sheets remain unchanged.

## Proposed single-business telephony pilot - local planning only, October 21

This is a bounded design under the existing communication-first roadmap, NOT approved
launch scope or activation. No code, provider account/settings/credentials, number,
funding, send/call or production change is authorized by this plan. Current rollout
is separate: PR56 main79df126 alignment verified; PR55 main6900bb37 merged and awaits
activation verification in the execution record. Phone work must not add migrations
to that rollout or broaden its authority. Later evidence in that record supersedes
this overlay's historical production/backup assertions; Hans declared target records
disposable, so no backup/export prerequisite is imposed on that test-stage release.

Account evidence supplied by parent's authenticated read-only inspection: selected
the selected existing account is TRIAL with verified-recipient restrictions; no active
or recoverable released Twilio number. Financial account details stay in private
coordination, not this potentially public repository record. A verified caller ID is
NOT a provisioned business number. An existing Messaging Service in US1 exists, empty sender
pool, incoming defers to sender webhook, blank status callback; default STOP/START/HELP,
Advanced Opt-Out OFF; no TwiML applications. This lane did not inspect secrets or the
account independently. Existing balance and an offer to load funds are NOT approved
metered spend, upgrade, number rental or message/call permission.

### Reuse versus gaps

Reuse established Message/Call persistence and timeline projection, phone/message
validation, tenant-auth boundary and server-only SDK separation where verified. Relevant
sources: src/smsService.ts, sms_logic.ts, messages_repo.ts, calls_logic.ts/calls_api.ts,
config.ts and local readonly communication-history UI. Do not introduce a parallel
inbox/store or replace quote/location/job/invoice snapshots. Add minimal canonical
business-number/conversation identity only as a reviewed extension of existing records;
not a new provider-hosted Twilio Conversations dependency by default.

Existing sending_phone_number is account-global; optional caller user_id is not tenant
authority. Call inbound/end APIs explicitly simulate calls; duration60 and mock_call
are not live voice. Existing inbound owner resolution by caller phone must NOT route
real webhooks. Scanned src/api/function code has no Twilio-signature validation or
OptOutType/STOP ingestion boundary. Current rate-limit checks are count-then-send,
not atomic budget reservations; failed count lookup is not a safe permit. SDK15-second
timeout via Promise.race does not cancel accepted provider work; marking all timeouts
retryable risks duplicates. Existing sent means provider acceptance, not delivery.
These are activation gaps to test, not defects silently fixed by this documentation.

### Smallest proposed pilot and acceptance contract

One explicitly identified pressure-washing business, one authenticated operator,
one dedicated approved SMS+voice-capable number, small explicitly consenting/test
recipient allowlist in approved Canadian destinations. Proposed first increment is
manual two-way transactional SMS in existing customer workspace; second is incoming
voice forwarded to ONE approved operator destination with bounded duration/legs and
real call-state logging. No auto lead/missed-call SMS, campaigns, MMS, recording,
transcription/AI, emergency dialing, arbitrary dial targets, porting, shared assignment
or browser/mobile VoIP. A forwarded call is not in-app calling; those remain roadmap
gaps. Neither this pilot nor readonly history completes the communication-first MVP.

- Persist server-controlled binding of business owner, approved provider account,
  messaging service and number identifiers. Deny ambiguous/unmapped bindings; no
  browser-supplied From/owner, global phone-owner lookup or fallback system tenant.
  Authenticated commands resolve owner/contact and consent server-side; webhook
  ownership comes from verified account+destination-number binding. Same customer
  phone across businesses must remain isolated. Unknown numbers fail closed; handling
  new inbound leads is a separate explicit choice, not automatic contact creation.
- Verify HTTPS webhook signatures with maintained Twilio SDK against the EXACT external
  URL/query and all form parameters (or proper raw-body variant), using server-only
  account credential. Do not trust forwarded host headers or accept unsigned callbacks.
  Validate account/number association after signature, size/method/type limits before
  persistence. No secrets, phone payloads or message bodies in general logs.
  [Twilio request-security contract](https://www.twilio.com/docs/usage/security).
- Inbound unique key(account,MessageSid), calls(account,CallSid), with transactional
  persistence before acknowledgment. Callback ledger deduplicates semantic events,
  applies allowed state transitions and rejects conflicting terminal regressions;
  correlate signed callback to an opaque server operation/attempt ID. Outbound owner+
  stable request key fixes recipient/body/purpose/number; changed replay conflicts.
  Atomic outbox/dispatch claim and spend reservation prevent double clicks/workers
  from creating two sends. Provider timeout/lost response becomes UNKNOWN, not failed
  and automatically resendable; reconcile SID/callback/evidence first, hold unresolved
  attempts. Do not promise provider exactly-once delivery or invent an API idempotency
  guarantee. Duplicate callbacks must never trigger another SMS/call.
- Consent records scope business+recipient+channel+purpose, provenance/time and wording;
  phone possession, an inbound inquiry or existing contact is not marketing consent.
  Proposed pilot excludes marketing. Process STOP/revocation atomically before queued
  sends; recheck immediately before dispatch, prevent retries/automation after opt-out.
  HELP/START semantics and English/French wording must match selected service/provider
  behavior. Provider default keyword handling is not proof CRM suppression is synced.
  Avoid duplicate application/provider acknowledgments; record any provider automatic
  replies as spend/behavior outside app dispatch. Reconsent needs evidence, not merely
  a UI checkbox. No real consent submission performed.
- Server activation manifest defaults OFF: exact environment/account/business/number,
  verified sender state, allowed recipients/countries/purposes, active consent, callback
  configuration, explicit approved budget, segment/minute/leg/concurrency limits and
  kill switch. Missing values, stale price/quota data, limit-store failure, inactive
  owner, unverified sender or invalid signatures deny sends. Fixtures use fake adapter
  and synthetic signed requests, never fall back to a real provider if mock setup fails.
  Production UI flag alone is insufficient; block backend dispatch too.
- Budget must cover number rental, SMS segments/encoding, carrier/inbound charges,
  voice BOTH legs and maximum duration, taxes/FX and uncertainty margin. Reserve
  conservatively/atomically and reconcile actual usage; bound unknown attempts rather
  than releasing their reservations. Provider balance/alerts are not a guaranteed
  spend cap; unsolicited inbound traffic/provider auto replies may cost outside app
  controls. Do not claim a hard financial cap until the enforcement/remaining risk is
  understood and approved. No automatic top-up. Existing CA$30 combined subscription
  policy is separate from unapproved metered usage. No numeric cap is invented here.

### Canadian sender strategy and unresolved activation choices

[Twilio Canada guidance](https://www.twilio.com/en-us/guidelines/ca/sms) supports
Canadian domestic long codes and two-way SMS, while recommending verified toll-free
or short code for A2P deliverability. Verified toll-free is the planning baseline,
NOT a claim local SMS is illegal. Evaluate actual use case/capabilities/filtering and
fees before selection; no number selected. Require consent and appropriate HELP/STOP.
[Toll-free onboarding](https://www.twilio.com/docs/messaging/compliance/toll-free/console-onboarding)
requires a paid/non-trial account and approved verification before toll-free SMS to
US/Canada; current guidance also requires a compliance profile before purchase.
Therefore current trial/empty sender pool does not satisfy this baseline. No promises
of approval timing, eligibility or production delivery. No business facts invented.

Before activation Hans must supply/choose: exact operating business and authorized
representative/legal identity/address/website/support and privacy/consent evidence;
whether this is that business's direct account or WashOps acting as ISV for a customer;
transactional use cases/sample messages/opt-in flow, destination countries/languages,
allowlisted consenting test recipients, desired sender type/new number vs later port,
operator forwarding destination/hours and whether call forwarding is acceptable for
this pilot. Provide truthful profile/verification details through secure vendor UI,
not in public repository. Confirm permitted history access/retention for future live
use separately; don't invent team sharing or account-wide data access.

Then present exact fees and specific account upgrade/number purchase/verification
submission/provider configuration actions for approval. Required decision: approved
one-time funding amount, recurring rental ceiling AND metered pilot spend/period,
alerts/stop conditions, recipient count, SMS segment and call-minute/leg limits.
Offered funding without those bounds is not purchase/usage authorization. Business
verification transmits business/contact evidence; real recipient/body data goes to
Twilio on send; call forwarding reaches the chosen destination. Obtain appropriate
specific approval at those actions, including any new credentials/access or binding
terms, rather than a broad permission request now. Do not mint keys, upgrade/fund,
buy/port, configure endpoints or send to validate this design.

### Local implementation sequence that can proceed after this planning review

1. Schema/API contract proposal: extend existing records with durable provider binding,
   operation/event ledger, consent/suppression and spend reservation. Exact migrations
   need their own review after C04 rollout; avoid parallel writers. No schema written now.
2. Pure fake-adapter tests for signature canonicalization (tampered URL/query/params,
   invalid/foreign account), tenant/number isolation, duplicate/reordered events,
   outbox concurrency, STOP racing queued/retry work, lost response reconciliation,
   missing credentials/flags/budget and conservative segment/voice cost bounds.
3. Disposable local authenticated DB/API/browser integration: real local ownership/RLS,
   inbound/outbound fixture history, consent/opt-out UI, pending/unknown/delivered/error
   states, repeated clicks/account navigation races and mobile/keyboard behavior.
   Synthetic TwiML/callbacks only; voice simulation cannot be labeled live validation.
4. Independent exact-head review plus regressions/types/build and production-flag-on
   negative proof; confirm no billable SDK invocation without full activation manifest.
   Only then offer a separately approved, bounded live verified-recipient validation.

No code, workbook history, provider state or rollout configuration changed in this
planning unit. This section is proposed acceptance/design, not built or approved
commercial scope. Dedicated number and communications remain essential product goals.
