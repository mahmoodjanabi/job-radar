// Workday — direct polling of employers' own career sites. No API key needed.
// Each tenant exposes a public JSON endpoint used by its careers page.
import { makeJob, fetchJson, extractSalary, log } from '../util.js';

const HEADERS = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 job-radar' };
const MAX_DETAILS_PER_TENANT = 25;

export async function fetchWorkday(criteria) {
  const jobs = [];
  for (const t of criteria.workdayTenants) {
    const base = `https://${t.tenant}.${t.wd}.myworkdayjobs.com`;
    const api = `${base}/wday/cxs/${t.tenant}/${t.site}`;
    const seen = new Set();
    const hits = [];
    for (const q of ['planner', 'healthcare architect', 'healthcare designer', 'medical equipment', 'clinical specialist']) {
      try {
        const data = await fetchJson(`${api}/jobs`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }),
        }, { retries: 1 });
        for (const p of data.jobPostings ?? []) {
          if (!p.externalPath || seen.has(p.externalPath)) continue;
          seen.add(p.externalPath);
          // Cheap pre-filter on location text so we don't fetch details for Ohio.
          const loc = (p.locationsText || '').toLowerCase();
          if (!/california|ca\b|remote|sacramento|roseville|folsom|rocklin|auburn|multiple locations/.test(loc)) continue;
          hits.push(p);
        }
      } catch (e) {
        log(`workday ${t.company}: search "${q}" failed: ${e.message}`);
        break; // tenant probably misconfigured; don't hammer it
      }
    }
    for (const p of hits.slice(0, MAX_DETAILS_PER_TENANT)) {
      try {
        const d = await fetchJson(`${api}${p.externalPath}`, { headers: HEADERS }, { retries: 1 });
        const info = d.jobPostingInfo ?? {};
        const locs = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean).join('; ');
        jobs.push(makeJob({
          source: `workday:${t.tenant}`,
          external_id: info.jobReqId || p.externalPath,
          url: `${base}/en-US/${t.site}${p.externalPath}`,
          title: info.title || p.title,
          company: t.company,
          location: locs || p.locationsText,
          remote: /remote/i.test(info.remoteType || '') ? true : null,
          description: info.jobDescription,
          posted_at: info.startDate,
          ...extractSalary(info.jobDescription),
        }));
      } catch (e) {
        log(`workday ${t.company}: detail failed: ${e.message}`);
      }
    }
    log(`workday ${t.company}: ${hits.length} hits`);
  }
  return jobs;
}
