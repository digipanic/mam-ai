# Minor AM Audience Intelligence

TanStack Start dashboard. Google Sheets is the single source of truth,
fetched server-side in `src/lib/audience-monitor.functions.ts` and served to
every route through `useAudienceMonitor()`.

## Non-negotiable data rules

- Roster is dynamic from the Roster tab — never hard-code artist names.
- Missing data stays missing. Never coerce a missing value to 0.
- Never average or sum across Instagram / SoundCloud / Resident Advisor.
- Always keep the observation source visible: Minor AM monitoring, Viberate,
  or Modash.
- Monthly growth must compare two *different* calendar months. Never diff two
  observations from the same month (see `monthOf` / the canonical
  `monthlyHistory` construction in `audience-monitor.functions.ts`).
- Use one canonical observation per artist/platform/month — see the
  live-point > historical-point > stored-monthly precedence order in
  `getAudienceMonitor`.
- Never invent a day for month-only data (e.g. Modash exports). Store those
  as bare `"YYYY-MM"` strings; `formatDate` renders them as a month, not a
  fabricated date.
- "Current audience" (latest valid observation) and "monitoring health"
  (whether Minor AM's own scraper is succeeding) are different concepts —
  don't conflate them.

No Lovable runtime dependency remains in this project, and no paid
infrastructure is used anywhere. The Sheet is kept **private** and read via a
free Google Cloud service account (`src/lib/google-service-account.ts` signs
its own JWT bearer token with `node:crypto` — no auth library, no
`GOOGLE_SHEETS_API_KEY`, no "anyone with the link"). The app builds with a
plain Vite + `nitro(vercel)` config and deploys as a single Node.js
serverless function on Vercel's free Hobby tier. Don't reintroduce a paid
service (Cloud Run, a hosted database, Supabase, etc.) for this — the sheet
is small and read-only, this setup is deliberately the simplest thing that
works.
