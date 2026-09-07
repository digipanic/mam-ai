# Minor AM Audience Intelligence

Internal dashboard tracking the Minor AM roster across Instagram, SoundCloud,
and Resident Advisor.

## Architecture

```
Monitoring scripts → Google Sheets → Google Sheets API (service account) → this app (TanStack Start) → Vercel
```

The Google Sheet ("Minor AM — Social Media Monitoring Sheet") is the
production source of truth, and stays **private** — it's shared only with a
Google service account, never "anyone with the link". `src/lib/audience-monitor.functions.ts` is a server function (runs
server-side only, never shipped to the browser) that authenticates as that
service account (`src/lib/google-service-account.ts`), reads the Roster,
Instagram/SoundCloud/Resident Advisor snapshot tabs, the monthly-history tab,
and the Viberate/Modash historical tab from the Google Sheets API, then
normalizes them into the shape every route consumes via `useAudienceMonitor()`.

No paid infrastructure is involved anywhere in this stack: the Sheets API and
a Google Cloud service account are free, and the app runs on Vercel's free
Hobby tier as a single Node.js serverless function.

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

Two server-side environment variables (never `VITE_`-prefixed, so they're
never bundled into client code):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the service account's `client_email`.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — the service account's `private_key`,
  pasted as one line with literal `\n` sequences (not real newlines).

See "Setup" below for exactly how to create these for free.

## Development

```sh
git clone <this-repository-url>
cd <repository-name>
bun install   # or npm install
cp .env.example .env   # fill in the two GOOGLE_SERVICE_ACCOUNT_* values
bun run dev
```

## Testing

```sh
bun test
```

Covers the Google Sheets normalization (canonical monthly checkpoints,
same-month growth rejection, no-zero-fill, dynamic roster, provenance) and
the service-account JWT signing, with no network access required.

## Deployment

Deploys to Vercel with no extra configuration — `vite build` runs nitro's
`vercel` preset, which emits the standard Vercel Build Output as a single
Node.js serverless function. Set the two `GOOGLE_SERVICE_ACCOUNT_*` variables
in the Vercel project's environment variables.

## Setup: Google Cloud + Vercel (free)

1. **Google Cloud project** — create one at console.cloud.google.com (no
   billing account required for this).
2. **Enable the Google Sheets API** for that project (APIs & Services →
   Enable APIs and Services → search "Google Sheets API" → Enable). Free,
   no quota cost at this app's read volume.
3. **Create a service account** (APIs & Services → Credentials → Create
   Credentials → Service account). No roles/permissions need to be granted
   at the project level — this account only needs Viewer access to the one
   Sheet, granted in the next step.
4. **Create a JSON key** for that service account (its page → Keys → Add
   Key → Create new key → JSON) and download it. It contains `client_email`
   and `private_key`.
5. **Share the Google Sheet** with the service account's `client_email` as
   Viewer — the same way you'd share it with a person. The sheet stays
   private to everyone else.
6. **Set the two environment variables** in the Vercel project (Settings →
   Environment Variables): `GOOGLE_SERVICE_ACCOUNT_EMAIL` = the
   `client_email` value, and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` = the
   `private_key` value pasted exactly as it appears in the JSON (keep the
   `\n` escapes and the `-----BEGIN/END PRIVATE KEY-----` lines).
7. **Deploy** — connect the GitHub repo to a new Vercel project (Hobby
   plan/tier is enough) and redeploy after the env vars are set.

Nothing else needs creating: no OAuth consent screen, no Cloud Run service,
no database, no other Google or Vercel product.
