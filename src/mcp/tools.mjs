// Table from pega-ctx abstract operations to the real Pega MCP tools.
// Each choice is justified in docs/mcp-tools.md. Server responses are TOON.
import { decodeToon, cleanToon } from './toon.mjs';
import { WRITABLE } from './types.mjs';
import { shortName } from './names.mjs';

// Rule classes that D_pxListRules accepts but create-rule refuses (no schema in the Pega MCP):
// read, projected and followed by sync; never written. Each one checked on the server (docs/mcp-tools.md).
export const READ_ONLY = ['Rule-HTML-Section'];

// Writable classes outside the application (rulesets, branches): D_pxListRules returns the whole
// system for them and ignores paging. Written by create, never mirrored by sync.
export const NOT_MIRRORED = ['Rule-RuleSet-Name', 'Rule-RuleSet-Version', 'Rule-RuleSet-Branch'];

// pega-ctx short type → Pega rule class (pxObjClass): the classes create-rule accepts
// (src/mcp/types.mjs, generated from the server's schemas), then the read-only ones.
// addTypes() adds the classes a project follows on top (`types` in .pega/config.json).
export const TYPES = Object.fromEntries([...WRITABLE.map((w) => [w.type, w.ruleClass]), ...READ_ONLY.map((c) => [shortName(c), c])]);

export function addTypes(classes = []) {
  for (const cls of classes) {
    if (!/^Rule-[\w-]+$/.test(cls)) throw new Error(`.pega/config.json: "${cls}" in types is not a Pega rule class (Rule-…)`);
    if (!Object.values(TYPES).includes(cls)) TYPES[shortName(cls)] = cls;
  }
}

// The writable entry of a type (key fields, skill, schema), undefined if create-rule refuses its class.
export function writable(type) {
  return WRITABLE.find((w) => w.type === type);
}

// Types sync lists: every known type except the classes outside the application.
export function mirroredTypes() {
  return Object.keys(TYPES).filter((t) => !NOT_MIRRORED.includes(TYPES[t]));
}

const PAGE_SIZE = 500;

export function classOfType(type) {
  const cls = TYPES[type];
  if (!cls) throw new Error(`unknown type: ${type}. Known types: ${Object.keys(TYPES).sort().join(', ')}; any other rule class goes in "types" of .pega/config.json`);
  return cls;
}

// stack() → get-application: current application, its ruleset, its direct built-on applications;
// then the climb: get-rule on each application rule (Rule-Application), which reads applications
// get-application refuses (Constellation), depth first in the order of pyDependsOnList.
// layers: [{ application, version, rulesets: ['Name:01-01', …] in resolution order, builtOn, error? }].
export async function stack(call) {
  const app = decodeToon(await call('get-application', {}));
  const layers = [];
  const seen = new Set();
  const climb = async (application, version) => {
    const key = `RULE-APPLICATION ${application.toUpperCase()} ${version}`;
    if (seen.has(key)) return;
    seen.add(key);
    const layer = { application, version, rulesets: [], builtOn: [] };
    layers.push(layer);
    let rule;
    try {
      rule = decodeToon(await call('get-rule', { key, detail: 'full' }));
    } catch (e) {
      layer.error = firstLine(e.text ?? e.message);
      return;
    }
    layer.rulesets = (rule.pyRuleSetList ?? []).filter((r) => typeof r === 'string' && r);
    // Empty for the applications Pega ships (Constellation, PegaRULES), which PegaRULES also classifies PegaPlatform.
    layer.organization = rule.pyOwningOrganization ?? '';
    layer.classification = rule.pyLayerClassification ?? '';
    layer.builtOn = (rule.pyDependsOnList ?? []).filter((d) => d?.pyAppName).map((d) => ({ application: d.pyAppName, version: String(d.pyAppVersion ?? '') }));
    for (const b of layer.builtOn) await climb(b.application, b.version);
  };
  await climb(app.AppName, String(app.AppVersion));
  return {
    application: app.AppName,
    version: String(app.AppVersion),
    rulesets: [app.RuleSet].filter(Boolean),
    builtOn: (app.DependsOn ?? []).map((d) => ({ application: d.name, version: String(d.version) })),
    constellation: app.IsConstellationApp === 'true',
    layers,
  };
}

// An application shipped by Pega, not the project's: no owning organization, or classified PegaPlatform.
export function shippedByPega(layer) {
  return !layer.error && (!layer.organization || layer.classification === 'PegaPlatform');
}

// applications() → list-available-applications: the operator's applications, with the alias that opens
// another application's context (null when it is not switchable).
export async function applications(call) {
  const r = decodeToon(await call('list-available-applications', {}));
  return (r.availableApplications ?? []).map((a) => ({
    application: a.applicationName,
    version: String(a.applicationVersion),
    alias: a.switchable === true || a.switchable === 'true' ? a.applicationAlias : null,
  }));
}

// alias(name) → set-application-alias: the next calls run in that application's context; alias(null) goes back.
export async function alias(call, name) {
  await call(name ? 'set-application-alias' : 'clear-application-alias', name ? { alias: name } : {});
}

function firstLine(text = '') {
  const m = /pzErrorRuleNotFound(?:\\t|\t)([^"\\]+)/.exec(text);
  return m ? `no rule ${m[1]}` : String(text).split('\n')[0].slice(0, 200);
}

// list({ type, class?, name?, application? }) → run-data-page D_pxListRules, one rule class per call.
// Only path that returns pxUpdateDateTime; no filter by date or ruleset: the comparison is done by pega-ctx.
export async function list(call, { type, class: cls, name, application } = {}) {
  const ruleTypeClass = classOfType(type);
  const rules = [];
  let previousFirst;
  for (let page = 1; ; page++) {
    const params = { ruleTypeClass, pageNumber: page, pageSize: PAGE_SIZE };
    if (cls) params.appliesToClass = cls;
    if (name) params.ruleName = name;
    if (application) params.applicationNames = application;
    const rep = decodeToon(
      await call('run-data-page', {
        dataPage: 'D_pxListRules',
        dataPageType: 'list',
        payload: JSON.stringify({ dataViewParameters: params }),
      }),
    );
    const rows = rep.data ?? [];
    // Some classes ignore paging: the same page comes back, the listing is already complete.
    if (page > 1 && rows[0]?.pzInsKey === previousFirst) return rules;
    previousFirst = rows[0]?.pzInsKey;
    rules.push(...rows.map((l) => rowToRule(type, l)));
    if (rows.length < PAGE_SIZE) return rules;
  }
}

function rowToRule(type, l) {
  return {
    id: `${type}:${l.pyClassName}:${l.pyRuleName ?? nameFromInsName(l.pxInsName)}`,
    key: l.pzInsKey,
    type,
    class: l.pyClassName,
    name: l.pyRuleName ?? nameFromInsName(l.pxInsName),
    ruleset: l.pyRuleSet,
    version: l.pyRuleSetVersion === undefined ? undefined : String(l.pyRuleSetVersion),
    description: l.pyLabel ?? '',
    available: l.pyRuleAvailable,
    updated: l.pxUpdateDateTime,
    by: l.pxUpdateOperator,
  };
}

// CaseType: the listing has no pyRuleName, only pxInsName in upper case (CLASS!NAME).
// The real name is in the raw rule (pyRuleName): sync fixes it after read().
function nameFromInsName(insName = '') {
  return insName.split('!').at(-1);
}

// read(key) → get-rule detail=full. Returns the TOON as is (cleaned): that is what raw/ stores,
// the projection decodes it with decodeToon. The key is the pzInsKey returned by list().
// The raw rule holds no date: the update date comes from list().
export async function read(call, key) {
  return cleanToon(await call('get-rule', { key, detail: 'full' }));
}

// create({ type, content, branch, description, ruleset? }) → create-rule. The server requires a branch.
export async function create(call, { type, content, branch, description, ruleset }) {
  const body = { pxObjClass: classOfType(type), ...content };
  const args = { ruleType: classOfType(type), branchID: branch, changeDescription: description };
  if (ruleset) args.ruleSet = ruleset;
  return decodeToon(await withTypesFixed((c) => call('create-rule', { ...args, content: JSON.stringify(c) }), body));
}

// The raw TOON keeps as a string what Pega stores as a string ("10"); the server schema sometimes wants
// a number or a boolean and refuses before Pega ("/pyInitialCaseUrgency: string found, integer expected").
// The named fields are converted and the request is retried once.
export async function withTypesFixed(send, body) {
  try {
    return await send(body);
  } catch (e) {
    const fixes = fieldsToConvert(e.text ?? e.message);
    if (!fixes.length) throw e;
    const fixed = structuredClone(body);
    for (const { path, type } of fixes) convert(fixed, path, type);
    return send(fixed);
  }
}

// The server answers in the operator's locale: the French wording is matched as well as the English one.
export function fieldsToConvert(text = '') {
  const pattern = /^\s*-\s*(\/\S+):\s*(?:string trouvé, (integer|number|boolean) attendu|.*string.*?(integer|number|boolean) (?:expected|attendu))/gm;
  return [...text.matchAll(pattern)].map((m) => ({ path: m[1], type: m[2] ?? m[3] }));
}

function convert(o, path, type) {
  const parts = path.split('/').slice(1).map((p) => p.replaceAll('~1', '/').replaceAll('~0', '~'));
  const last = parts.pop();
  let parent = o;
  for (const p of parts) parent = parent?.[p];
  if (!parent || typeof parent[last] !== 'string') return;
  const v = parent[last];
  if (type === 'boolean') parent[last] = v === 'true';
  else if (v !== '' && !Number.isNaN(Number(v))) parent[last] = Number(v);
}

// update({ key, patch, branch, description }) → update-rule.
// listUpdateMode 'replace': an array in the patch replaces the whole array (pega-ctx.md § create).
export async function update(call, { key, patch, branch, description }) {
  const args = { key, branchID: branch, changeDescription: description, listUpdateMode: 'replace' };
  return decodeToon(await withTypesFixed((p) => call('update-rule', { ...args, updates: JSON.stringify(p) }), patch));
}

// createCase(caseType) → create-case with caseTypeID alone. The `content` parameter sets fields at
// creation, but Pega only takes there the fields of the case type's create view: any other answers
// "Error_Invalid_Inputs_content" (2026-10-13). Field values go to the first assignment (performAction).
// Returns { caseID, nextAssignmentID?, nextAssignment?, content? }.
export async function createCase(call, caseType) {
  return decodeToon(await call('create-case', { caseTypeID: caseType }));
}

// assignment(id) → get-assignment: { assignmentID, name, actions[], agentView.fields[], content }.
export async function assignment(call, id) {
  return decodeToon(await call('get-assignment', { assignmentID: id }));
}

// caseAssignment(caseID) → get-case-assignments: the first open assignment's key, null if none.
// The answer is not decoded: only the key is read in it, as scripts/scorecard.mjs does.
export async function caseAssignment(call, caseID) {
  const text = String(await call('get-case-assignments', { pzInsKey: caseID }));
  return text.match(/ASSIGN-(?:WORKLIST|WORKBASKET) [^\s"!,]+ [^\s"!,]+![^\s",]+/)?.[0] ?? null;
}

// performAction({ assignment, action, content }) → perform-action: sets the fields (content, nested
// for an embedded page: { Requester: { FirstName } }) and submits. Returns { nextAssignmentID?, nextAssignment? }.
export async function performAction(call, { assignment: id, action, content }) {
  const args = { assignmentID: id, actionID: action };
  if (content && Object.keys(content).length) args.content = JSON.stringify(content);
  return decodeToon(await call('perform-action', args));
}

// units(branch) → run-pegaunits: { resultCount, summary: { passed, failed, other }, data: [{ label,
// result, ruleUnderTestType, elapsedTimeSeconds, isInactive, pzInsKey… }] }. Pega refuses an unknown branch.
export async function units(call, branch) {
  return decodeToon(await call('run-pegaunits', { branchID: branch }));
}
