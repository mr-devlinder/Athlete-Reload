# Athlete Reload — Codex Efficiency Instructions

## Primary Goal

Use the **minimum practical amount of context, reasoning, tool calls, and output** needed to complete the user's request correctly.

This repository is the **Athlete Reload** app. These instructions are intentionally optimized for **maximum Codex usage-limit savings**, especially when using GPT-5.6 Sol at medium reasoning.

## Core Behavior

- Work narrowly on exactly what the user requested.
- Prefer the smallest correct change over broad refactors.
- Do not explore unrelated parts of the repository.
- Do not perform speculative cleanup, modernization, restructuring, or optimization unless explicitly requested.
- Do not add features, abstractions, files, dependencies, tests, comments, or documentation that are not needed for the requested change.
- Preserve existing behavior unless the request requires changing it.
- If the request is clear enough to act on, act on it without asking follow-up questions.

## Context / Token Efficiency

- Start with the files most likely to contain the requested functionality.
- Search for exact component names, route names, UI labels, function names, error text, or relevant keywords before opening broad files.
- Read only the relevant sections of files whenever possible.
- Do not repeatedly reread files unless they changed or the previous context is genuinely insufficient.
- Do not dump large files into context when a targeted search or partial read is enough.
- Do not recursively inspect the repository just to understand its architecture.
- Do not inspect generated files, build output, dependency folders, lockfiles, or assets unless directly relevant.
- Avoid reading documentation that is not needed for the current task.
- Reuse information already learned during the current task instead of searching for it again.

## Editing Strategy

- Make direct, localized edits.
- Batch closely related edits into one pass when practical.
- Match the existing code style and patterns instead of inventing new architecture.
- Reuse existing utilities, components, types, hooks, services, and styling patterns when they are easy to identify.
- Do not create a new helper or abstraction for code used only once unless it materially improves correctness.
- Avoid large rewrites when a small patch solves the issue.
- Do not rename or move files unless necessary.
- Do not change formatting outside the edited area unless required by the formatter.
- Never modify unrelated code merely because it could be improved.

## Repository Exploration

Use this order:

1. Search for the exact feature, text, component, or symbol involved.
2. Open the most likely matching file.
3. Inspect imports/dependencies only as needed.
4. Make the change.
5. Validate the narrowest useful scope.

Only broaden exploration if the initial path fails or the bug clearly spans multiple systems.

Do **not** begin tasks by mapping the whole codebase.

## Debugging

When debugging:

- Trace the shortest plausible path from the reported symptom to its cause.
- Form a likely hypothesis before opening many files.
- Prefer inspecting the directly involved component/state/API flow first.
- Use existing logs, types, errors, and call sites before adding instrumentation.
- Do not investigate unrelated warnings or pre-existing issues.
- Once the requested issue is fixed and validated, stop.

## Testing and Validation

Use the cheapest validation that gives reasonable confidence.

Prefer, in order:

1. Type/lint validation scoped to changed files if available.
2. Existing targeted tests for the affected functionality.
3. A focused build/check only when needed.
4. Full test suites or full builds only when necessary.

- Do not run the same command repeatedly without a reason.
- Do not run expensive full-project checks for a tiny isolated change unless targeted validation is unavailable or the change could affect the whole app.
- Do not fix unrelated test, lint, type, or build failures.
- If validation reveals a pre-existing unrelated failure, mention it briefly and leave it alone.

## Dependencies

- Do not install a package if existing project code or platform APIs can reasonably solve the task.
- Do not update dependencies unless explicitly requested or required for the fix.
- Do not inspect package internals unless necessary.
- Do not regenerate lockfiles unnecessarily.

## Athlete Reload Specific Guidance

Athlete Reload is an existing application. Preserve its established:

- UI and visual language
- component patterns
- data models
- navigation patterns
- mobile behavior
- Supabase integration
- existing product terminology

When modifying a feature, first prefer the implementation pattern already used by nearby Athlete Reload features.

Do not redesign an area simply because another approach might be cleaner.

## Mobile / Responsive Changes

For mobile issues:

- Fix the affected breakpoint/component only.
- Preserve desktop behavior unless the request says otherwise.
- Avoid global CSS changes when a local rule will work.
- Check for existing responsive utilities before adding new ones.

## Supabase / Data Changes

For tasks involving Supabase or persisted user data:

- Inspect the existing query/schema path before changing it.
- Prefer backward-compatible changes.
- Do not alter database schema, RLS policies, auth configuration, or migrations unless the task actually requires it.
- Do not expose secrets, service-role keys, or sensitive user data.
- Avoid unnecessary database queries.

## Safety Against Scope Creep

Unless specifically requested, do **not**:

- refactor neighboring code
- rewrite working components
- add tests for unrelated behavior
- update packages
- reorganize folders
- rename variables solely for style
- add excessive comments
- add fallback systems for unlikely edge cases
- redesign APIs
- change database schemas
- perform accessibility audits
- perform security audits
- perform performance audits
- inspect the entire repository

A task should end when the requested behavior is implemented and reasonably validated.

## Communication

Keep responses concise.

For a normal coding task, the final response should usually contain only:

- what changed
- any important caveat
- what validation was run

Do not provide long explanations of obvious code changes.
Do not narrate every file inspected or command executed.
Do not provide a detailed plan unless the task is genuinely complex or the user asks for one.
Do not repeat the user's request back to them.

## Reasoning Discipline

- Use medium reasoning efficiently rather than treating every task as complex.
- For straightforward UI changes, copy changes, styling fixes, small bugs, and localized logic changes, favor direct execution.
- Reserve deep investigation for problems that genuinely require it.
- Stop researching once there is enough information to make a confident change.
- If two approaches are similarly correct, choose the simpler one that requires less code and less exploration.

## Definition of Done

A task is done when:

1. The requested behavior is implemented.
2. Existing relevant behavior is preserved.
3. The narrowest reasonable validation passes, or any blocking unrelated issue is identified.
4. No unnecessary changes were made.

Then stop.
