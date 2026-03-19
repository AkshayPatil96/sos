# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Production-grade Node.js backend for a Student Onboarding & Management System. Handles admissions, fee ledger, documents, and academic records.

**Stack:** Express.js 5 + TypeScript (strict) + Prisma ORM + PostgreSQL + JWT auth + Zod validation.

**User roles:** SUPER_ADMIN, ADMIN, STAFF, STUDENT.

## Development Commands

```bash
pnpm dev              # Start dev server with hot-reload (tsx --watch)
pnpm dev:debug        # Dev server with Node inspector on port 9229
pnpm build            # Compile TypeScript to dist/
pnpm start            # Start compiled production server
pnpm type-check       # TypeScript type-check (no emit)
pnpm lint             # ESLint (zero warnings threshold)
pnpm lint:fix         # ESLint with auto-fix
pnpm format           # Prettier format all source files

# Prisma
pnpm prisma:generate  # Regenerate Prisma client
pnpm prisma:migrate   # Create and apply a migration
pnpm prisma:studio    # Open Prisma Studio
pnpm prisma:seed      # Run database seed
pnpm db:reset         # Reset DB and re-seed (dev only)

# Docker
docker-compose up -d         # Start all services
docker-compose exec api pnpm prisma:migrate  # Run migration inside container
docker-compose exec api pnpm prisma:seed      # Seed inside container
```

## Architecture

### Module Structure (SOLID)

Every module follows this exact pattern:

```
src/modules/<name>/
├── <name>.controller.ts   # HTTP only: parse req, call service, send response
├── <name>.service.ts      # Business logic only: no HTTP, no Prisma
├── <name>.repository.ts   # ALL Prisma queries: no business logic
├── <name>.routes.ts       # Express router: routing + middleware only
├── <name>.validator.ts    # Zod schemas for all inputs
├── <name>.mapper.ts       # DB → DTO (convert Date/Decimal to strings)
└── <name>.types.ts        # Interfaces, DTOs, Input types
```

Controller → Service → Repository. Never call Prisma from a controller or service.

### Layer Responsibilities

- **Controller:** HTTP in/out only. Calls mapper before `sendSuccess()`.
- **Service:** Pure business logic. Receives plain typed objects, not `req`.
- **Repository:** Prisma queries only. Returns raw types to the mapper.
- **Mapper:** Converts Prisma types to safe DTOs. Always converts `Date → .toISOString()` and `Decimal → .toFixed(2)`.

### Global Patterns

**Response utility:** Use `sendSuccess()`, `sendCreated()`, `sendPaginated()`, `sendNoContent()` from `@/shared/utils/response`. Never call `res.json()` directly.

**Async errors:** Wrap all route handlers with `asyncHandler()` from `@/shared/utils/asyncHandler`.

**AppError:** Use `AppError` or `Errors.*` from `@/shared/utils/AppError` — never `throw new Error()`.

**Cache:** Access via `cache` from `@/lib/cache` using the `ICache` interface. Never import a concrete implementation inside a module. Current implementation is `InMemoryCache` (process-scoped). Redis can be swapped in by creating `lib/cache/redis.cache.ts` implementing `ICache`.

**Prisma singleton:** Import `prisma` from `@/lib/prisma`. Global singleton handles hot-reload safety in dev.

**Config:** All env vars validated at startup via Zod in `@/shared/config`. Invalid config = hard crash.

## Database Conventions

- IDs: `cuid()` — never auto-increment integers
- Soft delete: `deletedAt DateTime?` — never hard delete records
- Money: `Decimal @db.Decimal(10, 2)` — never `Float`
- All status/type fields: Prisma enums — never plain strings
- Multi-table writes: `prisma.$transaction()` — required for ACID
- Raw queries: `$queryRaw` with `Prisma.sql` tagged template only — never `$queryRawUnsafe`
- Indexes: `@@index` on every FK, filtered field, and sorted field

## Auth Flow

- Access token: 15 min, `JWT_ACCESS_SECRET`
- Refresh token: 7 days, httpOnly cookie, stored as bcrypt hash in DB, JTI tracked
- Payload: `{ sub: userId, role: UserRole, jti: uuid, iat, exp }`
- Role checked via `requireRole([...])` middleware on every route
- Login rate limited: 5 attempts/15 min per IP
- Account lockout: 10 consecutive failures → `SUPER_ADMIN` unlocks

## Key Files

| File | Purpose |
|---|---|
| `src/server.ts` | Entry point: connects DB, listens on PORT, handles graceful shutdown |
| `src/app.ts` | Express app: middleware chain, route mounting, swagger setup |
| `src/lib/prisma.ts` | Prisma singleton with slow-query monitoring → Prometheus |
| `src/lib/cache.ts` | `ICache` interface + `InMemoryCache` (Redis-ready) |
| `src/shared/config/index.ts` | Zod-validated environment variables |
| `src/shared/utils/response.ts` | `sendSuccess`, `sendCreated`, `sendPaginated` |
| `src/shared/utils/auditLog.ts` | Append-only audit log for admin actions |
| `src/shared/middlewares/auth.middleware.ts` | JWT verification + `req.user` injection |
| `src/shared/middlewares/requireRole.middleware.ts` | Role-based access control |
| `src/routes/index.ts` | Root router — mounts all module routers |
| `prisma/schema.prisma` | Full database schema with all models and enums |

## API Routes

All routes mounted under `/api/v1`:
- `/auth/*` — login, logout, refresh, password reset
- `/admin/*` — user management, audit logs

## Swagger

- UI: `http://localhost:3000/api/docs`
- JSON: `http://localhost:3000/api/docs.json`

## Git Workflow

### Branch Strategy

```
develop  ←  feature/xxx  ←  PR merge  ←  feature work
   ↓ push
Staging auto-deploys
   ↓ QA approves
main  ←  PR merge from develop
   ↓ push
Production auto-deploys
```

**Branch types:**
| Branch | Purpose | Lifetime |
|---|---|---|
| `develop` | Staging environment | Persistent |
| `main` | Production environment | Persistent |
| `feature/<name>` | New feature work | Short-lived |
| `fix/<name>` | Bug fixes | Short-lived |
| `chore/<name>` | Tooling, deps, refactors | Short-lived |

**Short-lived branches** (`feature/`, `fix/`, `chore/`) are merged and deleted.

### Branch and Commit Rules for Claude Code Sessions

Before starting any task:
1. Check the current branch name
2. Ask if it matches the task being worked on
3. If not, ask whether to create a new branch. If yes, create it and switch before working
4. If no, continue work on the current branch

After completing any meaningful chunk of work:
- Always commit the changes (even if not pushing)
- Write a clear, concise commit message following the format below
- Do not wait for the user to ask — commit when the work is done

### Commit Messages

One line, present tense, no trailing period. If explanation is needed, add up to 3 bullet points below the subject. No Co-Authored-By footer.

```
feat(auth): add refresh token rotation

- Rotate refresh token on every use
- Blacklist old access token JTI on logout
```

```
fix(fees): correct Decimal precision in ledger
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `perf`, `chore`, `ci`, `revert`

### Daily Workflow

```bash
# Start a new feature
git checkout develop && git pull
git checkout -b feature/add-profile-api
# work... commit... push...

# Open PR against develop → CI runs → auto-deploys to staging
# QA approves → merge PR

# Promote to production
git checkout develop && git pull
git checkout main && git pull
git merge develop && git push origin main
# → Production auto-deploys
```

### Hooks

- **pre-commit:** lint-staged runs ESLint + Prettier on staged `.ts` files
- **commit-msg:** commitlint enforces Conventional Commits format

### Deploy Environments

| Branch | Workflow | Environment |
|---|---|---|
| `develop` | `deploy-staging.yml` (auto) | Staging |
| `main` | `deploy-production.yml` (auto) | Production |
| Any branch | `workflow_dispatch` | Manual trigger available |
