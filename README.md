# Student Onboarding API

Production-grade Node.js backend for a Student Onboarding & Management System used by a college institution. Handles student admissions, fee ledger management, document storage, and academic records.

## Project Overview

| Aspect | Detail |
|---|---|
| **Users** | Super Admin, Admin, Staff, Student (Parent planned) |
| **Runtime** | Node.js 20 LTS |
| **Framework** | Express.js 5 |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL 16 via Prisma ORM v5 |
| **Auth** | JWT (access 15m + refresh 7d) |
| **Cache** | In-memory (pluggable, Redis-ready) |
| **Storage** | AWS S3 (pre-signed URLs only) |
| **Logging** | Winston (JSON prod, coloured dev) |
| **Validation** | Zod v4 |
| **Docs** | Swagger / OpenAPI 3.0 |

---

## Prerequisites

- **Node.js** 20 LTS
- **pnpm** 9+
- **Docker** + **Docker Compose**

---

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env
# Edit .env — set DB credentials, JWT secrets (min 32 chars)

# 2. Start all services
docker-compose up -d

# 3. Run database migration
docker-compose exec api pnpm prisma:migrate
# When prompted: enter migration name, e.g. "init_baseline_schema"

# 4. Seed initial data (Super Admin)
docker-compose exec api pnpm prisma:seed

# 5. Verify health
curl http://localhost:3000/health
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with hot-reload |
| `pnpm dev:debug` | Start dev server with Node.js inspector on port 9229 |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Start compiled production server |
| `pnpm type-check` | TypeScript type-check (no emit) |
| `pnpm lint` | ESLint with zero warnings threshold |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier format all source files |
| `pnpm format:check` | Prettier check (CI mode) |
| `pnpm prisma:generate` | Regenerate Prisma client |
| `pnpm prisma:migrate` | Create and apply a new migration |
| `pnpm prisma:migrate:deploy` | Apply pending migrations (production) |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm prisma:seed` | Run database seed |
| `pnpm db:reset` | Reset DB and re-seed (dev only) |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment: `development`, `staging`, `production` |
| `PORT` | `3000` | HTTP server port |
| `APP_NAME` | — | Application name used in logs |
| `API_VERSION` | `v1` | API version prefix |
| `FRONTEND_URL` | — | Allowed CORS origin (production) |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DB_POOL_MIN` | `2` | Prisma connection pool minimum |
| `DB_POOL_MAX` | `10` | Prisma connection pool maximum |
| `JWT_ACCESS_SECRET` | — | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | — | JWT refresh token secret (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |
| `AWS_REGION` | `ap-south-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | — | AWS access key (optional in dev) |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key (optional in dev) |
| `AWS_S3_BUCKET` | — | S3 bucket name (optional in dev) |
| `AWS_S3_PRESIGNED_URL_EXPIRY` | `900` | Pre-signed URL expiry in seconds |
| `LOG_LEVEL` | `info` | Winston log level |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

---

## Project Structure

```
src/
├── modules/             # Feature modules (auth, student, fees, docs, academics, admin)
├── shared/
│   ├── config/          # Zod-validated environment config
│   ├── middlewares/     # Global Express middlewares
│   ├── types/           # TypeScript augmentations (Express Request)
│   └── utils/           # Logger, AppError, response helpers, pagination
├── lib/
│   ├── prisma.ts         # Prisma singleton (dev hot-reload safe)
│   └── cache.ts          # ICache interface + InMemoryCache (Redis-ready)
├── routes/              # Root router — mounts all module routes
├── docs/                # Swagger/OpenAPI setup
├── app.ts               # Express app configuration (no listen)
└── server.ts            # Entry point — connects DB then calls listen
```

**Each module follows the exact structure:**
```
modules/student/
├── student.controller.ts  # HTTP layer only
├── student.service.ts     # Business logic
├── student.repository.ts  # Prisma queries only
├── student.routes.ts      # Route definitions
├── student.validator.ts   # Zod schemas
├── student.mapper.ts      # DB → DTO conversion
└── student.types.ts       # Interfaces and DTOs
```

---

## API Documentation

Once the server is running:
- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs.json

---

## Docker Commands

| Make Target | Description |
|---|---|
| `make up` | Start all services in background |
| `make down` | Stop all services |
| `make logs` | Tail API service logs |
| `make shell` | Open shell in API container |
| `make migrate` | Run Prisma migration (dev) |
| `make migrate-deploy` | Apply migrations (production) |
| `make seed` | Run database seed |
| `make reset` | Reset DB and re-seed |
| `make rebuild` | Rebuild and restart API container |
| `make type-check` | Run type-check inside container |

---

## Architecture Decisions

### Modular Structure
Feature-based modules keep domain logic self-contained. `src/modules/*/` contains everything for a domain: routes, controller, service, repository, validator, mapper, and types.

### SOLID Principles
- **Controller** → HTTP only (parse req, call service, send res)
- **Service** → Business logic only (no HTTP, no Prisma)
- **Repository** → Prisma queries only (no business logic)
- **Mapper** → Data transformation only (pure functions)

### Mapper Pattern
Controllers always call the mapper before responding. Raw Prisma objects never reach the API. Sensitive fields (`password`, `deletedAt`, etc.) are excluded by omission.

### ICache Interface
All caching goes through `ICache` from `lib/cache.ts`. The current `InMemoryCache` implementation can be swapped for `RedisCache` by updating the factory export — zero changes required in any module.

### ACID Compliance
Multi-table writes use `prisma.$transaction()`. Balance is calculated at query time, never stored as a column. Money uses Prisma `Decimal` type throughout.
