#!/usr/bin/env node
// Quality scorecard of a measurement run (docs/measurement.md § What we measure: quality).
// Checks points 1 to 6 through the Pega MCP; 7 (conventions) and 8 (warnings reported) are scored by hand.
// Outside the pega-ctx CLI: only serves the measurement scenario.
//
//   node scripts/scorecard.mjs <BRANCH> [--since <ISO date>] [--class <Class>] [--model GetInfo] [--no-case] [--verbose] [--json]
//   node scripts/scorecard.mjs --case-only <Class> [--fields A,B,C]   (point 6 alone, on an existing case type)
//
// Run from the repository root: the server finds its OAuth session there.
// --since: start of the session (session-cost.mjs prints it); without it, point 5 is not checked.
// Point 6 creates a case in Pega; --no-case skips it.
// The scenario prompt is in French: the expected fields are Nom, Prénom, Motif (last name, first name, reason).
import { open } from '../src/mcp/client.mjs';
import { decodeToon } from '../src/mcp/toon.mjs';
import { TYPES, mirroredTypes } from '../src/mcp/tools.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);
const verbose = flag('--verbose');
const caseOnly = option('--case-only');
const branch = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.match(/^--(since|model|case-only|fields|class)$/));
if (!branch && !caseOnly) {
  console.error('usage: node scripts/scorecard.mjs <BRANCH> [--since <ISO date>] [--model GetInfo] [--no-case] [--verbose] [--json]');
  process.exit(1);
}
const since = option('--since');
const model = option('--model') ?? 'GetInfo';

const pega = await open();
const call = pega.call;
try {
  if (caseOnly) {
    const p6 = await caseRuns(caseOnly, (option('--fields') ?? 'Nom,Prenom,Motif').split(','));
    console.log(`6. ${mark(p6.ok)} ${p6.detail}`);
  } else {
    const result = await score();
    if (flag('--json')) console.log(JSON.stringify(result, null, 2));
    else show(result);
  }
} finally {
  await pega.close();
}

async function score() {
  const points = [];
  const app = decodeToon(await call('get-application', {}));
  const ref = (app.CaseTypes ?? []).find((c) => c.name === model);
  if (!ref) throw new Error(`model case type ${model} missing from get-application: pass --model`);
  const pool = ref.poolName;

  // 1. Case type in the branch, new class under the work pool.
  const classes = new Set();
  const caseTypesText = String(await call('list-casetypes', {}));
  for (const m of caseTypesText.matchAll(/id=([^,)\s]+)/g)) classes.add(m[1]);
  for (const c of app.CaseTypes ?? []) classes.add(c.implementationClass);
  const caseRows = await listClass('Rule-Obj-CaseType');
  for (const l of caseRows) classes.add(l.pyClassName);
  classes.delete(ref.implementationClass);
  // --class: the targeted class, when the branch holds several.
  if (option('--class')) for (const c of [...classes]) if (c !== option('--class')) classes.delete(c);

  let caseType = null;
  // The same class can have a case type in several branches: ours is kept.
  for (const cls of classes) {
    const rows = caseRows.filter((l) => l.pyClassName === cls);
    if (!rows.length) {
      caseType ??= { class: cls, raw: null, ruleset: undefined };
      continue;
    }
    for (const row of rows) {
      const raw = decodeToon(await call('get-rule', { key: row.pzInsKey, detail: 'full' }));
      const candidate = { class: cls, raw, ruleset: raw.pyRuleSet };
      if (!caseType || (inBranch(candidate.ruleset) && !inBranch(caseType.ruleset))) caseType = candidate;
    }
  }
  if (!caseType) {
    points.push({ n: 1, ok: false, detail: `no case type other than ${model} (list-casetypes, get-application, D_pxListRules)` });
    for (const n of [2, 3, 4, 6]) points.push({ n, ok: false, detail: 'no case type' });
    points.push(await outsideBranch());
    return { branch, points };
  }
  const underPool = caseType.class.startsWith(`${pool}-`);
  const branchOk = inBranch(caseType.ruleset);
  points.push({
    n: 1,
    ok: underPool && branchOk === true,
    detail: `${caseType.class}, ruleset ${caseType.ruleset ?? 'unknown (case type missing from D_pxListRules: are branch rules listed there?)'}${underPool ? '' : `, outside ${pool}-`}`,
  });

  // 2. Stages Saisie then Validation (entry then validation).
  if (caseType.raw) {
    const stages = items(caseType.raw.pyStages).map((s) => s.pyStageName);
    const iS = stages.findIndex((s) => norm(s).includes('saisie'));
    const iV = stages.findIndex((s) => norm(s).includes('validation'));
    points.push({ n: 2, ok: iS >= 0 && iV > iS, detail: `stages: ${stages.join(' → ') || 'none'}` });
  } else {
    points.push({ n: 2, ok: false, detail: 'unreadable case type raw rule' });
  }

  // 3. Three text properties on the case type's class.
  const props = await listClass('Rule-Obj-Property', { appliesToClass: caseType.class });
  const fields = { Nom: null, Prenom: null, Motif: null };
  for (const l of preferBranch(props)) {
    const kind = fieldKind(l.pyRuleName, l.pyLabel);
    if (kind && !fields[kind]) fields[kind] = l;
  }
  const details3 = [];
  let ok3 = true;
  for (const [kind, l] of Object.entries(fields)) {
    if (!l) {
      ok3 = false;
      details3.push(`${kind} missing`);
      continue;
    }
    const raw = decodeToon(await call('get-rule', { key: l.pzInsKey, detail: 'full' }));
    const isText = raw.pyPropertyMode === 'String' && raw.pyStringType === 'Text';
    const b = inBranch(l.pyRuleSet);
    ok3 &&= isText && b === true;
    details3.push(`${kind} = .${l.pyRuleName} (${raw.pyPropertyMode}/${raw.pyStringType ?? '?'}${b ? '' : `, ruleset ${l.pyRuleSet}`})`);
  }
  if (!props.length) details3.push(`no Property on ${caseType.class} through D_pxListRules`);
  points.push({ n: 3, ok: ok3, detail: details3.join('; ') });

  // 4. A view of the class shows the three fields.
  const names = Object.values(fields).filter(Boolean).map((l) => l.pyRuleName);
  const views = preferBranch(await listClass('Rule-UI-View', { appliesToClass: caseType.class }));
  let view = null;
  for (const v of views) {
    const t = String(await call('get-rule', { key: v.pzInsKey, detail: 'full' }));
    if (names.length === 3 && names.every((n) => t.includes(`@P .${n}`))) {
      view = v;
      break;
    }
  }
  points.push({
    n: 4,
    ok: Boolean(view),
    detail: view ? `view ${view.pyRuleName}` : `none of the ${views.length} views of ${caseType.class} shows ${names.map((n) => `.${n}`).join(', ') || 'the three fields'}`,
  });

  // 5. Nothing outside the branch.
  points.push(await outsideBranch());

  // 6. The case runs.
  if (flag('--no-case')) points.push({ n: 6, ok: null, detail: 'skipped (--no-case)' });
  else points.push({ n: 6, ...(await caseRuns(caseType.class, names.length === 3 ? names : ['Nom', 'Prenom', 'Motif'])) });

  return { branch, caseType: caseType.class, points };
}

// Rules of the application updated since --since, outside the branch.
// Limits: Rule-Obj-Class has no date in D_pxListRules, and a case type only has its creation date
// (suffix of the pzInsKey): an existing case type changed outside the branch is not seen.
async function outsideBranch() {
  if (!since) return { n: 5, ok: null, detail: 'not checked: pass --since <start of the session>' };
  const threshold = Date.parse(since);
  const faults = [];
  for (const cls of mirroredTypes().map((t) => TYPES[t])) {
    for (const l of await listClass(cls)) {
      const date = l.pxUpdateDateTime ? Date.parse(l.pxUpdateDateTime) : keyDate(l.pzInsKey);
      if (!(date >= threshold)) continue;
      let ruleset = l.pyRuleSet;
      if (ruleset === undefined) ruleset = decodeToon(await call('get-rule', { key: l.pzInsKey, detail: 'full' })).pyRuleSet;
      if (!inBranch(ruleset)) faults.push(`${cls} ${l.pyClassName} ${l.pyRuleName ?? l.pxInsName} (${ruleset})`);
    }
  }
  return { n: 5, ok: faults.length === 0, detail: faults.length ? faults.join('; ') : `nothing outside the branch since ${since}` };
}

// create-case, then the assignment, which must show the three fields.
// create-case returns caseID (case key, on the pool class: "OCHTID-TEST-WORK G-69001"),
// nextAssignmentID and nextAssignment.agentView.fields[].name (".FirstName"); get-assignment returns
// the same assignment, agentView included. Seen on the real server on 2026-10-11.
async function caseRuns(cls, names) {
  let rep;
  try {
    rep = decodeToon(await call('create-case', { caseTypeID: cls }));
  } catch (e) {
    return { ok: false, detail: `create-case refused: ${e.message}` };
  }
  if (verbose) console.error(`--- create-case\n${JSON.stringify(rep, null, 1)}`);
  const caseId = rep.caseID;
  let assignment = rep.nextAssignmentID;
  if (!assignment && caseId) {
    const a = String(await call('get-case-assignments', { pzInsKey: caseId }));
    if (verbose) console.error(`--- get-case-assignments\n${a}`);
    assignment = a.match(/ASSIGN-(?:WORKLIST|WORKBASKET) [^\s"!,]+ [^\s"!,]+![^\s",]+/)?.[0];
  }
  if (!assignment) return { ok: false, detail: `case ${caseId ?? 'created?'}, no assignment (run again with --verbose)` };
  const a = decodeToon(await call('get-assignment', { assignmentID: assignment }));
  if (verbose) console.error(`--- get-assignment\n${JSON.stringify(a, null, 1)}`);
  const shown = items(a.agentView?.fields).map((f) => String(f.name ?? '').replace(/^\./, ''));
  const missing = names.filter((n) => !shown.includes(n));
  return {
    ok: missing.length === 0,
    detail: `${caseId}, ${assignment}, fields shown: ${shown.join(', ') || 'none'}${missing.length ? `; missing: ${missing.join(', ')}` : ''}`,
  };
}

async function listClass(ruleTypeClass, filters = {}) {
  const rows = [];
  for (let page = 1; ; page++) {
    const rep = decodeToon(
      await call('run-data-page', {
        dataPage: 'D_pxListRules',
        dataPageType: 'list',
        payload: JSON.stringify({ dataViewParameters: { ruleTypeClass, pageNumber: page, pageSize: 500, ...filters } }),
      }),
    );
    rows.push(...(rep.data ?? []));
    if ((rep.data ?? []).length < 500) return rows;
  }
}

// A rule can have one row per ruleset (base and branch): keep the branch's.
function preferBranch(rows) {
  const byName = new Map();
  for (const l of rows) {
    const seen = byName.get(l.pyRuleName);
    if (!seen || (inBranch(l.pyRuleSet) && !inBranch(seen.pyRuleSet))) byName.set(l.pyRuleName, l);
  }
  return [...byName.values()];
}

// Pega branch ruleset: <ruleset>_Branch_<branch>.
function inBranch(ruleset) {
  if (ruleset === undefined || ruleset === null) return undefined;
  return new RegExp(`_Branch_${branch}$`, 'i').test(ruleset);
}

// The three fields of the French prompt, named in French or in English.
function fieldKind(name = '', label = '') {
  for (const t of [norm(name), norm(label)]) {
    if (/prenom|firstname/.test(t)) return 'Prenom';
    if (/motif|reason/.test(t)) return 'Motif';
    // Exact "nom": "Nombre de membres" (number of members) must not count.
    if (/^(nom|nomdefamille|nomfamille)$|lastname|surname|familyname/.test(t)) return 'Nom';
  }
  return null;
}

function keyDate(key = '') {
  const m = key.match(/#(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d+) GMT/);
  return m ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6], m[7]) : NaN;
}

function norm(s = '') {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function items(x) {
  if (Array.isArray(x)) return x;
  return x ? [x] : [];
}

function mark(ok) {
  return ok === true ? '✓' : ok === false ? '✗' : '?';
}

function show({ branch: b, caseType, points }) {
  console.log(`scorecard ${b}${caseType ? `: ${caseType}` : ''}`);
  for (const p of points.sort((x, y) => x.n - y.n)) console.log(`${p.n}. ${mark(p.ok)} ${p.detail}`);
  console.log('7. to score: GetInfo conventions (class, flow, view names; French labels)');
  console.log('8. to score: each create-rule / update-rule warning reported to the user');
  const total = points.filter((p) => p.ok === true).length;
  const p6 = points.find((p) => p.n === 6);
  console.log(`points 1-6: ${total}/6 (+ 7 and 8 by hand) | case runs: ${p6?.ok === true ? 'yes' : p6?.ok === false ? 'no' : '?'}`);
}
