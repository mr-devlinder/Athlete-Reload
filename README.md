# Athlete Reload

Athlete Reload is a readiness, training, and recovery journal for athletes. It connects scheduled events with pre-event check-ins, post-event checkouts, pain reporting, and recovery routines so the athlete gets a practical plan for the session in front of them.

It is designed to support better conversations with coaches, parents, athletic trainers, and healthcare professionals. It does not diagnose injuries or provide medical clearance.

## What It Does

- Event-based check-ins and checkouts
- Month, week, and list schedule views with recurring events and calendar export
- Tournament builder with individual games, turnaround visibility, and accumulated workload
- AI-assisted preparation and recovery guidance based on the athlete's event, history, sport, and reported symptoms
- Body pain map with per-area reporting and a pain-issue tracker
- Daily hydration and nutrition context
- Recovery routines with timers, reps, pain-aware substitutions, completion feedback, saved favorites, and replay
- History, weekly reports, pattern detection, baseline context, and workload trends
- Print-ready pain summaries with an explicit confirmation and sharing audit trail
- Optional browser reminders for event check-ins, checkouts, and unsaved recovery plans while the app is open
- Account-owned Supabase data with row-level security

## Local Development

Requirements: Node.js 20+ and an npm-compatible shell.

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run lint
npm run build
npm run preview
```

## Environment

Create `.env.local` with the public Supabase configuration:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never put a Supabase service-role key, Gemini key, or any other server secret in this frontend project. AI requests are handled by the Supabase Edge Function at `supabase/functions/generate-recommendation`.

## Supabase

Database migrations live in `supabase/migrations`. The app stores user-owned data for events, check-ins, checkouts, pain reports and issues, daily wellness, saved routines, routine completions, sharing records, associations, profiles, privacy preferences, and tournaments.

Every user-owned table has row-level security. Policies are based on the stored row owner matching `auth.uid()`; being signed in alone is not enough to access another athlete's data.

When adding schema changes:

1. Add a SQL migration in `supabase/migrations`.
2. Apply it to the connected project.
3. Run Supabase security and performance advisors.
4. Verify the new table or column through the app and with a signed-in account.

## Deployment

GitHub Pages is deployed with `gh-pages`:

```bash
git add .
git commit -m "Describe the change"
git push
npm.cmd run deploy
```

`predeploy` runs the production build before publishing `dist`.

## Health and Safety

Athlete Reload is an educational planning tool. It is not medical advice, diagnosis, treatment, or return-to-play clearance. Severe, worsening, unstable, numb, neurological, concussion-related, breathing, chest-pain, or other concerning symptoms should be reported to an appropriate adult, coach, athletic trainer, or qualified healthcare professional promptly.
