// JSearch (RapidAPI) — aggregates LinkedIn / Indeed / Glassdoor / ZipRecruiter via Google Jobs.
// Optional; free tier ~200 req/month, so queries are kept minimal. https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
// Env: RAPIDAPI_KEY
import { makeJob, fetchJson, extractSalary, log } from '../util.js';

export async function fetchJSearch(criteria) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) { log('jsearch: skipped (no RAPIDAPI_KEY)'); return []; }

  const jobs = [];
  // Two broad sweeps instead of one per query, to conserve quota.
  const sweeps = [
    { query: 'healthcare planner OR medical planner OR medical equipment planner in California', remote: false },
    { query: 'healthcare architect OR healthcare designer OR lab planner OR imaging planner California', remote: false },
    { query: 'medical equipment planner OR healthcare planner remote', remote: true },
  ];
  for (const s of sweeps) {
    const params = new URLSearchParams({
      query: s.query,
      page: '1',
      num_pages: '2',
      date_posted: 'week',
      ...(s.remote ? { remote_jobs_only: 'true' } : {}),
    });
    try {
      const data = await fetchJson(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' },
      });
      for (const r of data.data ?? []) {
        const loc = [r.job_city, r.job_state].filter(Boolean).join(', ') || r.job_location || '';
        const sal = (r.job_min_salary || r.job_max_salary)
          ? { salary_min: annualize(r.job_min_salary, r.job_salary_period), salary_max: annualize(r.job_max_salary, r.job_salary_period) }
          : extractSalary(r.job_description);
        jobs.push(makeJob({
          source: 'jsearch',
          external_id: r.job_id,
          url: r.job_apply_link || r.job_google_link,
          title: r.job_title,
          company: r.employer_name,
          location: loc,
          remote: r.job_is_remote ?? null,
          description: r.job_description,
          posted_at: r.job_posted_at_datetime_utc,
          ...sal,
        }));
      }
    } catch (e) {
      log(`jsearch: "${s.query}" failed: ${e.message}`);
    }
  }
  log(`jsearch: ${jobs.length} raw results`);
  return jobs;
}

function annualize(v, period) {
  if (!v) return null;
  const p = String(period || '').toUpperCase();
  if (p === 'HOUR') return v * 2080;
  if (p === 'MONTH') return v * 12;
  if (p === 'WEEK') return v * 52;
  return v;
}
