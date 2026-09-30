import crypto from 'node:crypto';

// Normalized job record. Every source returns an array of these.
export function makeJob(fields) {
  const job = {
    source: fields.source,
    external_id: String(fields.external_id ?? fields.url),
    url: fields.url,
    title: (fields.title ?? '').trim(),
    company: (fields.company ?? '').trim(),
    location: (fields.location ?? '').trim(),
    remote: fields.remote ?? null,
    salary_min: numOrNull(fields.salary_min),
    salary_max: numOrNull(fields.salary_max),
    description: stripHtml(fields.description ?? '').slice(0, 12000),
    posted_at: fields.posted_at ? new Date(fields.posted_at).toISOString() : null,
  };
  job.id = crypto.createHash('sha1').update(`${job.source}:${job.external_id}`).digest('hex');
  return job;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function stripHtml(s) {
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Pull "$95,000 - $120,000" or "$48/hr" style ranges out of free text when the API gives none.
export function extractSalary(text) {
  if (!text) return {};
  const t = text.replace(/,/g, '');
  const hourly = t.match(/\$\s?(\d{2,3}(?:\.\d+)?)\s?(?:-|–|to)\s?\$?\s?(\d{2,3}(?:\.\d+)?)\s?(?:\/|per)\s?(?:hr|hour)/i);
  if (hourly) return { salary_min: Math.round(Number(hourly[1]) * 2080), salary_max: Math.round(Number(hourly[2]) * 2080) };
  const range = t.match(/\$\s?(\d{2,3}(?:\.\d+)?)\s?(k)?\s?(?:-|–|to)\s?\$?\s?(\d{2,3}(?:\.\d+)?)\s?(k)?/i);
  if (range) {
    let lo = Number(range[1]) * (range[2] ? 1000 : 1);
    let hi = Number(range[3]) * (range[4] ? 1000 : 1);
    if (lo < 1000 && hi < 1000) { lo *= 1000; hi *= 1000; } // "$95 - $120K" shorthand
    if (lo >= 20000 && hi >= lo) return { salary_min: lo, salary_max: hi };
  }
  const full = t.match(/\$\s?(\d{5,6})(?:\.\d+)?\s?(?:-|–|to)\s?\$?\s?(\d{5,6})/);
  if (full) return { salary_min: Number(full[1]), salary_max: Number(full[2]) };
  return {};
}

export async function fetchJson(url, init = {}, { retries = 2, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
        err.fatal = true;
        throw err;
      }
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (e.fatal) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
