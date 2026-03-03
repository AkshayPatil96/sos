# GitHub Copilot Instructions — Student Onboarding Backend

## Project Overview

This is a **production-grade Node.js backend** for a Student Onboarding & Management System
used by a college institution. The system handles student admissions, fee ledger management,
document storage, and academic records.

**Users of this system:**

- Super Admin — full system access
- Admin — manages students, fees, courses, documents
- Staff — admissions and documents only
- Student — read-only access to their own data

**Planned future role (not yet implemented):** Parent — read-only view of their child's
academic records and fee ledger. Architecture must not block this from being added later.

---

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Runtime          | Node.js 20 (LTS)                                   |
| Framework        | Express.js                                         |
| Language         | TypeScript (strict mode)                           |
| Database         | PostgreSQL 16 via Prisma ORM                       |
| Cache / Sessions | In-memory (pluggable — Redis-ready, not yet wired) |
| File Storage     | AWS S3 (pre-signed URLs only)                      |
| Validation       | Zod                                                |
| Auth             | JWT (access token 15min + refresh token 7d)        |
| Logging          | Winston (JSON in prod, coloured in dev)            |
| Containerisation | Docker (multi-stage)                               |
| CI/CD            | GitHub Actions                                     |
| API Docs         | Swagger / OpenAPI 3.0 (swagger-jsdoc)              |

---

## Project Structure

```
src/
├── modules/             # Feature modules — one folder per domain
│   ├── auth/
│   ├── student/
│   ├── fees/
│   ├── documents/
│   ├── academics/
│   └── admin/
│
├── shared/              # Truly shared code — no module-specific logic here
│   ├── middlewares/
│   ├── utils/
│   ├── types/
│   └── config/
│
├── lib/                 # Third-party client singletons (Prisma, cache)
│   ├── prisma.ts
│   └── cache.ts         # Cache abstraction — swap implementation without touching modules
│
├── routes/              # Root router — mounts all module routes
├── app.ts               # Express setup — no listen() here
└── server.ts            # Entry point — only calls app.listen()
```

**Inside every module — always this exact structure:**

```
modules/student/
├── student.controller.ts   # HTTP layer only — parse req, call service, send res
├── student.service.ts      # Business logic — no HTTP context, no Prisma calls
├── student.repository.ts   # ALL Prisma queries — no business logic
├── student.routes.ts       # Express router — routing and middleware only
├── student.validator.ts    # Zod schemas for all inputs in this module
├── student.mapper.ts       # Maps DB/Prisma types to safe response DTOs
└── student.types.ts        # TypeScript interfaces and DTOs for this module
```

---

## Architecture Principles

### SOLID Principles — Apply to Every Class and Function

**Single Responsibility (SRP)**

- Controllers do ONE thing: handle HTTP in/out. No business logic.
- Services do ONE thing: execute business logic. No HTTP, no DB calls.
- Repositories do ONE thing: query the database. No business logic.
- Mappers do ONE thing: transform data shapes. No logic beyond field mapping.
- One exported function = one responsibility. If you need "and" to describe it, split it.

**Open/Closed (OCP)**

- Use the cache abstraction (`lib/cache.ts`) so caching can be switched from in-memory
  to Redis by swapping the implementation, not editing calling code.
- Validators are Zod schemas — extend with `.extend()` rather than modifying originals.
- Middleware is composable — add behaviour by stacking middleware, not editing existing ones.

**Liskov Substitution (LSP)**

- Cache implementations (InMemoryCache, RedisCache) must honour the same `ICache` interface.
- Repository functions must return the same mapped type regardless of how the query changes internally.

**Interface Segregation (ISP)**

- Define narrow interfaces for what each consumer needs.
- Do not pass the entire `req` object into a service — extract only the fields needed.
- `IStudentRepository` exposes only the methods that `StudentService` actually uses.

**Dependency Inversion (DIP)**

- Services depend on repository interfaces (`IStudentRepository`), not concrete classes.
- This makes services unit-testable by injecting mock repositories.
- The cache layer depends on `ICache` interface — not on any concrete implementation.

---

## Cache Layer — Pluggable, Redis-Ready

**Current state:** in-memory implementation (Map-based, process-scoped).
**Future state:** drop-in Redis implementation without changing any module code.

All modules interact with the cache ONLY through the `ICache` interface.
Never import a Redis client or an in-memory Map directly inside any module.

```typescript
// lib/cache.ts — the contract all modules use
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
  remember<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T>;
}

// Two implementations — selected via config, same interface:
// InMemoryCache  — default, no external dependency
// RedisCache     — activated when REDIS_URL env var is present

// Usage in any module — always this, never anything else:
import { cache } from "@/lib/cache";
await cache.remember("key", fetcher, 300);
```

**To add Redis later (zero module changes required):**

1. Create `lib/cache/redis.cache.ts` implementing `ICache`
2. Update `lib/cache.ts` factory to return `RedisCache` when `REDIS_URL` env var is set
3. No changes needed in any module or service

**Cache key naming convention (consistent from day one):**

```
auth:refresh:{userId}            # Refresh token store
auth:blacklist:{tokenJti}        # Invalidated access tokens
cache:students:{hash}            # Student list by filter hash
cache:batches:{courseId}         # Batches per course
cache:fee_structure:{courseId}   # Fee structure per course
rate_limit:{ip}                  # Rate limit counter
```

---

## Mapper Pattern — Never Expose the DB Schema Directly

Every module has a `moduleName.mapper.ts` file.
Controllers ALWAYS call the mapper before sending any response.
Repositories return raw Prisma types. Mappers convert them to safe DTOs.

**Why mappers are necessary even in PostgreSQL with Prisma:**

- Prisma models include fields that must never reach the API: `password`, `deletedAt`,
  internal join IDs, and internal flags.
- DB schema evolves (columns added, renamed) without breaking the API contract.
- Response shape is explicitly controlled and documented.
- Same DB row can be mapped differently per role: student sees fewer fields than admin.
- Raw `Date` objects and `Decimal` objects from Prisma must be converted before JSON serialisation.

```typescript
// modules/student/student.types.ts — the DTO (what the API actually returns)
export interface StudentDTO {
  id: string;
  studentCode: string;
  fullName: string;
  email: string;
  phone: string;
  course: { id: string; name: string; code: string };
  batch: { id: string; name: string };
  admissionStatus: AdmissionStatus;
  createdAt: string; // always ISO string — never raw Date
}

// modules/student/student.mapper.ts
import type { Student, Course, Batch } from "@prisma/client";
import type { StudentDTO } from "./student.types";

type StudentWithRelations = Student & { course: Course; batch: Batch };

export const StudentMapper = {
  toDTO(student: StudentWithRelations): StudentDTO {
    return {
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      course: {
        id: student.course.id,
        name: student.course.name,
        code: student.course.code,
      },
      batch: { id: student.batch.id, name: student.batch.name },
      admissionStatus: student.admissionStatus,
      createdAt: student.createdAt.toISOString(),
      // password -> NOT mapped. deletedAt -> NOT mapped. internalFlags -> NOT mapped.
    };
  },
  toDTOList(students: StudentWithRelations[]): StudentDTO[] {
    return students.map(StudentMapper.toDTO);
  },
};
```

**Mapper rules — non-negotiable:**

- Mappers are pure functions — no async, no DB calls, no business logic
- Always convert `Date` to `string` via `.toISOString()`
- Always convert Prisma `Decimal` to `string` via `.toFixed(2)`
- Never spread Prisma objects (`...student`) — map every field explicitly by name
- Sensitive fields excluded by omission, not by deletion — unlisted fields never appear
- If admin and student need different views of the same record, write two mapper functions

---

## ACID Compliance

All operations writing to more than one table MUST use `prisma.$transaction()`.

**Atomicity** — all writes succeed or none do:

```typescript
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.create({ data: paymentData });
  await tx.ledgerEntry.update({ where: { id }, data: { status: "PAID" } });
  await tx.receipt.create({ data: { paymentId: payment.id, ...receiptData } });
  // If receipt.create throws, payment and ledgerEntry are rolled back automatically
});
```

**Consistency** — business rules enforced at DB level:

- Use `@unique` constraints for student email and student code
- Use explicit `onDelete` on every `@relation`
- Use Prisma enums for all status and type fields — never plain strings
- Use `Decimal` type for all money — never `Float`

**Isolation** — concurrent operations do not corrupt data:

- For capacity checks: read and decrement inside the same transaction
- Use `$queryRaw` with `SELECT FOR UPDATE` when checking and modifying shared counters

**Durability** — handled by PostgreSQL at engine level. Ensure migrations run via
Docker entrypoint before app starts — never inside application code.

---

## Security — OWASP Top 10 Mitigations

Apply these in every suggestion where relevant.

### A01 — Broken Access Control

- Every route has both `requireAuth` middleware AND `requireRole([...])` middleware
- Student routes verify `req.user.id === params.studentId` in the service layer
- Never use client-supplied IDs to scope queries without ownership verification
- Audit log entry on every admin state-changing action

### A02 — Cryptographic Failures

- Passwords: `bcrypt` minimum 12 rounds
- JWT secrets: minimum 32-character random string
- Refresh tokens: stored as bcrypt hash in DB — raw value only in httpOnly cookie
- S3 pre-signed URLs: server-side generation only, 15 min max expiry
- Never log tokens, passwords, or S3 keys
- HTTPS enforced via `helmet` HSTS header in production

### A03 — Injection

- Prisma prevents SQL injection by default on all standard queries
- Raw queries MUST use `$queryRaw` with `Prisma.sql` tagged template
- `$queryRawUnsafe` is NEVER acceptable — ever
- All query parameters parsed through Zod before use

### A04 — Insecure Design

- Admission status transitions enforced server-side — client cannot dictate state jumps
- Financial balances calculated server-side — client never sends a balance value
- Role embedded in JWT by server — never accepted from request body

### A05 — Security Misconfiguration

- `helmet()` applied globally before all routes
- CORS: explicit origin whitelist in production — never `origin: *`
- All env vars validated at startup with Zod — missing or invalid config = hard crash
- No static file serving from Express

### A06 — Vulnerable Components

- `npm audit` runs in CI — blocks merge on high or critical vulnerabilities
- `npm ci --frozen-lockfile` always — never `npm install` in CI or Docker
- Node.js pinned to LTS version in Dockerfile — never `node:latest`

### A07 — Authentication Failures

- Login endpoint rate limited: 5 attempts per 15 minutes per IP
- Account lockout after 10 consecutive failures — stored in DB, unlocked by Super Admin
- Refresh token rotation: each use issues a new token and invalidates the previous one
- Logout deletes refresh token from DB immediately — no waiting for expiry
- Token JTI tracked in DB for invalidation on logout and password change

### A08 — Software and Data Integrity

- `npm ci --frozen-lockfile` in all CI and Docker builds
- Git-tracked migrations — never manually edited in production DB

### A09 — Logging and Monitoring

- Auth events logged: login, logout, failed login, refresh, role change
- All admin write actions logged to `AuditLog` with before/after JSON state
- Log fields always include: `userId`, `ip`, `userAgent`, `action`, `entity`, `entityId`, `timestamp`
- NEVER log: `password`, `token`, `secret`, S3 key, or student PII fields
- Log level `warn` on repeated 403s or invalid token attempts

### A10 — SSRF

- Never fetch user-supplied URLs
- S3 operations use AWS SDK only — no user-controlled bucket paths
- Webhook URLs (future) must validate against an allowlist

---

## Input Sanitization

Applied at the middleware layer in `app.ts` — before validation, before controllers reach data.

**Rules applied to every request:**

- Strip all HTML from every string field — this is a JSON API, no HTML stored ever
- Trim whitespace from all string inputs
- Normalize email to lowercase before any DB operation
- Phone numbers: strip all non-digit characters before storage
- File names from uploads: sanitize with `path.basename()`, reject path traversal patterns (`../`, `..\\`)
- Query string parameters: always parse through Zod before use — treat as untrusted
- Numeric fields: parse with `Number()`, validate range with Zod — never trust coercion
- Reject requests with `Content-Type` other than `application/json` on JSON endpoints
- Enforce request body size limit: `10mb` max via `express.json({ limit: '10mb' })`

---

## Coding Conventions

### TypeScript

- `strict: true` — never use `any`, not even temporarily
- Use `unknown` when type is genuinely unknown, then narrow with type guards
- Explicit return types on all exported functions
- `readonly` on properties that must not mutate after construction
- `interface` for object shapes, `type` for unions and mapped types
- `satisfies` operator on config objects and response literals
- `Readonly<T>` on function parameters that must not be mutated

### Naming

- Files: `kebab-case.ts` — e.g. `student.service.ts`, `student.mapper.ts`
- Classes: `PascalCase`
- DI contract interfaces: `PascalCase` prefixed with `I` — e.g. `IStudentRepository`, `ICache`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Zod schemas: `camelCase` + `Schema` suffix — e.g. `createStudentSchema`
- DTOs: `PascalCase` + `DTO` suffix — e.g. `StudentDTO`
- Input types: `PascalCase` + `Input` suffix — e.g. `CreateStudentInput`
- DB IDs: `cuid()` always — never auto-increment integers
- Prisma enums: `UPPER_SNAKE_CASE`
- Money fields: `Decimal` type — never `Float` or `number`

### Imports

- Always `@/` path aliases — never relative `../` from within modules
- Group: 1) Node built-ins, 2) third-party, 3) internal `@/` imports
- No barrel files inside modules — import directly from the file

### Functions

- Max 40 lines — split if longer
- Single responsibility — describable without "and"
- Pure functions preferred in services
- Verb-noun naming: `createStudent`, `validateCapacity`, `mapToDTO`
- Services receive plain typed objects as arguments — never `req`, never raw Prisma models

---

## Database Conventions (Prisma)

```prisma
id         String    @id @default(cuid())    // never auto-increment
createdAt  DateTime  @default(now())          // on every model
updatedAt  DateTime  @updatedAt               // on every model
deletedAt  DateTime?                          // soft delete — never hard delete records
amount     Decimal   @db.Decimal(10, 2)       // money — never Float
```

- Migration names: descriptive — `add_student_ledger_table` not `migration_001`
- Never edit an existing migration — create a new one
- Seed at `prisma/seed.ts` — always idempotent
- All enums in Prisma schema — never plain string status fields
- Explicit `onDelete` on every `@relation`
- `@@index` on every FK, every filtered field, every sorted field

---

## Module Context

### auth

- Access token: 15 min, `JWT_ACCESS_SECRET`
- Refresh token: 7 days, `JWT_REFRESH_SECRET`, httpOnly cookie, JTI stored in DB
- Payload: `{ sub: userId, role: UserRole, jti: uuid, iat, exp }`
- Login rate limited, account locks after 10 failures

### student

- Student code: `YYYY-COURSECODE-SEQUENCE` e.g. `2025-CS-0042`
- Status machine: `APPLIED → UNDER_REVIEW → APPROVED | REJECTED` (server-enforced, no backward moves)
- Capacity check inside DB transaction to prevent race conditions
- Every data change writes to `AuditLog` with before/after JSON
- Mapper strips: `deletedAt`, internal flags, password

### fees

- Ledger auto-created when admission transitions to `APPROVED`
- All payment writes inside `prisma.$transaction()`
- Money as `Decimal` everywhere — arithmetic server-side only
- Balance always calculated live — never stored as a column
- Receipts: PDF via pdfkit, stored S3, URL in `Receipt.s3Key`
- Concessions: `ADMIN` / `SUPER_ADMIN` only — `STAFF` → 403
- Mapper converts `Decimal` to `.toFixed(2)` string before response

### documents

- Upload flow: pre-signed PUT URL → direct S3 upload → confirm endpoint saves metadata
- Files never written to API server disk
- S3 key: `documents/{studentId}/{type}/{timestamp}-{sanitizedName}`
- Pre-signed GET URL generated fresh per view — 15 min expiry
- Mapper strips: raw S3 bucket, internal key — response contains only the pre-signed URL

### academics

- Admin uploads marksheets — student role → 403 on upload
- Semester promotion: `ADMIN` only — `STAFF` → 403
- Soft delete only — `deletedAt` field, never hard delete
- Mapper strips: `deletedAt`, version tracking fields

### admin

- User creation: `SUPER_ADMIN` only
- Deactivation: sets `status = INACTIVE` AND deletes all `RefreshToken` rows for that user
- `AuditLog`: append-only — no UPDATE or DELETE ever on this table
- Mapper strips: `password` hash — never in any response

---

## API Conventions

```
/api/v1/auth/login
/api/v1/auth/logout
/api/v1/auth/refresh
/api/v1/students
/api/v1/students/:studentId
/api/v1/students/:studentId/ledger
/api/v1/students/:studentId/documents
/api/v1/students/:studentId/academics
/api/v1/fees/structures
/api/v1/fees/payments
/api/v1/fees/reports
/api/v1/documents
/api/v1/admin/users
/api/v1/admin/audit-logs
/api/v1/admin/settings
```

Methods: `GET` read-only / `POST` create / `PATCH` partial update / `DELETE` soft-delete only

Pagination: `?page=1&limit=20&sortBy=createdAt&sortOrder=desc`
Response always includes `pagination: { page, limit, total, totalPages, hasNext, hasPrev }`

---

## Testing Conventions

- Unit: service functions with mocked repositories (Jest mocks)
- Integration: Supertest against real test PostgreSQL DB — never mock Prisma
- Test DB seeded fresh per suite via `prisma migrate reset`
- Fixtures in `tests/fixtures/` — factory functions for all test data, never hardcoded IDs
- Coverage: 80% services, 70% overall — enforced in CI
- Every service function covers: happy path, not-found, forbidden, invalid input

---

## What Copilot Should Always Do

- Wrap async route handlers with `asyncHandler()`
- Call the module mapper before `sendSuccess()` — never pass raw Prisma objects to response utils
- Convert `Date` to `.toISOString()` and `Decimal` to `.toFixed(2)` in mappers
- Use `void` for intentional fire-and-forget async calls
- Add JSDoc on all exported functions
- Add Swagger JSDoc annotations on all route handlers
- Import from `@/` aliases only
- Use `logger.*` — never `console.log`
- Add `@@index` when suggesting new queryable Prisma fields
- Use `satisfies` on config and response literal objects
- Wrap multi-table writes in `prisma.$transaction()`
- Use `Decimal` for every money field
- Normalize email to lowercase before DB operations
- Access cache only via `cache` from `@/lib/cache` — never implement caching inline in modules

## What Copilot Should Never Do

- Never use `any` — use `unknown` + type guard
- Never spread Prisma objects into responses — always use the mapper
- Never send raw Prisma `Date` or `Decimal` objects in API responses
- Never log passwords, tokens, secrets, S3 keys, or student PII
- Never expose direct S3 URLs — always pre-signed URLs with expiry
- Never call `res.json()` or `res.send()` directly — use response utility functions
- Never use `throw new Error()` — use `AppError` or `Errors.*`
- Never use `.then()` chains — use async/await
- Never hardcode role strings — always use the `UserRole` Prisma enum
- Never skip Zod validation on body, params, or query
- Never call Prisma directly in a controller or service — repositories only
- Never use `$queryRawUnsafe` — use `$queryRaw` with `Prisma.sql`
- Never run migrations inside application startup code
- Never use `Float` for money fields — always `Decimal`
- Never import a Redis client or cache implementation directly in a module — use `ICache` from `@/lib/cache`
