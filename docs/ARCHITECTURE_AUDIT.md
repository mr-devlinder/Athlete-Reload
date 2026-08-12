# Athlete Reload Architecture Audit

Audit date: 2026-08-11  
Baseline commit: `97db015` (`Athlete Reload 8.7.beta.1`)

## Baseline

- `git status --short`: clean.
- `git log -5 --oneline`: `97db015`, `e23db6f`, `2bbe388`, `c4454e3`, `4720561`.
- Node: `v24.16.0`.
- npm: `11.13.0` via `npm.cmd`. PowerShell execution policy blocks `npm.ps1`; this is an environment/configuration issue.
- `npm ci`: passed after allowing access to the configured user npm cache. npm reported 3 high and 1 critical dependency advisories; remediation requires dependency-tree review and is not silently applied.
- `npm run lint -- --deny-warnings`: passed.
- `npm test`: passed, 27 files / 88 tests.
- `npm run build`: passed. Largest emitted JS chunks: app 598 kB, vendor 478 kB, Recharts 276 kB (uncompressed).
- `npm run check:bundle`: passed.
- `npm run check:release`: passed.

All baseline command failures above are environment/configuration issues. No project test, lint, build, bundle, or release failure was reproduced.

## Current feature map

- Public/auth: landing, authentication, 16+ acknowledgement, onboarding.
- Home: daily status, scheduled work, current recommendation, pain/recovery signals, charts and recent patterns.
- Schedule: month/week/list views, event create/edit/delete, recurring events, associations, tournaments and calendar export.
- Check-in: event selection, subjective wellness, sleep, illness, hydration/fuel context and body pain reporting.
- Checkout: participation, duration, session effort, workload, fatigue/soreness/performance, symptoms and pain changes.
- Recovery: generated and fallback plans, saved plans, replay, completion and response logging.
- Nutrition: daily logs, food search/barcode/manual entry, macro targets and hydration guidance.
- History: timeline, trends, weekly summaries, detailed check-in/checkout/recovery/pain dialogs.
- Settings/privacy: profile, display and privacy preferences, auth methods, exports, sharing records, health-history and account deletion.

Home, Schedule and History are primary lazy-loaded destinations and must remain so.

## State and data ownership

`src/App.jsx` is the main client owner of authentication state, current athlete snapshot, navigation, dialogs, schedule, check-ins, checkouts, wellness, pain, recovery, recommendations and optimistic mutation state. `src/features/app/useAthleteSnapshotController.js` and `loadAthleteSnapshot.js` have begun extraction, while most writes still route from `App.jsx` into `src/lib/athleteData.js`. `src/repositories/athleteRepository.js` and `src/repositories/core.js` provide limited repository groundwork but are not yet the sole persistence boundary.

Local guest state is owned by `src/utils/storage.js`. Authenticated records are user-owned in Supabase. New athlete-context tables introduce `athlete_id` plus membership-based access while legacy tables still retain `user_id`; migrations use an additive/dual-ownership approach.

## Async mutation flows

- Check-in: client saves/updates a check-in, deletes prior pain reports, then writes replacement pain reports. Compensating deletes exist for some failure paths, but the operation is not atomic.
- Checkout: client saves/updates a checkout, deletes prior pain reports, then writes replacements. Compensating cleanup exists but the operation is not atomic.
- Schedule deletion: check-ins, checkouts, then schedule event are deleted in separate calls. A partial failure can leave an incomplete graph.
- History deletion: checkout/check-in and pain records are deleted separately.
- Recurring event creation: expanded in the client and persisted as separate records; it is not transactional.
- Tournament create/delete uses transactional RPCs and is the current reference pattern.
- Several UI handlers optimistically update local state. Some restore/refetch on failure; the paths above require systematic conversion to authoritative RPC results or explicit rollback.
- Snapshot reads support abort signals in the extracted loader. Remaining async effects and account/session transitions require runtime race verification.

## Recommendation path

The frontend builds deterministic context in `src/lib/recommendationContext.js`, readiness output in `src/utils/readiness.js`, and calls optional AI through `src/lib/aiRecommendations.js`. `src/domain/contracts.js` supplies a version-2 structured wrapper and prevents AI merging from overriding status/score/actions/warnings. The Edge Function performs authentication, rate limiting, request routing, prompting, provider calls, normalization and logging in one oversized file.

Gaps: the requested schema-v3 contract is not present; status uses `stop_and_check` instead of `stop_and_seek_help`; validation is structural construction rather than explicit rejection of arbitrary model JSON; provider/request responsibilities remain coupled in the Edge Function; persistence metadata is incomplete.

## Safety path

`src/domain/safety.js` is deterministic and identifies severe pain, selected neurological/concerning symptoms, pain with breathing, significant illness and functional change. `src/utils/readiness.js` applies it before status selection. AI cannot override several deterministic fields during `mergeAiExplanation`, which is a useful foundation.

Reproduced static defect: `getRecommendation` computes a low raw score and then applies `Math.max(rawScore, 64)` for pain 1-2 or `Math.max(rawScore, 56)` for pain 3-4. Adding pain to an otherwise poor state can therefore increase its displayed readiness. Current score/label language also overemphasizes a composite 0-100 number and includes `coachMessage` wording that can resemble clearance.

## Database ownership and RLS

Legacy user-owned tables include `schedule_events`, `check_ins`, `training_checkouts`, `pain_reports`, `athlete_associations`, `privacy_preferences`, `athlete_profiles`, `daily_wellness`, `pain_issues`, saved recovery routines/completions, tournaments, sharing logs, templates, voice logs and saved foods. Policies generally compare stored `user_id` with `auth.uid()`.

The 2026-08-11 athlete-context migrations add `athletes`, `athlete_memberships`, `athlete_physiology_profiles`, `athlete_activities`, `recommendations`, `athlete_baselines`, `athlete_insights`, recommendation feedback and recovery responses. RLS is enabled and access is mediated through private membership/ownership helpers. Legal consents are append-only through an RPC and mutation-prevention trigger.

Static risk: the current `athlete_profiles.age_years` constraint permits values below 16 (the latest context migration permits 0-120). A safe migration must first inventory under-16 rows, restrict/remediate without deleting or changing ages, then enforce the product boundary only when no incompatible rows remain. Database state and actual row counts require runtime verification.

Local two-user RLS isolation has not been verified in this environment yet. Docker/Supabase CLI availability is unspecified pending validation.

## Oversized files

- `src/App.css`: ~186 kB.
- `src/App.jsx`: ~139 kB.
- `supabase/functions/generate-recommendation/index.ts`: ~76 kB.
- `src/components/ScheduleView.jsx`: ~54 kB.
- `src/components/HomeView.jsx`: ~45 kB.
- `src/components/NutritionView.jsx`: ~43 kB.
- `src/components/HistoryView.jsx`: ~42 kB.
- `src/components/RecoveryView.jsx`: ~42 kB.
- `src/lib/athleteData.js`: ~40 kB.

These files mix orchestration, calculation, presentation and persistence concerns.

## Duplicate logic and unused-code candidates

- Hydration target/guidance lives in `src/lib/nutrition.js`, event hydration context in `src/utils/eventFuelContext.js`, and status in `App.jsx` uses a separate hardcoded 3,000 mL denominator.
- Readiness/safety concepts are split across `src/utils/readiness.js`, `src/domain/safety.js`, `src/domain/contracts.js`, `src/lib/recommendationContext.js` and the Edge Function.
- Activity demand data exists in both `src/data/sportProfiles.js` and numeric `src/domain/activityDemands.js`.
- Recovery normalization exists in `src/domain/recovery.js`, while fallback routine construction and constraint logic remain in `RecoveryView.jsx`.
- Multiple components still create portals and implement modal framing independently despite `DialogShell`.
- Functions prefixed `_get...` in `HomeView.jsx` are unused-code candidates; import and behavioral verification is required before removal.
- Legacy `preparation`/`during`/`recovery` recommendation arrays, `_source` provider coupling and `heatSymptoms` compatibility paths require dual-read migration before removal.

## CSS duplication candidates

`App.css`, `ui-production.css` and feature rework styles overlap. `ui-system.css` remains imported despite being labelled retired. A global selector around `.eyebrow` exists in `App.css` and requires inspection/removal if it hides meaningful context. Static selector tooling is absent. No CSS is safe to delete solely from naming because several class names are dynamic.

## Accessibility findings

- `DialogShell` provides modal semantics, labelled headings, escape handling, focus trapping/restoration and body scroll locking.
- `useModalAccessibility` falls back to searching all dialogs globally, mutates discovered DOM classes/labels and can affect an unrelated modal. It should operate only on its returned explicit ref.
- `ScheduleView`, `CheckoutModal`, `AthleteProfileModal`, `NutritionView` and `RecoveryView` still contain custom portals/modal patterns.
- History partly uses `DialogShell` but still imports `createPortal`, indicating incomplete consolidation.
- Chart semantics and readable text alternatives require runtime/manual verification; no claim of accessibility completeness is made.

## Nutrition and hydration findings

`src/lib/nutrition.js` uses `biologicalSex` rather than `genderIdentity`, so identity is not currently read directly by the equation. The physiological input is not named consistently with the requested optional `physiologySex` contract. The function applies goal-based calorie adjustments including a -250 kcal weight-loss adjustment at every age and uses a universal 1,400 kcal floor. This is not acceptable for ages 16-17 and creates false precision.

Missing nutrition entries are distinguishable from zero totals at some recommendation call sites. Hydration state is not: wellness defaults and database columns commonly use zero, while zero can mean either no log or zero intake. A centralized result needs an explicit logging-presence signal.

## Runtime issues actually reproduced

- `npm.ps1` cannot execute under the host PowerShell policy; `npm.cmd` works.
- Sandbox access to the user npm cache initially caused `EPERM`; approved cache access resolved it.
- No application runtime defect has yet been claimed. Browser validation is still required.

## Migration risks

- Enforcing 16+ can reject a migration when under-16 records exist. Those rows must be counted and restricted for remediation without deletion or falsification.
- Replacing multi-write UI actions with RPCs requires preserving legacy columns and return shapes during rollout.
- Converting `heatSymptoms` to `concerningSymptoms`, pain lifecycle fields and physiology naming requires add/backfill/dual-read/validate/switch sequencing.
- New membership-based athlete ownership must not weaken current own-user RLS or allow linked records to reference another athlete.
- Recommendation schema changes require versioned reads for existing JSON.

## Initial dependency and implementation sequence

1. Fix deterministic readiness monotonicity and establish safety tests.
2. Introduce centralized nutrition/hydration domains and youth rules, then adapt existing callers.
3. Add non-destructive 16+ and transactional mutation migrations with owner validation.
4. Add repository functions and convert critical client flows to RPCs with failure rollback.
5. Establish schema-v3 recommendation/decision packet and optional validated AI enrichment.
6. Decompose app, Edge Function, features, dialogs and CSS incrementally while keeping release gates green.
7. Add component/E2E/RLS coverage and perform browser/keyboard/accessibility validation.

Anything depending on a live Supabase project, real account data, browser-authenticated routes or production migration state is **requires runtime verification**. Anything not represented in the repository or supplied environment is **unspecified**.

## Implementation delta in this worktree

The findings above describe the audited baseline. This refactor subsequently:

- removed readiness pain floors and added the versioned readiness/safety/decision modules;
- moved the active recommendation contract to schema version 3 and `stop_and_seek_help`;
- introduced youth-safe daily energy, performance fueling and centralized hydration domains;
- renamed the frontend calculation input to `physiologySex` while retaining database compatibility;
- added non-destructive 16+ restriction/remediation plus atomic check-in, checkout, schedule-delete and history-delete RPCs;
- added optimistic deletion rollback, removed `ui-system.css`, restored `.eyebrow`, simplified modal focus ownership, added a non-blank Suspense fallback, CSS reporting and CI;
- reproduced and fixed a null-profile hydration runtime error during browser validation.

Large-scale App/feature/Edge Function decomposition, authenticated E2E flows and two-user local RLS proof remain open and are not represented as complete. Check-in and checkout now save deterministic records transactionally before optional AI enrichment; the enriched result is a later update of the same owned record.
