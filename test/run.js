// Offline test: runs the full pipeline on fixture postings with no network, no keys.
// `npm test`
process.env.DRY_RUN = '1';
delete process.env.ANTHROPIC_API_KEY;

import { run } from '../src/index.js';
import { makeJob, extractSalary } from '../src/util.js';
import { prefilter } from '../src/score.js';
import { criteria } from '../src/criteria.js';
import assert from 'node:assert/strict';

const fixtures = [
  makeJob({ source: 'test', external_id: 1, url: 'https://x/1', title: 'Medical Equipment Planner', company: 'HDR', location: 'Roseville, CA', description: 'Plan medical equipment for hospital projects. Salary $95,000 - $125,000.', ...extractSalary('$95,000 - $125,000') }),
  makeJob({ source: 'test', external_id: 2, url: 'https://x/2', title: 'Healthcare Architect', company: 'HGA', location: 'Sacramento, CA', description: 'Design hospital projects onsite in our Sacramento office.' }),
  makeJob({ source: 'test', external_id: 3, url: 'https://x/3', title: 'Medical Planner', company: 'Attainia', location: 'Remote', remote: true, description: 'Remote medical planner supporting clinical equipment planning for healthcare clients.' }),
  makeJob({ source: 'test', external_id: 4, url: 'https://x/4', title: 'Lab Planner', company: 'SmithGroup', location: 'Phoenix, AZ', description: 'Laboratory planning for healthcare and research clients. Onsite.' }),
  makeJob({ source: 'test', external_id: 5, url: 'https://x/5', title: 'Healthcare Project Manager', company: 'Kaiser', location: 'Folsom, CA', description: 'Manage hospital capital projects. Pay range $70,000 - $85,000.', ...extractSalary('$70,000 - $85,000') }),
  makeJob({ source: 'test', external_id: 6, url: 'https://x/6', title: 'Software Engineer', company: 'Acme', location: 'Rocklin, CA', description: 'Build medical software.' }),
];

// Unit checks
assert.deepEqual(extractSalary('Salary $95,000 - $125,000'), { salary_min: 95000, salary_max: 125000 });
assert.deepEqual(extractSalary('$48 - $60/hr'), { salary_min: 99840, salary_max: 124800 });
assert.deepEqual(extractSalary('$95K-$120K'), { salary_min: 95000, salary_max: 120000 });
assert.equal(prefilter(fixtures[0], criteria).keep, true);
assert.equal(prefilter(fixtures[3], criteria).keep, false, 'AZ onsite should be rejected');
assert.equal(prefilter(fixtures[4], criteria).keep, false, 'salary below floor should be rejected');
assert.equal(prefilter(fixtures[5], criteria).keep, false, 'software engineer should be rejected');

// Pipeline (keyword-only mode since no API key)
const r = await run({ sources: [async () => fixtures] });
assert.equal(r.raw, 6);
assert.equal(r.candidates, 3, 'expected 3 candidates through prefilter (1, 2, 3)');
console.log('\nOK', r);
