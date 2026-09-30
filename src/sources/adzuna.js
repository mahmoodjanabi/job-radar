// Adzuna — free API, good salary + location data. https://developer.adzuna.com/
// Env: ADZUNA_APP_ID, ADZUNA_APP_KEY
import { makeJob, fetchJson, extractSalary, log } from '../util.js';

const BASE = 'https://api.adzuna.com/v1/api/jobs/us/search';

export async function fetchAdzuna(criteria) {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) { log('adzuna: skipped (no ADZUNA_APP_ID/KEY)'); return []; }

  const jobs = [];
  for (const q of criteria.searchQueries) {
    for (const where of criteria.searchLocations) {
      const params = new URLSearchParams({
        app_id: id, app_key: key,
        results_per_page: '50',
        what: q,
        where,
        distance: where === 'California' ? '0' : '40',
        max_days_old: '14',
        sort_by: 'date',
        'content-type': 'application/json',
      });
      try {
        const data = await fetchJson(`${BASE}/1?${params}`);
        for (const r of data.results ?? []) {
          const sal = (r.salary_min || r.salary_max) ? { salary_min: r.salary_min, salary_max: r.salary_max } : extractSalary(r.description);
          jobs.push(makeJob({
            source: 'adzuna',
            external_id: r.id,
            url: r.redirect_url,
            title: r.title,
            company: r.company?.display_name,
            location: r.location?.display_name,
            description: r.description,
            posted_at: r.created,
            ...sal,
          }));
        }
      } catch (e) {
        log(`adzuna: "${q}" @ ${where} failed: ${e.message}`);
      }
    }
  }
  log(`adzuna: ${jobs.length} raw results`);
  return jobs;
}
