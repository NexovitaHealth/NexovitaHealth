# Nexovita Health

A production-grade multi-tenant health SaaS platform for home care, hospice, palliative, and school health agencies. Built with Next.js 14, Prisma, PostgreSQL, and JWT-based authentication.

## Tech Stack

| Layer     | Technology                      |
| --------- | ------------------------------- |
| Framework | Next.js 14 (App Router)         |
| Language  | TypeScript (strict)             |
| Database  | PostgreSQL via Prisma ORM       |
| Auth      | Custom JWT (jose) + bcryptjs    |
| Styling   | Tailwind CSS                    |
| State     | TanStack Query v5               |
| Email     | Nodemailer                      |
| Storage   | Local filesystem (S3-swappable) |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+

### 1. Clone & install

```bash
git clone <repo>
cd nexovita-health
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

### 3. Set up the database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed demo data
npm run db:seed
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Accounts

All demo accounts use password: `Admin@123!`

| Role         | Email                       |
| ------------ | --------------------------- |
| Agency Admin | `admin@sunrise.health`      |
| Supervisor   | `supervisor@sunrise.health` |
| Aide         | `aide@sunrise.health`       |
| Physician    | `physician@sunrise.health`  |

## Project Structure

```
src/
├── app/
│   ├── (auth)/             # Login, Register, Forgot Password
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (app)/              # Authenticated app shell
│   │   ├── dashboard/
│   │   ├── patients/
│   │   │   └── [patientId]/
│   │   ├── projects/
│   │   │   └── [projectId]/  # Kanban board
│   │   ├── tasks/
│   │   ├── team/
│   │   ├── schedule/
│   │   ├── vitals/
│   │   ├── labs/
│   │   ├── messages/
│   │   ├── reports/
│   │   ├── audit/
│   │   └── settings/
│   └── api/
│       ├── auth/             # login, logout, me, register, forgot-password
│       └── orgs/[orgId]/     # All multi-tenant API routes
│           ├── patients/
│           ├── tasks/
│           ├── projects/
│           ├── members/
│           ├── invite/
│           ├── audit/
│           ├── schedule/
│           ├── labs/
│           ├── messages/
│           └── reports/[type]/
├── components/
│   └── layout/             # Sidebar, TopBar
├── hooks/
│   ├── useAuth.tsx         # Auth context + login/logout
│   └── useApi.ts           # Org-scoped API client
├── lib/
│   ├── prisma.ts           # Database singleton
│   ├── auth.ts             # JWT / session helpers
│   ├── middleware.ts       # withAuth, withOrgAccess HOFs
│   ├── permissions.ts      # Role-based permission checks
│   ├── api-response.ts     # Typed response helpers
│   ├── audit.ts            # Audit log writer
│   ├── email.ts            # Nodemailer wrapper
│   ├── storage.ts          # File storage abstraction
│   └── utils.ts            # Formatters, color helpers
├── types/
│   └── index.ts            # Local type mirrors of Prisma enums
prisma/
├── schema.prisma           # 30+ model schema
└── seed.ts                 # Demo data seeder
```

## Architecture Decisions

### Multi-Tenancy

All patient, task, and clinical data is scoped to an `orgId`. The `withOrgAccess` middleware resolves org membership from the JWT session and validates role before every API call.

### Authentication

JWT tokens are signed with HS256 using jose. Sessions are stored in the database for revocability, with the token itself used as a stateless fast-path. Cookie: `HttpOnly`, `SameSite=Lax`, 7-day TTL.

Staff pages are guarded by `src/middleware.ts` (edge JWT verification). API routes use `getSessionFromRequest()` for full DB session validation. Unauthenticated navigation to staff routes redirects to `/login?redirect=…`.

### Role-Based Access Control

Two dimensions:

1. **User Role** (`agency_admin`, `supervisor`, `physician`, `aide`, etc.) — what clinical actions they can perform globally.
2. **Org Role** — their membership level within a specific organization.

The `permissions.ts` matrix maps `action:resource` strings to allowed roles. The `canUserPerform(user, action)` helper is used in route handlers before writing.

### API Design

- All routes use `withOrgAccess()` middleware
- Responses follow `{ success, data, pagination? }` envelope
- Zod validates all POST/PATCH bodies
- Pagination: `page`, `pageSize` querystring params
- Soft deletes on tasks and patients (`deletedAt` timestamp)

### Audit Trail

`createAuditLog()` is called after every mutation. Logs include: actor, action, resourceType, resourceId, orgId, metadata (diff), and IP address. The audit page is admin-only.

## NPM Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client
npm run db:migrate   # Run migrations
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio GUI
```

## Production Deployment Changes

1. Set all env vars (see `.env.example`)
2. Run `npx prisma migrate deploy` (not `dev`)
3. Run `npm run build && npm start`
4. Set `NODE_ENV=production`
5. Point a reverse proxy (nginx/caddy) at port 3000

For file uploads in production, set `STORAGE_PROVIDER=s3` and configure AWS credentials.
