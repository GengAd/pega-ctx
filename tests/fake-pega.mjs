// Fake Pega client serving the fixture: same interface as src/mcp/client.mjs (stack, list, read, cases, units,
// close). The tests change `rows` and `raws` to simulate a change in Pega.
import { raws as fixtureRaws, rows as fixtureRows, rowOf, read as readFile } from './fixture-helpers.mjs';

const CASE_ID = 'MONORG-TEST-WORK G-71001';

// As src/mcp/client.mjs throws it: the message cut, the full text in `text`.
function refusal(tool, text) {
  const e = new Error(`${tool}: ${text.slice(0, 300)}`);
  e.text = text;
  return e;
}

function firstAssignment(caseType) {
  return {
    assignmentID: `ASSIGN-WORKLIST ${CASE_ID}!GETINFOSTART`, name: 'CollectRequester', caseID: CASE_ID,
    actions: [{ id: 'CollectRequester', name: 'Requester', type: 'LocalAction' }, { id: 'CollectRequester', name: 'Requester', type: 'FlowAction' }],
    agentView: { fields: [{ name: '.FirstName', label: 'First name', type: 'TextInput' }, { name: '.LastName', label: 'Last name', type: 'TextInput' }, { name: '.Age', label: 'Age', type: 'Integer' }] },
    content: { caseTypeID: caseType, status: 'New', stageLabel: 'Requester', Requester: { classID: 'MONORG-Test-Data-People', FirstName: '', Age: '', LastName: '' } },
  };
}

// run-pegaunits per branch; the keys are the ones the server keeps (docs/mcp-tools.md).
const unitRuns = {
  TESTS1: {
    resultCount: 2, summary: { passed: 1, failed: 1, other: 0 },
    data: [
      { label: 'Age is required', result: 'Passed', ruleUnderTestType: 'Rule-Obj-Validate', elapsedTimeSeconds: 0.12, isInactive: false, pzInsKey: 'RULE-AUTOTEST-CASE A' },
      { label: 'Household size', result: 'Failed', ruleUnderTestType: 'Rule-Obj-Flow', elapsedTimeSeconds: 0.4, isInactive: false, pzInsKey: 'RULE-AUTOTEST-CASE B' },
    ],
  },
};

export function fakePega({ failures = [] } = {}) {
  const rows = fixtureRows.map((l) => ({ ...l }));
  const raws = new Map(fixtureRaws.map((r) => [rowOf(r).key, readFile(r)]));
  const calls = [];
  let context = null;
  return {
    rows,
    raws,
    calls,
    async stack() {
      calls.push(['stack']);
      return {
        application: 'Test', version: '01.01.01', rulesets: ['Test'], builtOn: [{ application: 'Constellation', version: '01.01' }], constellation: true,
        // As the real climb returns it (application rules, 2026-10-12), PegaRULES shortened.
        layers: [
          { application: 'Test', version: '01.01.01', rulesets: ['Test:01-01', 'MONORG:01-01'], builtOn: [{ application: 'Constellation', version: '01.01' }], organization: 'MONORG', classification: 'Standard' },
          { application: 'Constellation', version: '01.01', rulesets: ['Constellation:01-01'], builtOn: [{ application: 'PegaRULES', version: '8' }], organization: '', classification: 'Standard' },
          { application: 'PegaRULES', version: '8', rulesets: ['Pega-ProcessCommander:08-26', 'Pega-RULES:08-26'], builtOn: [], organization: '', classification: 'PegaPlatform' },
        ],
      };
    },
    // As on the real server (2026-10-12): the operator's applications; Gameboard opens with its alias.
    async applications() {
      calls.push(['applications']);
      return [
        { application: 'Test', version: '01.01.01', alias: 'test' },
        { application: 'PegaRULES', version: '8', alias: null },
        { application: 'Gameboard', version: '01.01.01', alias: 'gameboard' },
      ];
    },
    async alias(name) {
      calls.push(['alias', name ?? null]);
      context = name ?? null;
    },
    // Without an alias, every fixture row (the legacy tests filter by ruleset); under the gameboard
    // alias, the rows of Gameboard's rulesets only, as the real listing does.
    async list({ type }) {
      calls.push(['list', type, ...(context ? [context] : [])]);
      if (failures.includes(type)) throw new Error('500 Internal Server Error');
      const inContext = (r) => context !== 'gameboard' || ['Gameboard', 'Cvent'].includes(r.ruleset);
      return rows.filter((r) => r.type === type && inContext(r)).map((r) => ({ ...r }));
    },
    async read(key) {
      calls.push(['read', key]);
      if (!raws.has(key)) throw new Error(`unknown key: ${key}`);
      return raws.get(key);
    },
    // Writes: recorded, not applied (the fake cannot produce the TOON of a new rule).
    async create(request) {
      calls.push(['create', request]);
      // Like the real server: a warning even on success.
      return { status: 'created', warning: 'Rule write succeeded, but the completed branch summary was not updated.' };
    },
    async update(request) {
      calls.push(['update', request]);
      return { status: 'updated' };
    },
    // Cases and tests, shaped as the real server answers (GetInfo, 2026-10-13). A failure named in
    // `failures` ('create-case', 'perform-action', 'run-pegaunits') answers as Pega refuses.
    async createCase(caseType) {
      calls.push(['createCase', caseType]);
      if (failures.includes('create-case')) throw refusal('create-case', 'Error creating case: 400 Bad Request: "{\\"errorDetails\\":[{\\"message\\":\\"Error_Invalid_Inputs_caseTypeID\\"}]}"');
      const assignment = firstAssignment(caseType);
      if (failures.includes('no-next-assignment')) return { status: 'created', caseID: CASE_ID, caseTypeID: caseType };
      return { status: 'created', caseID: CASE_ID, caseTypeID: caseType, nextAssignmentID: assignment.assignmentID, nextAssignment: assignment };
    },
    async caseAssignment(caseID) {
      calls.push(['caseAssignment', caseID]);
      return `${CASE_ID.replace('MONORG-TEST-WORK', 'ASSIGN-WORKLIST MONORG-TEST-WORK')}!GETINFOSTART`;
    },
    async assignment(id) {
      calls.push(['assignment', id]);
      return { ...firstAssignment('MONORG-Test-Work-GetInfo'), assignmentID: id };
    },
    async performAction(request) {
      calls.push(['performAction', request]);
      if (failures.includes('perform-action')) throw refusal('perform-action', 'Error performing action: 400 Bad Request: "{\\"errorDetails\\":[{\\"message\\":\\"Error_Invalid_Inputs_content\\"}]}"\n[api: 900 ms | processing: 1 ms]');
      const id = `ASSIGN-WORKLIST ${CASE_ID}!COLLECTHOUSEHOLD`;
      return {
        status: 'action performed',
        nextAssignmentID: id,
        nextAssignment: {
          assignmentID: id, name: 'CollectHouseholdSize', caseID: CASE_ID,
          actions: [{ id: 'CollectHouseholdSize', name: 'Household', type: 'LocalAction' }, { id: 'CollectHouseholdSize', name: 'Household', type: 'FlowAction' }],
          agentView: { fields: [{ name: '.HouseholdMemberCount', label: 'Other people in the household', type: 'Integer', required: true }] },
        },
      };
    },
    async units(branch) {
      calls.push(['units', branch]);
      if (failures.includes('run-pegaunits')) throw refusal('run-pegaunits', 'Error running PegaUnit tests: 500 Internal Server Error: "No matching branch was found for the provided branch ID."');
      return unitRuns[branch] ?? { resultCount: 0, summary: { passed: 0, failed: 0, other: 0 }, data: [] };
    },
    async close() {},
  };
}
