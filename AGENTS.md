# AGENTS.md

Conventions for **ShiftWindow**, a small Vite + React + TypeScript + Tailwind web app. Distilled from `agent-harness-from-scratch` and `agent-workflows`.

## Commands

- Dev server: `npm run dev`
- Unit tests: `npm test` (Vitest, fast and offline)
- Typecheck & build: `npm run build` (`tsc -b && vite build`)

## Workflow (Plan -> Build -> Check -> Review)

1. **Plan first.** Break work into small, ordered stories with checkable acceptance criteria before writing app code. Keep scope strictly to the criteria; log extra ideas as follow-ups rather than widening the spec.
2. **Test-first for logic.** For calculation and domain logic, write unit tests covering each acceptance criterion and edge case first, verify they fail, then write the smallest implementation that makes them pass.
3. **Check.** Run `npm test` and `npm run build` until both exit 0. Trust command output, never assumptions.
4. **Single review pass before finishing:** Verify every acceptance criterion and edge case (e.g., negative prices, boundary hours, zero-cost / division-by-zero in percentage savings), and cut unused code, single-use abstractions, or anything no criterion asked for. Re-run `npm test` and `npm run build` after review fixes.

## Code Style

- Pick plain, obvious code over clever code. Every file should be readable in one sitting.
- Keep dependencies minimal: prefer plain TypeScript, React, Tailwind, and lightweight SVG over heavy libraries.
- Comments: short and simple. One plain sentence explaining *why*, never *what*. No buzzwords or decorative banners.
- Keep domain logic (price curves, optimal window calculation, formatting) in pure TypeScript modules separated from React UI components so tests stay fast and offline.

## Git Workflow

- Work goes straight to `main`, one commit per logical step.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Imperative mood ("add", not "added"), one line under 72 characters, no body, no `Co-Authored-By`.
- Never commit without showing the changed files and proposed message and getting the user's OK first. Leave global git config untouched.
