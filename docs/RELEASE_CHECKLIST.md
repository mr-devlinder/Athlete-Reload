# Stable Release Checklist

## Automated checks

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] Lint completes with zero warnings.
- [ ] Unit tests pass.
- [ ] The production build succeeds.
- [ ] The production dependency audit has no high or critical findings.

## Supabase

- [ ] Apply every migration in `supabase/migrations` to production in filename order.
- [ ] Deploy `generate-recommendation` and `clear-health-history` with JWT verification enabled.
- [ ] Confirm `OPENROUTER_API_KEY` is set as a Supabase Edge Function secret.
- [ ] Confirm Auth leaked-password protection is enabled in the Supabase dashboard.
- [ ] Run Supabase security and performance advisors after the final migration.
- [ ] Verify RLS remains enabled for all athlete-owned tables.
- [ ] Complete an authenticated smoke test for recommendation generation and health-data clearing.

## Privacy and account lifecycle

- [ ] Sign in, create health data, sign out, and confirm no account health data remains in browser local storage.
- [ ] Sign into a second account in the same browser and confirm no first-account state appears.
- [ ] Verify account deletion, complete health-data clearing, export, and MFA flows.
- [ ] Verify legal-consent rows record the current policy versions and server timestamp.

## Product smoke tests

- [ ] Complete onboarding on desktop and mobile widths.
- [ ] Create and edit an event and a tournament with multiple games.
- [ ] Complete pre-event check-in and post-event checkout flows, including pain reporting.
- [ ] Record and transcribe voice input in current Chrome, Safari, Firefox, and Edge.
- [ ] Generate readiness and recovery guidance and verify a safe fallback appears when AI is unavailable.
- [ ] Log nutrition and hydration, then export account data.

