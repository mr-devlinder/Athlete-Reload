# Athlete Reload

Athlete Reload is a training readiness planner for athletes. It combines a daily check-in, a schedule calendar, and saved history to recommend how training should be adjusted for the day instead of defaulting to a simple rest/no-rest answer.

## Features

- Email/password authentication with Supabase
- Device session persistence for familiar-device sign-in
- Daily readiness check-in
- Schedule-aware recommendations
- Injury and pain-aware training guidance
- Editable monthly calendar
- Saved check-in history
- History detail modal
- Mobile-friendly layout
- Liquid glass navigation effect with `react-glassy`

## Stack

- React
- Vite
- Supabase
- date-fns
- react-glassy
- Oxlint
- GitHub Pages

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run lint:

```bash
npm run lint
```

Preview a production build locally:

```bash
npm run preview
```

## Environment Variables

Create a `.env.local` file from `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use the Supabase project URL and publishable key. Do not put a service role key in the frontend.

## Supabase

The app uses Supabase for authentication and account-owned data.

The schema is tracked in:

```bash
supabase/migrations/20260727210000_create_athlete_reload_user_data.sql
```

Tables:

- `schedule_events`
- `check_ins`

Both tables use row level security so each authenticated user can only access their own schedule and check-in records.

## Deployment

This repo is set up for GitHub Pages using `gh-pages`.

Typical deploy flow:

```bash
git add .
git commit -m "message"
git push
npm.cmd run deploy
```

The Vite base path is configured for GitHub Pages in `vite.config.js`.

## Notes

Athlete Reload is a planning tool, not a medical diagnosis tool. High-risk symptoms should still be handled by a coach, parent, athletic trainer, or medical professional.
