// Edit this file to change what "a match" means. No code changes needed elsewhere.

export const criteria = {
  // Home base for distance/commute judgments
  home: 'Rocklin, CA',

  // On-site / hybrid is acceptable ONLY in these places.
  // Sacramento proper is deliberately excluded (no commute downtown).
  acceptableOnsiteCities: ['Rocklin', 'Roseville', 'Auburn', 'Folsom', 'Loomis', 'Lincoln', 'Granite Bay', 'El Dorado Hills'],

  // Remote is fine as long as the employer allows California residents.
  remoteOk: true,

  // Skip a posting if its stated salary MAX is below this. Keep it if no salary is posted.
  salaryFloor: 90000,

  // Role families she said yes to. Used both for search queries and for Claude's judgment.
  targetRoles: [
    'medical equipment planner',
    'medical planner',
    'clinical planner',
    'healthcare planner',
    'healthcare architect',
    'healthcare designer',
    'healthcare facility planner',
    'lab planner',
    'imaging planner',
    'radiology planner',
    'surgical suite planner',
    'pharmacy planner',
    'healthcare project manager',
    "owner's representative healthcare",
    'hospital space planner',
    'hospital facilities planner',
    'clinical applications specialist',
    'clinical specialist medical equipment',
  ],

  // Role families she said NO to. Claude will reject these even if titles overlap.
  excludedRoles: [
    'transition / activation planner',
    'healthcare technology / IT / low-voltage planner',
    'healthcare interior designer',
    'capital equipment procurement / value analysis / supply chain',
    'clinical engineering / biomedical technician',
    'strategy / master planning consultant',
    'lean / process improvement consultant',
    'HCAI plan reviewer / compliance / inspector of record',
    'seismic compliance',
    'nursing, clinical care, or bedside roles',
    'sales quota-carrying roles',
  ],

  // Search terms sent to job APIs (Adzuna, JSearch). Keep short; APIs match loosely.
  searchQueries: [
    'medical equipment planner',
    'medical planner',
    'healthcare planner',
    'healthcare architect',
    'healthcare designer',
    'lab planner',
    'imaging planner',
    'healthcare project manager',
    'hospital space planner',
    'clinical applications specialist',
  ],

  // Geographic scopes for API searches. Remote CA jobs often list "California" or a big city.
  searchLocations: ['Roseville, CA', 'Folsom, CA', 'Sacramento, CA', 'California'],

  // Minimum Claude fit score (0-100) to include in the digest
  minScore: 70,

  // Employers to poll directly (Workday tenants). Failures are logged, not fatal.
  // Find a tenant by opening a company's careers page and looking at the URL:
  //   https://<tenant>.<wd>.myworkdayjobs.com/<site>
  // Not on Workday (covered by Adzuna/JSearch instead): HDR (Taleo), Jacobs (careers.jacobs.com),
  // CommonSpirit (iCIMS), Kaiser (own site), UC Davis Health (own site).
  workdayTenants: [
    { company: 'Sutter Health', tenant: 'sutterhealth', wd: 'wd1', site: 'SH' },            // verified
    { company: 'Stryker', tenant: 'stryker', wd: 'wd1', site: 'StrykerCareers' },           // verified
    { company: 'Philips', tenant: 'philips', wd: 'wd3', site: 'jobs-and-careers' },          // unverified
  ],

  // Greenhouse / Lever board tokens for smaller firms that use them (add as you find them)
  greenhouseBoards: [],
  leverCompanies: [],
};
