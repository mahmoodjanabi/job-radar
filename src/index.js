import { criteria } from './criteria.js';
import { fetchAdzuna } from './sources/adzuna.js';
import { fetchJSearch } from './sources/jsearch.js';
import { fetchWorkday } from './sources/workday.js';
import { fetchGreenhouse, fetchLever } from './sources/boards.js';
import { makeStore } from './store.js';
import { prefilter, scoreJobs } from './score.js';
import { sendDigest } from './digest.js';
import { log } from './util.js';

export async function run({ sources } = {}) {
  const store = makeStore();

  // 1. Collect
  const fetchers = sources ?? [fetchAdzuna, fetchJSearch, fetchWorkday, fetchGreenhouse, fetchLever];
  const results = await Promise.allSettled(fetchers.map((f) => f(criteria)));
  const raw = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : (log(`source failed: ${r.reason?.message}`), [])));

  // 2. Dedupe within run (same URL from two sources) and against the DB
  const byId = new Map();
  const byUrl = new Set();
  for (const j of raw) {
    if (!j.url || !j.title) continue;
    const u = j.url.split('?')[0].toLowerCase();
    if (byUrl.has(u)) continue;
    byUrl.add(u);
    byId.set(j.id, j);
  }
  const fresh = await store.filterNew([...byId.values()]);
  log(`collected ${raw.length}, unique ${byId.size}, new ${fresh.length}`);

  // 3. Prefilter
  const rejected = [];
  const candidates = [];
  for (const j of fresh) {
    const pf = prefilter(j, criteria);
    if (pf.keep) candidates.push(j);
    else rejected.push({ ...j, score: 0, verdict: { prefilter: pf.why } });
  }
  log(`prefilter kept ${candidates.length}, rejected ${rejected.length}`);

  // 4. Score with Claude
  const scored = process.env.ANTHROPIC_API_KEY
    ? await scoreJobs(candidates, criteria)
    : (log('score: no ANTHROPIC_API_KEY — keyword-only mode, all candidates get 70'), candidates.map((j) => ({ ...j, score: 70, verdict: { note: 'keyword-only' } })));

  // 5. Persist everything (rejects too, so they are never re-scored)
  await store.saveScored([...rejected, ...scored].map(toRow));

  // 6. Digest of anything above threshold not yet sent
  const matches = await store.unnotifiedMatches(criteria.minScore);
  const sent = await sendDigest(matches, criteria);
  if (sent) await store.markNotified(matches.map((m) => m.id));

  return { raw: raw.length, fresh: fresh.length, candidates: candidates.length, matches: matches.length, sent };
}

function toRow(j) {
  return {
    id: j.id, source: j.source, external_id: j.external_id, url: j.url, title: j.title, company: j.company,
    location: j.location, remote: j.remote, salary_min: j.salary_min, salary_max: j.salary_max,
    description: j.description, posted_at: j.posted_at, score: j.score, verdict: j.verdict ?? null,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  run().then((r) => { log('done', JSON.stringify(r)); }).catch((e) => { console.error(e); process.exit(1); });
}
