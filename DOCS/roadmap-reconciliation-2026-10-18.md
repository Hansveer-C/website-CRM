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
