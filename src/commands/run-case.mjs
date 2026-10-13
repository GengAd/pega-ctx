// pega-ctx run-case <CaseType | Class> [--fields A=1,Page.B=2] [--action ID]: creates a case in Pega
// and shows its first assignment and fields. With --fields, fills that assignment and submits it,
// then shows the next one. Pega's refusal is shown as is. Run it after a send on a case type or a flow.
import { mirror } from '../mirror/files.mjs';
import { render, listOption } from './common.mjs';

export const help = 'pega-ctx run-case <CaseType | Class> [--fields A=1,Page.B=2] [--action ID]';

// The case type's class: a name from the mirror (CaseType rule), otherwise the class as given.
export function caseClass(index, request) {
  if (!request) throw new Error(`missing case type: ${help}`);
  if (request.includes('-')) return request;
  const found = index.filter((r) => r.type === 'CaseType' && r.name === request);
  if (found.length === 1) return found[0].class;
  if (found.length > 1) throw new Error(`several case types named ${request}: give the class among ${found.map((r) => r.class).join(', ')}`);
  throw new Error(`unknown case type: ${request}. Give its class (pega-ctx search ${request} --type CaseType)`);
}

// `A=1,Page.B=2` → [{ path: ['A'], value: '1' }, …]. A bare name the assignment shows inside a single
// embedded page of the case (Requester.FirstName for .FirstName) goes into that page.
export function fieldValues(text, content = {}) {
  return listOption(text).map((pair) => {
    const [name, value = ''] = pair.split(/=(.*)/s, 2);
    if (name.includes('.')) return { path: name.split('.'), value };
    if (name in content) return { path: [name], value };
    const pages = Object.keys(content).filter((k) => isPage(content[k]) && name in content[k]);
    return { path: pages.length === 1 ? [pages[0], name] : [name], value };
  });
}

const isPage = (v) => v && typeof v === 'object' && !Array.isArray(v);
const NUMBERS = ['Integer', 'Decimal', 'Currency', 'Percentage'];

// The content perform-action sends: nested pages, numbers and booleans typed after the assignment's fields.
export function actionContent(values, fields = []) {
  const content = {};
  for (const { path, value } of values) {
    const type = fields.find((f) => f.name === `.${path.at(-1)}`)?.type;
    let typed = value;
    if (NUMBERS.includes(type) && value !== '' && !Number.isNaN(Number(value))) typed = Number(value);
    else if (type === 'Checkbox' && ['true', 'false'].includes(value)) typed = value === 'true';
    let page = content;
    for (const p of path.slice(0, -1)) page = page[p] ??= {};
    page[path.at(-1)] = typed;
  }
  return content;
}

// { Requester: { Age: 36 } } → ['Requester.Age=36'].
const flat = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (isPage(v) ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}=${v}`]));

// Pega's answer without the timing line the server adds.
export const pegaText = (e) => String(e.text ?? e.message).replace(/\n?\[api: [^\]]*\]\s*$/, '').replace(/\s*\n\s*/g, ' ').trim();

function assignmentLines(a) {
  const lines = [`assignment ${a.name ?? '?'} — ${a.assignmentID}`];
  const actions = (a.actions ?? []).filter((x) => x.type === 'FlowAction').map((x) => x.id);
  if (actions.length) lines.push(`  actions: ${actions.join(', ')}`);
  const fields = a.agentView?.fields ?? [];
  if (!fields.length) lines.push('  no field');
  for (const f of fields) lines.push(`  ${f.name}  ${f.label ?? ''}  ${f.type ?? ''}${f.required === true || f.required === 'true' ? '  required' : ''}`.trimEnd());
  return lines;
}

// The first assignment: the one create-case returns, otherwise the case's first open assignment.
async function firstAssignment(pega, created) {
  if (created.nextAssignment?.assignmentID) return created.nextAssignment;
  const id = created.nextAssignmentID ?? (created.caseID ? await pega.caseAssignment(created.caseID) : null);
  return id ? pega.assignment(id) : null;
}

export async function run({ positionals, options, root, connect }) {
  const m = mirror(root);
  const cls = caseClass(m.exists() ? m.readIndex() : [], positionals[0]);
  const pega = await connect();
  const result = { caseType: cls };
  const lines = [];
  const done = (code) => ({ ...render(options, result, lines.join('\n')), code });
  try {
    let created;
    try {
      created = await pega.createCase(cls);
    } catch (e) {
      result.error = pegaText(e);
      lines.push(`Pega refused create-case on ${cls}: ${result.error}`);
      return done(1);
    }
    const content = created.nextAssignment?.content ?? created.content ?? {};
    result.caseID = created.caseID;
    lines.push(`case ${created.caseID}${content.stageLabel ? `, stage ${content.stageLabel}` : ''}${content.status ? `, status ${content.status}` : ''}`);
    const first = await firstAssignment(pega, created);
    result.assignment = first;
    if (!first) {
      lines.push('no assignment: the case stops without waiting for anyone');
      return done(0);
    }
    lines.push(...assignmentLines(first));
    if (typeof options.fields !== 'string') return done(0);

    const action = typeof options.action === 'string' ? options.action : (first.actions ?? []).find((x) => x.type === 'FlowAction')?.id;
    if (!action) {
      lines.push(`no flow action on ${first.name}: give one with --action`);
      return done(1);
    }
    const sent = actionContent(fieldValues(options.fields, first.content ?? content), first.agentView?.fields);
    result.submitted = { action, content: sent };
    let after;
    try {
      after = await pega.performAction({ assignment: first.assignmentID, action, content: sent });
    } catch (e) {
      result.error = pegaText(e);
      lines.push('', `Pega refused ${action}: ${result.error}`);
      return done(1);
    }
    lines.push('', `submitted ${action}: ${flat(sent).join(', ')}`);
    result.next = after.nextAssignment ?? null;
    if (after.nextAssignment?.assignmentID) lines.push(...assignmentLines(after.nextAssignment));
    else lines.push(`no next assignment${after.nextAssignmentID ? ` (${after.nextAssignmentID}, details not returned)` : ''}`);
    return done(0);
  } finally {
    await pega.close();
  }
}
