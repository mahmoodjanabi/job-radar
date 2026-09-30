# Job Radar

Every 6 hours: pulls healthcare planning/design postings from Adzuna, JSearch, and employer career sites → dedupes → Claude scores each against your criteria → new matches ≥ 70 are posted as a GitHub Issue (GitHub emails you the notification).

Criteria live in one file: `src/criteria.js`. Edit and push; the next run picks it up.

## Setup — 3 secrets

1. **Anthropic API key**: https://console.anthropic.com → API Keys → Create. Scoring uses Haiku; ~$1–3/month.
2. **Adzuna** (free): https://developer.adzuna.com → Register → copy Application ID + Application Key.
3. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `ANTHROPIC_API_KEY`
   - `ADZUNA_APP_ID`
   - `ADZUNA_APP_KEY`
4. **Actions → job-radar → Run workflow**. Check the log; the first digest arrives as an Issue.
5. Make sure GitHub notifications for this repo go to your email: repo → Watch → All Activity (or at least Issues).

## Optional
- **JSearch** (LinkedIn/Indeed/Glassdoor coverage): subscribe to the free tier at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch and add secret `RAPIDAPI_KEY`.
- **Supabase** instead of the JSON file: run `supabase/schema.sql`, add secrets `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`. The `matches` view is a nicer place to browse than `data/jobs.json`.
- **Zapier → Gmail**: build a Catch Hook → Gmail Zap and add secret `ZAPIER_HOOK_URL`. Payload: `{ subject, html, text, count, jobs[] }`.

## Tuning
- Too many / too few: `minScore` in `criteria.js` (70 default; 85 = strong fits only).
- Location calls: `acceptableOnsiteCities`.
- Employers: add Workday / Greenhouse / Lever entries in `criteria.js`.
- Role families: `targetRoles` / `excludedRoles` feed Claude's prompt directly.
- Schedule: `.github/workflows/job-radar.yml`.

## Local
```
npm install
npm test                 # offline fixtures
DRY_RUN=1 npm run run    # real APIs (keys in env), prints digest, writes nothing
```
