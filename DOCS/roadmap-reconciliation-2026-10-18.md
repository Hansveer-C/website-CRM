# WashOps CRM — Roadmap Reconciliation (2026-10-18)

**Status:** Proposed documentation-only reconciliation; pending human review/merge.  
**Canonical product roadmap:** `CRM Roadmap.ods` (unchanged by this proposal).  
**Canonical repository:** `Hansveer-C/website-CRM`.  
**Verified remote main:** `721772925cc113e96e4d6603d4732e4e1ecc2ad8` (2026-10-18).  
**Evidence scope:** remote GitHub main/PR metadata and existing September 2026 Stage-2 capability audit, Stage-3–6 research, Builder roadmap, project instructions, and October 18 Control Plane pilot planning record. This is **not** a fresh 160-capability code/test/production audit. Local worktree and production database were not inspected.

## Authority and reconciliation rules

1. Current verified WashOps implementation and tests outrank historical roadmaps. September Stage-2 maturity scores are **historical baseline only**, not current completion claims.
2. `CRM Roadmap.ods` remains the product roadmap; the Builder roadmap remains its subsystem roadmap. This document is a dated status/decision overlay, **not** a replacement execution authority or second roadmap.
3. The October 18 `DOCS/control-plane-pilot.json` explicitly has `ACCEPTED_FOR_PILOT_PLANNING_ONLY`, `PARKED`, no routing, no execution authority and no automatic continuation. Do not equate planning acceptance with implementation, deployment, or launch authorization.
4. Do not import another project's commits, tasks, agents, milestones or architecture into WashOps. Preserve human merge/deploy/production gates.

## Verified current GitHub facts

- `main` at `721772925cc113e96e4d6603d4732e4e1ecc2ad8` merges PR #52, accepting a **single Control Plane pilot for planning only**. PR #51 introduced its proposal. Neither changes the product-roadmap authority.
- The intervening September 8–12 merges concern agent/skill instructions and routing cleanup, not proof of new CRM product modules.
- **PR #48** (`feat(invoices): add server-side invoice PDF artifacts`) is **OPEN and UNMERGED** as checked October 18. Its PR description says production migration `20260901110000` must be deployed and verified before merge; verify live migration ledger and PR checks before any resolution. Do not count its invoice-PDF functionality on `main`.
- `DOCS/db-base1-production-ledger-runbook.md` separately documents the `20260325170300` baseline ledger-repair gate. **These are distinct migration versions and tasks**; do not conflate them or assume either is resolved.
- `DOCS/ARCHITECTURE.md` includes older `user_id` and mock-interceptor wording. The September audit identified coexistence of `user_id` tenancy and `tenant_business_identity` as intentional compatibility/debt; validate current contracts before editing architecture prose or tenancy.

## Capability status: evidence and remaining verification

| Area | Last verified product maturity (September Stage 2) | October 18 status |
| --- | --- | --- |
| Auth, tenant/RLS | P02/P03 maturity 3 | Preserve foundation; current authorization and compatibility still require fresh verification |
| Leads/customers/opportunities/activities | C01 4; C03/C05/C06 3 | Existing foundation, not an assertion of full launch readiness |
| Properties/service catalog | C04/C12 0 | Launch-critical gap at historical audit; current implementation not re-audited |
| Estimates/acceptance/invoices | S01/S02/S04/S08 3 | Foundation; end-to-end commercial lifecycle still needs verification |
| Invoice PDF | S09 2 | PR #48 open/unmerged; production migration gate unresolved from available evidence |
| Jobs/scheduling | J01–J14 0 | Historical gap; must verify before scheduling UI/provider adoption |
| Payments | S10–S14 0 | Historical gap; Payment/Allocation/idempotency contract before provider choice |
| Communications | M01 0; M04/M07/M09/M10 2 | Canonical Conversation missing in historical audit; native phone/SMS direction retained, not completed |
| Website Builder | W01–W04/W07 4; W05 and many others 2–3 | Strongest historical subsystem; preserve draft/live, tenant, server-authoritative publish; no fresh maturity promotion |
| Automations/AI/reporting | A01–A09 and R01–R08 0 | Historical gaps; Control Plane planning does not complete these |
| Production ops | I05 1; I06/I07/I09 0 | Stage-6 research complete for observability/alerts/abuse, not implementation |
| UI/mobile/docs | U01/U02 2; U09/U10 0 | UX and required Quick Start + searchable User Manual remain launch gates |

**Research status:** Stage 5A broad discovery and Stage 6 deep dives T04 (governance), T03 (operations), T02 (media), T01 (estimate PDF) are complete **as research only**. Stage 7 technical due diligence remains next for shortlisted candidates; Stages 8–10 licensing/security/integration review and explicit adoption decisions remain. Preserve gated SOON research dependencies. Supabase native image transformations + TUS/Uppy are preferred *candidates*, not adopted product capabilities; pdfmake/pdfme are estimate-PDF candidates, not replacements for PR #48's existing invoice artifact work.

## Launch and product-scope decision register

**Launch calendar:** Prior September Launch V1 freeze / September–October Seed Launch dates are stale and must not be displayed as active commitments. The later discussed strategy is private user testing/hardening before commercial exposure, with a *proposed* founding cohort in early 2027. No new fixed launch date or revenue/customer commitment is established here.

**Launch V1 product hypothesis (requires explicit product freeze):** smallest polished lead → estimate → job → invoice flow, with communications as a differentiator; include necessary property, scheduling, payment, tenant/permission, operational-safety and onboarding boundaries based on actual acceptance tests. Do not label any of these complete without current evidence.

**Packaging:** Starter / Growth / Pro, phone, and AI Receptionist capacity are *provisional* packaging concepts, not verified pricing or an implementation entitlement contract. Require explicit human commercial decision before binding billing/entitlements or public claims.

**Communications:** Preserve the WashOps-owned Conversation / BusinessNumber / Message / CallRecord architecture, business-number provisioning/porting, browser calling and call-through bridge as intended product direction. Distinguish V1 must-haves from conditional or post-launch VoIP, recording, transcription and AI features at scope freeze.

## Dependency-driven execution frontier (proposed, not autonomous authorization)

1. **Baseline/roadmap status audit — first bounded unit.** Verify repository identity, remote, branch, HEAD, worktree; inspect `CRM Roadmap.ods` and current product contracts/tests; reconcile 160 capability IDs and relevant accepted completion reports against `main`. Produce evidence-backed status/delta, explicit blockers, and proposed minimal roadmap edits. No application mutation or launch date invention. **Done:** every status change has a code/test/merged-PR reference and uncertain items remain unknown.
2. **Product scope and launch gates — human decision.** Freeze V1 inclusions/deferments, communications minimum, pricing/entitlement assumptions, and private-test success criteria. **Done:** approved decision record and revised milestone calendar; no unapproved dates.
3. **Implement bounded product dependencies after approval.** Prioritize Property → Job → SchedulingEvent/Resource and quote→job continuity, while separately defining Payment/Allocation and Conversation contracts; select narrow next eligible unit only after the baseline audit. **Done:** per-unit tenant/auth, concurrency, persistence, failures, migrations, responsive/accessibility and tests pass; human PR/release gates remain.
4. **Production hardening and launch readiness.** Complete observability, abuse controls, backups/restore validation, documentation, onboarding, commercial billing, end-to-end test flows and private user testing. **Done:** verified operational and customer acceptance gates, not merely UI screenshots.

## Immediate known gates

- PR #48 production migration `20260901110000` status must be checked independently; do not merge on historical PR text alone.
- DB-BASE1 ledger repair `20260325170300` is a separate production-sensitive gate; require exact production identity/schema equivalence and human approval.
- No Control Plane execution, roadmap registration, routing, or automatic continuation without separate authorization.
- No Stage-7 candidate integration or license/security exceptions without the required checks and approvals.
- Do not silently change the canonical `CRM Roadmap.ods` workbook; reconcile its actual rows and dependencies first.

## Proposed documentation acceptance

Review this as a **status overlay only**. A follow-on bounded task should update the actual workbook/Builder and launch milestones after reading their current contents and verifying the corresponding implementation. Do not mark the overall roadmap 'fully up to date' until that source-of-truth reconciliation is complete.

**Sources:** `CRM Roadmap.ods`; `DOCS/control-plane-pilot.json`; `DOCS/ARCHITECTURE.md`; `DOCS/db-base1-production-ledger-runbook.md`; PR #48; September Stage-2 audit, Stage-3–6 reports, Builder Canonical Roadmap; project execution directive.
