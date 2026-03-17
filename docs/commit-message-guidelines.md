# Commit Message Guidelines

This file documents the allowed commit `type`s from `commitlint.config.js` and shows when and how to use each one. Follow the Conventional Commits format:

```
<type>(optional-scope): short subject

optional body

optional footer(s)
```

Rules enforced in this repo:
- Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`, `ci`, `revert`.
- Subject max length: 100 characters.

Examples and guidance

- **feat**: A new feature for the user.
  - When: adding new functionality or endpoints.
  - Example: `feat(auth): add refresh token rotation`

- **fix**: A bug fix.
  - When: correcting incorrect behavior, edge-case fixes.
  - Example: `fix(student): prevent race condition in admission`

- **chore**: Changes to the build process or auxiliary tools; non-production code changes.
  - When: dependency upgrades, scripts, build tooling, housekeeping.
  - Example: `chore(deps): upgrade prisma to 4.14.0`

- **docs**: Documentation only changes.
  - When: README, swagger docs, comments that do not change code behavior.
  - Example: `docs: update README setup for Postgres`

- **style**: Code style changes that do not affect meaning (white-space, formatting, missing semi-colons).
  - When: formatting, re-running prettier, minor style fixes.
  - Example: `style: fix linting issues in student.service.ts`

- **refactor**: Code change that neither fixes a bug nor adds a feature.
  - When: renaming functions, moving files, splitting modules, performance-neutral restructuring.
  - Example: `refactor(auth): extract token helpers into utils/token.ts`

- **test**: Adding or updating tests.
  - When: adding unit/integration tests, adjusting test fixtures.
  - Example: `test(student): add unit tests for capacity check`

- **perf**: A code change that improves performance.
  - When: optimization, caching, algorithm improvements.
  - Example: `perf(fees): cache fee-structure lookup to reduce DB calls`

- **ci**: Changes to CI configuration and scripts.
  - When: GitHub Actions, workflow adjustments, CI config files.
  - Example: `ci: add commitlint check to PR workflow`

- **revert**: Revert a previous commit.
  - When: undoing a previous change — should reference the reverted commit hash in the body/footer.
  - Example: `revert: feat(student): add auto-enroll` (see footer for details)

Commit message body and footers
- Body: describe motivation and contrast with previous behavior when needed.
- Footer: reference issues or breaking changes.
  - Breaking change example:

```
feat(api): change student id format

Change student id from integer to cuid() to avoid collisions.

BREAKING CHANGE: database migration required; run prisma migrate deploy
Refs: #123
```

Tips
- Use scopes for the subsystem affected (e.g., `auth`, `student`, `fees`, `docs`).
- Keep the subject short and imperative: "add", "fix", "update".
- Use `git commit --amend -m "type(scope): subject"` to fix failing commitlint errors.
- If a hook blocks you and you understand the risk, bypass with `--no-verify` (not recommended).

Enforcement in this repo
- Husky runs local Git hooks stored in `.husky/`.
  - `.husky/pre-commit` runs `lint-staged` to format and lint staged files before creating a commit.
  - `.husky/commit-msg` runs `commitlint` to validate the commit message against `commitlint.config.js`.

Other references
- Commitlint config: `commitlint.config.js`
- Husky hooks: `.husky/pre-commit`, `.husky/commit-msg`

Saved for quick reference.
