# Password recovery release gate

This change adds the missing password recovery UI, separately from invoice PR65.
It does not require a database migration or new privileged credentials.

## Flow and boundaries

- Sign-in links to `/#/forgot-password`. The request calls Supabase `resetPasswordForEmail` with an explicit same-origin root redirect `/?auth=recovery`.
- Every valid email request shows the same conditional message, including provider rejection/rate limit/network outcomes. It does not claim delivery or reveal whether an account exists. Browser validation catches malformed email before any request.
- The supported callback is Supabase's implicit flow: root query marker plus `type=recovery`, access token and refresh token in the fragment. PKCE/code callbacks, duplicate token/type fields, provider errors, missing credentials and non-root callbacks fail closed.
- Callback parameters are erased with `history.replaceState` before the SDK is loaded or any callback request starts. HTML sets `no-referrer`. No token/password is logged, reflected into HTML, or persisted by this feature.
- A separate client using the same canonical Supabase project is memory-only (`persistSession:false`, `autoRefreshToken:false`, `detectSessionInUrl:false`, separate storage key). It does not replace the ordinary CRM session or hydrate CRM data. The router blocks ordinary navigation/auth-state application while recovery is active.
- SDK session exchange and `getUser` must agree on the user; identity is checked again immediately before `updateUser`. Ordinary logged-in state or visiting the update route without a recovery callback cannot open the update form.
- Matching 8–128 character passwords are required. Submission clears both fields, suppresses duplicate updates and displays sanitized uncertainty on a failed/lost response. The recovery client signs out locally after confirmed success; user returns to sign-in. A reload loses the memory-only recovery state and requires a new link. The existing normal CRM session is not used as recovery authority.

## Validation

Run `npm test -- --maxWorkers=1 --minWorkers=1 --no-file-parallelism src/application_recovery.test.ts src/application_auth.test.ts src/application_bootstrap.test.ts src/application_auth_ui.test.ts`.

Run `npx playwright test --config=playwright.recovery.config.ts` with Chrome installed. This uses only loopback port4191 and synthetic mocked auth. It covers keyboard request/update, matching-password validation, mobile overflow, callback scrubbing, invalid/expired links, return to sign-in and actual main-app invalid callback/reload routing. It never sends email or makes a hosted Supabase call. The fixture is outside the production bundle.

Also run app/API typechecks, build, and safe broad Vitest suite excluding `verify_sms_backend.test.ts`. Full hosted email delivery, real recovery session exchange, and the user's password change remain NOT RUN until the release gate.

Mac verification receipt: 92 focused tests passed; final broad suite 2,303 passed / 204 skipped across 152 passing and 14 skipped files; app/API typechecks and production build passed; four local Chrome browser scenarios passed. An initial sandboxed broad run could not launch Chrome for six stored-XSS cases; the authorized unsandboxed rerun passed all 12 stored-XSS tests and the complete broad suite. Build retains the existing chunk-size warning. SMS verification was explicitly excluded; no external messages were sent.

## Exact hosted settings to verify before release/email

Project `jkwfocgqgltdmprhdmji`, app `https://website-crm-one.vercel.app`:

1. Confirm the redirect allowlist permits exactly `https://website-crm-one.vercel.app/?auth=recovery`. Add that exact URL only if missing, under separate explicit approval. Avoid wildcard widening; no preview URLs needed.
2. Confirm recovery email template preserves the Supabase verification URL and redirect (standard `{{ .ConfirmationURL }}` flow). No custom PKCE token-hash template is supported by this implementation.
3. Confirm configured mail delivery can send to `hanssays2020+washops-test@gmail.com`, including default-mailer recipient restrictions/rate limits or existing SMTP configuration. No new provider or paid service is proposed.

These hosted settings were NOT verified: the Mac's Supabase dashboard opened at its login form, and connected tools do not expose auth-config reads. Local `supabase/config.toml` is not evidence of hosted configuration. No settings were changed and no recovery email/token generated.

## Approval and user handoff

Draft only. Branch-specific `git.deploymentEnabled` prevents automatic Vercel deployment of `codex/password-recovery`; existing branch rules and main deployment behavior remain unchanged. Do not merge or deploy without approval.

Approve this PR's exact final HEAD for merge and its automatic Vercel production deployment after CI/review. This release contains no SQL/migration/grant changes. Independently approve only an exact missing callback allowlist entry if required. Invoice PR65 remains separate and held; it is not a prerequisite for password recovery.

After deployment, verify the deployed HEAD and visible request/update routes, confirm settings above, then send one official reset email to the exact test account. Hans opens it privately and enters/confirms/submits his own new password. Never put the password or bearer URL in chat, logs, PRs or screenshots. Only after success resume owner QA and invalidate/replace any outdated saved password through the user's normal password manager.

Rollback the app commit to remove the new UI; no destructive database rollback or password reversal is proposed. Any successfully changed user password remains changed.
