import Anthropic from '@anthropic-ai/sdk';
import { log } from './util.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const MAX_SCORED_PER_RUN = Number(process.env.MAX_SCORED_PER_RUN || 150);

// Cheap rules first so Claude only sees plausible postings.
export function prefilter(job, criteria) {
  const t = job.title.toLowerCase();
  const d = job.description.toLowerCase();
  const titleHit = /planner|architect|designer|project manager|owner'?s rep|clinical specialist|applications specialist|space plan|facilit/.test(t);
  const domainHit = /healthcare|health care|hospital|medical|clinical|patient|hcai|oshpd|fgi|imaging|radiology|surgical|pharmacy|laborator/.test(t + ' ' + d);
  if (!titleHit || !domainHit) return { keep: false, why: 'no title/domain keyword' };
  if (job.salary_max && job.salary_max < criteria.salaryFloor) return { keep: false, why: `salary max ${job.salary_max} < floor` };
  // Hard geographic reject: clearly out-of-state and not remote
  const loc = job.location.toLowerCase();
  const remoteish = job.remote === true || /remote/.test(loc) || /remote/.test(d);
  const isCA = /california|\bca\b/.test(loc) || loc === '';
  if (!isCA && !remoteish) return { keep: false, why: `location "${job.location}" not CA/remote` };
  return { keep: true };
}

const SCHEMA = {
  name: 'record_job_fit',
  description: 'Record how well a job posting fits the candidate criteria',
  input_schema: {
    type: 'object',
    properties: {
      role_fit: { type: 'string', enum: ['target', 'adjacent', 'excluded', 'unrelated'], description: 'target = one of the target role families; excluded = one of the explicitly excluded families' },
      work_mode: { type: 'string', enum: ['remote', 'hybrid', 'onsite', 'unclear'] },
      location_ok: { type: 'boolean', description: 'true if remote (CA residents allowed) OR onsite/hybrid in an acceptable city. Sacramento proper onsite = false.' },
      salary_ok: { type: 'boolean', description: 'true if no salary stated, or stated max >= floor' },
      salary_note: { type: 'string', description: 'salary range found in the text, or "not stated"' },
      seniority: { type: 'string', enum: ['entry', 'mid', 'senior', 'lead/director', 'unclear'] },
      score: { type: 'integer', minimum: 0, maximum: 100, description: '0-100 overall fit. >=85 strong, 70-84 worth a look, <70 skip' },
      summary: { type: 'string', description: 'One sentence: what the job is and the single biggest reason for the score' },
      concerns: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short flags (e.g. "onsite in Sacramento", "requires RN license")' },
    },
    required: ['role_fit', 'work_mode', 'location_ok', 'salary_ok', 'salary_note', 'seniority', 'score', 'summary', 'concerns'],
  },
};

function systemPrompt(c) {
  return `You screen job postings for a candidate seeking healthcare planning/design roles. Be strict and literal about location and role family.

CANDIDATE CRITERIA
- Home: ${c.home}
- Acceptable on-site/hybrid cities ONLY: ${c.acceptableOnsiteCities.join(', ')}. On-site or hybrid in Sacramento proper, the Bay Area, or anywhere else is NOT acceptable.
- Remote is acceptable if the employer allows California residents (assume yes unless the posting restricts states and excludes CA).
- Salary floor: $${c.salaryFloor.toLocaleString()}/yr. If the posting states a range whose MAX is below the floor, salary_ok=false. If no salary is stated, salary_ok=true.
- TARGET role families: ${c.targetRoles.join('; ')}.
- EXCLUDED role families (reject even if the title looks similar): ${c.excludedRoles.join('; ')}.

SCORING
- role_fit=excluded or unrelated -> score <= 20.
- location_ok=false -> score <= 40.
- salary_ok=false -> score <= 40.
- Otherwise: target role 75-100 depending on how central healthcare planning/design is to the job; adjacent 55-74.
- Vendor "clinical specialist / applications" roles count as target only if they involve equipment planning, site planning, or installation design rather than pure sales or bedside training.`;
}

export async function scoreJobs(jobs, criteria) {
  const client = new Anthropic();
  const out = [];
  let n = 0;
  for (const job of jobs) {
    if (n >= MAX_SCORED_PER_RUN) { out.push({ ...job, score: null, verdict: { skipped: 'run cap' } }); continue; }
    n++;
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt(criteria),
        tools: [SCHEMA],
        tool_choice: { type: 'tool', name: 'record_job_fit' },
        messages: [{
          role: 'user',
          content: `TITLE: ${job.title}\nCOMPANY: ${job.company}\nLOCATION: ${job.location || 'not stated'}\nREMOTE FLAG: ${job.remote ?? 'unknown'}\nSALARY (parsed): ${job.salary_min ?? '?'} - ${job.salary_max ?? '?'}\n\nDESCRIPTION:\n${job.description.slice(0, 7000)}`,
        }],
      });
      const tool = msg.content.find((b) => b.type === 'tool_use');
      const v = tool?.input ?? {};
      out.push({ ...job, score: v.score ?? 0, verdict: v });
    } catch (e) {
      log(`score: ${job.title} @ ${job.company} failed: ${e.message}`);
      out.push({ ...job, score: null, verdict: { error: e.message } });
    }
  }
  log(`scored ${n} postings with ${MODEL}`);
  return out;
}
