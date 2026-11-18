# betterhomes recruitment dashboard

Static dashboard deployed on Vercel. `index.html` reads `data.json`.

`data.json` is rebuilt by a scheduled Claude task twice a day (Dubai time): it reads the Recruitment Campaign Leads 2026 Google Sheet (Leads tab, read only), Meta / Google Ads / LinkedIn spend via Supermetrics and the careers-page events in PostHog, saves them under `inputs/` (not committed), runs `node scripts/build.js inputs`, and pushes the new `data.json` here. Vercel redeploys on every push.

- `engine.js`: the counting rules (same as the claude.ai version of the dashboard).
- Names, emails and phone numbers are read only to count each applicant once and are never written to `data.json`.
