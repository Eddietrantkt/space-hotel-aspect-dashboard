# SPACE Hotel Aspect Dashboard

Standalone Next.js dashboard for the SPACE hotel review summarization dataset.

The app includes:

- SPACE aspect dashboard UI at `/space-dashboard`
- Built-in JSON data under `public/data`
- Vercel-compatible API routes under `/api`
- Method comparison for generated summaries
- Search by entity ID, hotel name, and location evidence

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000/space-dashboard
```

## Deploy To Vercel

Create a new GitHub repository from this folder, then import it in Vercel.

Recommended Vercel settings:

```text
Framework Preset: Next.js
Root Directory: .
Install Command: npm install
Build Command: npm run build
Output Directory: default
Environment Variables: none required
```

The app uses local API routes and bundled JSON data, so it can run on Vercel without a separate backend.

## Important Files

```text
app/space-dashboard/page.tsx
components/SpaceDarkDashboard.tsx
components/SpaceDarkDashboard.module.css
lib/server-data.ts
public/data/space_4method.json
public/data/space_summary_methods.json
public/data/space_method_demo.json
public/data/rouge_space.json
```

## API Routes

```text
GET /api/health
GET /api/space
GET /api/space/summary-methods
GET /api/space/search?q=montreal&limit=10
GET /api/space/entities/:entityId
GET /api/data
GET /api/data/:filename
```

`/api/analyze` is included as a placeholder and returns `503`. Real model inference should run in a separate Python/FastAPI service or batch pipeline, then write results back into the JSON files or a database.

## Data Storage Model

For this Vercel-ready version, summaries are stored as static JSON:

```text
public/data/space_summary_methods.json
```

This is good for a portfolio demo because it is simple, reproducible, and cheap to host. For production, move these records to Postgres/Supabase and keep JSON only as seed/export artifacts.
