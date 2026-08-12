# Release Checklist

## Required quality gates

- [ ] `npm ci`
- [ ] `npm run lint -- --deny-warnings`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run check:bundle`
- [ ] `npm run check:release`
- [ ] `npm run test:e2e`

## Safety and product checks

- [ ] Pain never increases readiness in unit tests.
- [ ] Red-flag decisions remain deterministic when AI is unavailable or contradictory.
- [ ] Check-in and checkout can save before optional AI enrichment.
- [ ] Missing nutrition/hydration logs render as unknown, not zero intake.
- [ ] Ages 16–17 receive no automatic calorie deficit.
- [ ] New accounts and profile updates enforce 16+; existing restricted records follow remediation.
- [ ] No diagnosis, injury probability or medical-clearance language appears.

## Database checks

- [ ] Review the under-16 count emitted by migration `20260812010000` before validating its age constraint.
- [ ] `npx supabase db reset`
- [ ] `npx supabase db lint`
- [ ] Two-user RLS isolation tests pass for all user/athlete-owned tables.
- [ ] Transactional mutation RPC cross-user tests pass.
- [ ] Legal consent remains append-only.

## Browser checks

- [ ] Landing/auth and onboarding.
- [ ] Home, Schedule, Check-in, recommendation, Checkout, Recovery, Fuel/Nutrition, History and settings/privacy.
- [ ] 320x568, 375x812, 390x844, 393x852, 430x932, 768x1024, 1280x800 and 1440x900.
- [ ] No horizontal overflow, clipped CTA or viewport-breaking modal.
- [ ] Keyboard-only navigation, focus trap/restoration and Escape behavior.
- [ ] Charts have a readable text summary.
- [ ] Automated accessibility scan reviewed; manual checks still completed.

## Performance and operations

- [ ] Major feature chunks remain lazy-loaded.
- [ ] Suspense shows a lightweight non-blank fallback.
- [ ] Bundle budgets pass and changes are reviewed.
- [ ] No secrets are present in frontend source, CI or build output.
- [ ] Dependency advisories are reviewed and dispositioned.
