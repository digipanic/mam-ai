# Minor AM Audience Intelligence

Internal dashboard tracking the Minor AM roster across Instagram, SoundCloud,
and Resident Advisor.

## Architecture

```
Monitoring scripts → Google Sheets → Google Sheets API → this app (TanStack Start) → Vercel
```

The Google Sheet ("Minor AM — Social Media Monitoring Sheet") is the
production source of truth. `src/lib/audience-monitor.functions.ts` is a
server function (runs server-side only, never shipped to the browser) that
reads the Roster, Instagram/SoundCloud/Resident Advisor snapshot tabs, the
monthly-history tab, and the Viberate/Modash historical tab directly from the
Google Sheets API, then normalizes them into the shape every route consumes
via `useAudienceMonitor()`.

Data rules the normalization enforces — see `AGENTS.md` for the full list:

- The roster is read from the Roster tab; nothing is hard-coded.
- Missing data stays missing — never coerced to zero.
- Instagram, SoundCloud, and Resident Advisor are never summed or averaged.
- Every metric keeps its source visible (Minor AM monitoring / Viberate /
  Modash).
- Monthly growth always compares two distinct calendar months, using one
  canonical observation per artist/platform/month.
- Month-only historical data (e.g. some Modash exports) is never given an
  invented day.

## Environment

Set `GOOGLE_SHEETS_API_KEY` (a Google API key with the Sheets API enabled)
as a server-side environment variable — in Vercel this is a Project
Environment Variable, never a `VITE_`-prefixed one, so it's never bundled
into client code. The sheet must be shared as "Anyone with the link can
view" for a plain API key to read it; if it needs to stay unlisted, switch
`getBatch` in `audience-monitor.functions.ts` to a service-account bearer
token instead and share the sheet with that service account's email.

## Development

```sh
git clone <this-repository-url>
cd <repository-name>
bun install   # or npm install
GOOGLE_SHEETS_API_KEY=... bun run dev
```

## Deployment

Deploys to Vercel with no extra configuration — `vite build` runs nitro's
`vercel` preset, which emits the standard Vercel Build Output. Set
`GOOGLE_SHEETS_API_KEY` in the Vercel project's environment variables.
