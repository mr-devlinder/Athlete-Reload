# Stable Release Acceptance Matrix

Each row must pass in desktop Chrome, Firefox, and Edge. Responsive/PWA checks must also pass before release.

| Area | Required acceptance |
| --- | --- |
| Onboarding and profile | New athlete completes age/legal consent, sport profile, goals, units, and can edit them later. |
| Authentication | Password and connected-provider sign-in, sign-out, reset, verification, session expiry, and MFA complete without account crossover. |
| Schedule | Create, edit, and delete events and tournaments; international locations and event context persist correctly. |
| Check-in | Progressive questions preserve zero versus missing values; readiness targets, timeline, current-pain relevance, fallback, and regeneration work. |
| Checkout | Planned-versus-actual context, participation, load, pain changes, immediate actions, fallback, and persistence work. |
| Recovery | Latest-checkout and standalone modes produce appropriate routines, timing, equipment, pain safeguards, completion, replay, and save behavior. |
| Nutrition | Verified/USDA/OFF ranking, barcode, manual entry, saved foods, servings, meal edits, hydration, voice entry, curator promotion, and usage tracking work. |
| Pain | Current pain influences relevant guidance; resolved history does not restrict unrelated activity; sharing/audit records remain owned. |
| Privacy and account | Preferences visibly operate; export, health clearing, MFA, connected identities, legal information, and deletion match their confirmation copy. |
| Accessibility | Keyboard order, focus containment/return, Escape, labels, status announcements, contrast, zoom, and reduced motion pass. |
| Failure states | Offline, denied permissions, expired session, AI/provider failure, missing deployment objects, and duplicate submissions show calm nontechnical messages. |
| Release | Clean install, lint, tests, audit, build, bundle budget, migration list, advisors, and authenticated staging smoke test pass. |
