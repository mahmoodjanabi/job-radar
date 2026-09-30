import { log } from './util.js';

// Digest delivery. Priority:
//   1. GitHub Issue (zero setup — Actions' built-in GITHUB_TOKEN; GitHub emails you the notification)
//   2. Zapier catch hook, if ZAPIER_HOOK_URL is set (optional)
//   3. DRY_RUN / nothing configured → print
export async function sendDigest(matches, criteria) {
  if (!matches.length) { log('digest: nothing new above threshold'); return false; }
  const subject = `Job Radar: ${matches.length} new match${matches.length === 1 ? '' : 'es'} — ${new Date().toISOString().slice(0, 10)}`;
  const md = renderMarkdown(matches, criteria);
  const html = renderHtml(matches, criteria);

  if (process.env.DRY_RUN) {
    log('digest: DRY_RUN — printing instead');
    console.log('\n' + subject + '\n\n' + md);
    return false;
  }

  let delivered = false;
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ title: subject, body: md, labels: ['digest'] }),
    });
    if (!res.ok) log(`digest: GitHub issue failed HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    else { log(`digest: opened GitHub issue with ${matches.length} matches`); delivered = true; }
  }
  if (process.env.ZAPIER_HOOK_URL) {
    const res = await fetch(process.env.ZAPIER_HOOK_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, html, text: md, count: matches.length, jobs: matches.map(slim) }),
    });
    if (!res.ok) log(`digest: zapier hook HTTP ${res.status}`);
    else { log(`digest: sent ${matches.length} matches to Zapier`); delivered = true; }
  }
  if (!delivered) { log('digest: no delivery channel configured — printing'); console.log('\n' + subject + '\n\n' + md); }
  return delivered;
}

function slim(m) {
  return { title: m.title, company: m.company, location: m.location, url: m.url, score: m.score, salary: m.verdict?.salary_note, summary: m.verdict?.summary };
}

function renderMarkdown(matches, criteria) {
  const head = `_Criteria: remote (CA) or on-site in ${criteria.acceptableOnsiteCities.slice(0, 4).join('/')} · salary ≥ $${(criteria.salaryFloor / 1000).toFixed(0)}k · score ≥ ${criteria.minScore}_\n`;
  const body = matches.map((m) => {
    const v = m.verdict ?? {};
    const flag = m.score >= 85 ? '🟢' : '🟡';
    const concerns = (v.concerns ?? []).length ? `\n  - ⚠️ ${v.concerns.join(' · ')}` : '';
    return `### ${flag} ${m.score} · [${m.title}](${m.url})\n**${m.company}** · ${m.location || 'location not stated'} · ${v.work_mode ?? ''} · ${v.salary_note ?? ''}\n\n${v.summary ?? ''}${concerns}\n\n<sub>via ${m.source}${m.posted_at ? ' · posted ' + m.posted_at.slice(0, 10) : ''}</sub>`;
  }).join('\n\n---\n\n');
  return head + '\n' + body;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderHtml(matches, criteria) {
  const rows = matches.map((m) => {
    const v = m.verdict ?? {};
    const badge = m.score >= 85 ? '#1a7f37' : '#9a6700';
    const concerns = (v.concerns ?? []).length ? `<div style="color:#9a6700;font-size:13px">⚠ ${esc(v.concerns.join(' · '))}</div>` : '';
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5">
      <div><span style="display:inline-block;background:${badge};color:#fff;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">${m.score}</span>
      &nbsp;<a href="${esc(m.url)}" style="font-size:16px;font-weight:600;color:#0b57d0;text-decoration:none">${esc(m.title)}</a></div>
      <div style="color:#333;margin-top:2px">${esc(m.company)} · ${esc(m.location || 'location not stated')} · ${esc(v.work_mode ?? '')} · ${esc(v.salary_note ?? '')}</div>
      <div style="color:#555;margin-top:4px;font-size:14px">${esc(v.summary ?? '')}</div>
      ${concerns}
      <div style="color:#999;font-size:12px;margin-top:4px">via ${esc(m.source)}${m.posted_at ? ' · posted ' + m.posted_at.slice(0, 10) : ''}</div>
    </td></tr>`;
  }).join('');
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">Job Radar — ${matches.length} new match${matches.length === 1 ? '' : 'es'}</h2>
    <div style="color:#666;font-size:13px;margin-bottom:12px">Criteria: remote (CA) or on-site in ${esc(criteria.acceptableOnsiteCities.slice(0, 4).join('/'))} · salary ≥ $${(criteria.salaryFloor / 1000).toFixed(0)}k · score ≥ ${criteria.minScore}</div>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
  </div>`;
}
