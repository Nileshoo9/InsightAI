# AI Data Analyst SaaS (MVP)

Production-ready MVP to upload sales data (CSV/Excel), process it, store it, and generate AI-powered business insights.

## 1. Folder Structure

```text
.
|-- app
|   |-- (auth)
|   |   |-- login/page.tsx
|   |   `-- signup/page.tsx
|   |-- api
|   |   |-- analyze/route.ts
|   |   |-- auth
|   |   |   |-- login/route.ts
|   |   |   |-- logout/route.ts
|   |   |   |-- me/route.ts
|   |   |   `-- signup/route.ts
|   |   |-- files
|   |   |   |-- route.ts
|   |   |   `-- upload/route.ts
|   |   `-- insights
|   |       |-- [id]/route.ts
|   |       `-- route.ts
|   |-- dashboard/page.tsx
|   |-- insights/[id]/page.tsx
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components
|   |-- auth-form.tsx
|   |-- dashboard-client.tsx
|   |-- insight-view.tsx
|   `-- trend-chart.tsx
|-- lib
|   |-- services
|   |   |-- analytics.ts
|   |   |-- insights.ts
|   |   |-- openai.ts
|   |   `-- parser.ts
|   |-- auth.ts
|   |-- client-api.ts
|   |-- constants.ts
|   |-- http.ts
|   |-- prisma.ts
|   |-- require-auth.ts
|   |-- types.ts
|   `-- validation.ts
|-- prisma/schema.prisma
|-- .env.example
|-- .gitignore
|-- next.config.ts
|-- package.json
|-- postcss.config.js
|-- tailwind.config.ts
`-- tsconfig.json
```

## 2. Tech Stack

- Frontend: Next.js (App Router) + Tailwind CSS
- Backend: Next.js Route Handlers (`/app/api/*`)
- Database: Prisma + PostgreSQL
- AI: OpenAI Responses API
- Upload parsing: `papaparse` (CSV) + `xlsx` (Excel)
- Auth: JWT in HTTP-only cookie + bcrypt password hashing

## 3. Database Schema

Implemented in `prisma/schema.prisma`:

- `User`: `id`, `email`, `password`, `createdAt`
- `File`: `id`, `userId`, `fileName`, `uploadedAt`
- `DataRecord`: normalized parsed rows (`date`, `revenue`, `product`, `quantity`, `category`, `customer`)
- `Insight`: `id`, `userId`, `fileId`, `insightsText`, `insightsJson`, `createdAt`

## 4. Step-by-Step Build Mapping

1. Initialize project:
   - Configured Next.js + TypeScript + Tailwind + scripts in `package.json`
2. Setup database:
   - Added Prisma schema and client bootstrap
3. Setup authentication:
   - Signup/login/logout routes, bcrypt, JWT, secure cookie handling
4. Build file upload:
   - `/api/files/upload` with `multipart/form-data`
5. Parse CSV/Excel:
   - `lib/services/parser.ts` (header alias mapping + field normalization)
6. Save to database:
   - Creates `File`, bulk inserts `DataRecord`
7. Integrate OpenAI API:
   - `lib/services/openai.ts` using structured JSON schema output
8. Generate insights:
   - `/api/analyze` generates summary + AI insights and stores report
9. Display insights:
   - `app/insights/[id]/page.tsx` + `components/insight-view.tsx`
10. Build REST API endpoint:
   - `POST /api/analyze` supports:
     - `fileId` (authenticated internal analyze)
     - `data` array (external integration use-case)

## 5. API Contracts

### `POST /api/analyze`

Request:

```json
{
  "fileId": 1
}
```

or

```json
{
  "data": [
    {
      "date": "2026-01-10",
      "revenue": 1999.5,
      "product": "Rice Pack",
      "quantity": 10,
      "category": "Grocery",
      "customer": "CUST-101"
    }
  ]
}
```

Response:

```json
{
  "summary": {
    "totalRevenue": 1999.5,
    "weeklyGrowth": 0,
    "topProducts": []
  },
  "insights": {
    "keyInsights": [],
    "recommendations": [],
    "risks": [],
    "opportunities": [],
    "alerts": [],
    "trends": []
  }
}
```

## 6. Local Setup

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - `cp .env.example .env` (or create `.env` manually on Windows)
   - Set `DATABASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET`
   - If using Supabase and you see `database system is not accepting connections`, verify your project is active and use the correct Postgres connection string from Supabase settings
3. Prepare database:
   - `npm run prisma:generate`
   - `npm run prisma:push`
4. Start app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000`

## 7. How to Run Locally

1. Sign up at `/signup`
2. Login at `/login`
3. Upload CSV/Excel in `/dashboard`
4. Click `Analyze Data`
5. Open generated report in `/insights/[id]`

## 8. Deployment

Recommended: Vercel + hosted DB.

1. Push repo to GitHub
2. Import to Vercel
3. Set env vars in Vercel:
   - `OPENAI_API_KEY`
   - `JWT_SECRET`
   - `DATABASE_URL` (for production, prefer PostgreSQL + Prisma)
4. Run Prisma generate/push in deployment pipeline
5. Deploy

## 9. Notes for Production Hardening

- Add rate limiting on `/api/analyze` and upload routes
- Add schema-based column mapping UI if source files vary heavily
- Add background job queue for large files
- Add tenant-level RBAC and audit logs
- Add indexes and optimize PostgreSQL query patterns for multi-user scale
