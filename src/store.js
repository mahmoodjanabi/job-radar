import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { log } from './util.js';

const FILE_PATH = path.resolve(process.env.JOBS_FILE || 'data/jobs.json');

// Priority: DRY_RUN → memory; Supabase creds → Supabase; otherwise → JSON file committed in the repo.
export function makeStore() {
  if (process.env.DRY_RUN) { log('store: in-memory (DRY_RUN)'); return memoryStore(new Map()); }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) { log('store: supabase'); return supabaseStore(createClient(url, key, { auth: { persistSession: false } })); }
  log(`store: json file ${path.relative(process.cwd(), FILE_PATH)}`);
  return fileStore();
}

function supabaseStore(sb) {
  return {
    async filterNew(jobs) {
      const ids = jobs.map((j) => j.id);
      const seen = new Set();
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error } = await sb.from('jobs').select('id').in('id', ids.slice(i, i + 500));
        if (error) throw error;
        for (const r of data) seen.add(r.id);
      }
      return jobs.filter((j) => !seen.has(j.id));
    },
    async saveScored(rows) {
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb.from('jobs').upsert(rows.slice(i, i + 200), { onConflict: 'id' });
        if (error) throw error;
      }
    },
    async markNotified(ids) {
      if (!ids.length) return;
      const { error } = await sb.from('jobs').update({ notified_at: new Date().toISOString() }).in('id', ids);
      if (error) throw error;
    },
    async unnotifiedMatches(minScore) {
      const { data, error } = await sb.from('jobs').select('*').gte('score', minScore).is('notified_at', null).order('score', { ascending: false });
      if (error) throw error;
      return data;
    },
  };
}

function memoryStore(rows) {
  return {
    async filterNew(jobs) { return jobs.filter((j) => !rows.has(j.id)); },
    async saveScored(list) { for (const r of list) rows.set(r.id, { ...r, first_seen_at: rows.get(r.id)?.first_seen_at ?? new Date().toISOString() }); },
    async markNotified(ids) { for (const id of ids) rows.get(id).notified_at = new Date().toISOString(); },
    async unnotifiedMatches(minScore) {
      return [...rows.values()].filter((r) => r.score >= minScore && !r.notified_at).sort((a, b) => b.score - a.score);
    },
    _rows: rows,
  };
}

function fileStore() {
  let rows = new Map();
  try { rows = new Map(Object.entries(JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')))); } catch { /* first run */ }
  const mem = memoryStore(rows);
  const flush = () => {
    // Keep the file small: drop the description for anything already notified or rejected, keep 90 days.
    const cutoff = Date.now() - 90 * 86400e3;
    const out = {};
    for (const [id, r] of rows) {
      if (new Date(r.first_seen_at).getTime() < cutoff) continue;
      out[id] = (r.notified_at || !r.score || r.score < 70) ? { ...r, description: undefined } : r;
    }
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(out, null, 1));
  };
  return {
    ...mem,
    async saveScored(list) { await mem.saveScored(list); flush(); },
    async markNotified(ids) { await mem.markNotified(ids); flush(); },
  };
}
