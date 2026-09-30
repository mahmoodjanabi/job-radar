// Greenhouse + Lever public boards. Zero auth. Add board tokens in criteria.js.
import { makeJob, fetchJson, extractSalary, log } from '../util.js';

const RELEVANT = /planner|healthcare|medical|clinical|hospital|architect|designer|imaging|radiology|laboratory|\blab\b|pharmacy|surgical/i;

export async function fetchGreenhouse(criteria) {
  const jobs = [];
  for (const board of criteria.greenhouseBoards) {
    try {
      const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
      for (const j of data.jobs ?? []) {
        if (!RELEVANT.test(j.title)) continue;
        jobs.push(makeJob({
          source: `greenhouse:${board}`,
          external_id: j.id,
          url: j.absolute_url,
          title: j.title,
          company: board,
          location: j.location?.name,
          description: j.content,
          posted_at: j.updated_at,
          ...extractSalary(j.content),
        }));
      }
    } catch (e) { log(`greenhouse ${board}: ${e.message}`); }
  }
  return jobs;
}

export async function fetchLever(criteria) {
  const jobs = [];
  for (const co of criteria.leverCompanies) {
    try {
      const data = await fetchJson(`https://api.lever.co/v0/postings/${co}?mode=json`);
      for (const j of data ?? []) {
        if (!RELEVANT.test(j.text)) continue;
        jobs.push(makeJob({
          source: `lever:${co}`,
          external_id: j.id,
          url: j.hostedUrl,
          title: j.text,
          company: co,
          location: j.categories?.location,
          remote: /remote/i.test(j.workplaceType || '') ? true : null,
          description: j.descriptionPlain || j.description,
          posted_at: j.createdAt,
          ...extractSalary(j.descriptionPlain),
        }));
      }
    } catch (e) { log(`lever ${co}: ${e.message}`); }
  }
  return jobs;
}
