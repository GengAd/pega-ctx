// pega-ctx create <Type> <Class> <Name> --from <id> [--patch <file.json>] [--rename A=B,C=D] [--fields P1,P2]
//   [--ruleset R:V] [--label T] [--branch B] [--reason R] [--dry-run | --draft]
// Template = the raw rule of --from without persistence, renamed, patch merged (an array replaces the array).
// --dry-run: the digest of what would be created; --json adds the content sent.
// --draft: the content written to .pega/drafts/, sent later as is by pega-ctx send. Otherwise create-rule then live.
// The write ruleset is resolved by src/mirror/write.mjs; unknown or ambiguous → code 1, the model asks the user.
import { readFileSync } from 'node:fs';
import { decodeToon } from '../mcp/toon.mjs';
import { mirror } from '../mirror/files.mjs';
import { refresh } from '../mirror/live.mjs';
import { resolver } from '../mirror/graph.mjs';
import { project } from '../projection/index.mjs';
import { isParentClass } from '../projection/common.mjs';
import { prepareCreation, COMPONENTS, PARAGRAPH } from './template.mjs';
import { findRule, render, shown, warnings, warningsText } from './common.mjs';
import { departures } from '../mirror/conventions.mjs';
import { header } from './live.mjs';
import { resolveWrite, unresolvedMessage } from '../mirror/write.mjs';
import { fitted, lintOf, writeDraft, draftFindingsText, refusal, keepOf } from './checked.mjs';
import { findingsText } from '../lint/lint.mjs';
import { TYPES } from '../mcp/tools.mjs';
import { isDroppedField, withoutPersistence } from '../projection/persistence.mjs';
import { isManual, cannotWrite, manualHeader, manualNote, changedPaths } from './manual.mjs';

export const help = 'pega-ctx create <Type> <Class> <Name> --from <id> [--patch <file.json>] [--rename A=B,C=D] [--fields P1,P2] [--ruleset R:V] [--label T] [--branch B] [--reason R] [--dry-run | --draft]';

export function readPatch(file, keep) {
  if (file === undefined) return {};
  if (typeof file !== 'string') throw new Error('--patch expects a JSON file: --patch patch.json');
  let patch;
  try {
    patch = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`unreadable patch (${file}: ${e.message}): give a JSON object`);
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error(`${file}: the patch is a JSON object, not ${Array.isArray(patch) ? 'an array' : typeof patch}`);
  // A view's content is a JSON string: accepted as an object, safer to write.
  if (patch.pxViewMetadata && typeof patch.pxViewMetadata === 'object') patch.pxViewMetadata = JSON.stringify(patch.pxViewMetadata);
  return checkFields(patch, file, 'the patch', { keep });
}

// Top-level keys of a patch or a draft's content: Pega fields only, none managed by Pega.
// A draft's content comes from a real rule, which holds fields in lower case (pyconfirmchoice on a
// FlowAction): only the prefix is checked there. A patch, written by the model, is held to pyName.
export function checkFields(o, file, what, { strict = true, keep } = {}) {
  // A key outside py*/px* is not a Pega field: the server would ignore it silently.
  const unknown = Object.keys(o).filter((k) => !(strict ? /^p[xyz][A-Z]/ : /^p[xyz]/).test(k));
  if (unknown.length) throw new Error(`${file}: not Pega fields (py…, px…): ${unknown.join(', ')}. The label: --label; the description: pyDescription`);
  const dropped = Object.keys(o).filter((k) => isDroppedField(k, true, keep));
  if (dropped.length) throw new Error(`${file}: fields managed by Pega, remove them from ${what}: ${dropped.join(', ')}`);
  return o;
}

// What a draft says next to its path: where it is, how to send it.
export function draftNote(root, file, id) {
  return `draft written: ${shown(root, file)} (to read: ${shown(root, file).replace(/\.json$/, '.md')})\nread the .md, correct the .json if needed, then: pega-ctx send ${id} --branch <ID>`;
}

// create-rule, then live on the new rule. Shared by create and send.
export async function sendCreate({ m, pega, config, options, id, type, cls, name, content, ruleset, branch, reason }) {
  const notes = warnings(await pega.create({ type, content, branch, description: reason.slice(0, 200), ruleset }));
  let r;
  try {
    r = await refresh(m, pega, { type, class: cls, name });
  } catch (e) {
    return { code: 0, output: `created in branch ${branch}, but not readable yet (${e.message}): pega-ctx live ${id} later\n${warningsText(notes)}` };
  }
  return render(options, { ...r, warnings: notes }, `created in branch ${branch}\n${warningsText(notes)}${header(r.state, config)}${r.digest.trimEnd()}`);
}

// --rename Old=New,Other=Fresh → [['Old', 'New'], ['Other', 'Fresh']].
export function readRenames(value) {
  if (value === undefined) return [];
  if (typeof value !== 'string') throw new Error('--rename expects Old=New[,Other=Fresh]');
  return value.split(',').map((pair) => {
    const [from, to, rest] = pair.split('=');
    if (!from || !to || rest !== undefined) throw new Error(`--rename: "${pair}" is not Old=New`);
    return [from.trim(), to.trim()];
  });
}

// --fields LastName,Notes:TextArea,Age:required (View): each property must be in the mirror, on the class
// or a parent; its type (pyStringType) picks the component, :TextArea (or a pxTextArea control) makes a
// Text property multi-line, :required makes the field required. A missing property is created first.
const FIELD_OPTIONS = ['TextArea', 'required'];
export function readFields(value, { class: cls, index, m }) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('--fields expects Property1,Property2:required,Notes:TextArea');
  return value.split(',').map((raw) => {
    const [name, ...opts] = raw.trim().split(':');
    const wrong = opts.filter((o) => !FIELD_OPTIONS.includes(o));
    if (wrong.length) throw new Error(`--fields: ${raw.trim()}: unknown option ${wrong.join(', ')}; after a property, :TextArea and :required`);
    const property = name.replace(/^\./, '');
    const line = index
      .filter((r) => r.type === 'Property' && r.name === property && isParentClass(r.class, cls))
      .sort((a, b) => b.class.length - a.class.length)[0];
    if (!line) throw new Error(`--fields: property ${property} missing from ${cls} and its parents in the mirror: pega-ctx create Property ${cls} ${property} --from … first`);
    const o = decodeToon(m.readRaw(line.id) ?? '');
    const kind = o.pyPropertyMode === 'String' ? o.pyStringType || 'Text' : o.pyPropertyMode;
    const component = COMPONENTS[kind];
    if (!component) throw new Error(`--fields: ${property} is of type ${kind}, which --fields cannot display (${Object.keys(COMPONENTS).join(', ')}): describe pyContent, pxViewMetadata and pxContextMetadata in the patch`);
    const paragraph = opts.includes('TextArea') || o.pyStreamName === 'pxTextArea';
    if (paragraph && kind !== 'Text') throw new Error(`--fields: ${property} is of type ${kind}: only a Text property can be a TextArea`);
    return { property, ...(paragraph ? PARAGRAPH : component), required: opts.includes('required') };
  });
}

// --from: `example[:name]` (stub by default) for a server example, otherwise a rule of the mirror.
// → { template, from, fromName, notes } or { refused }.
export function templateOf({ from, type, index, m, examples }) {
  const ex = /^example(?::(.+))?$/.exec(from);
  if (ex) {
    const name = ex[1] ?? 'stub';
    const e = examples.read(type, name);
    return { template: e.content, from: `example:${name}`, fromName: `example ${name}`, notes: e.notes };
  }
  const model = findRule(index, from, { type });
  if (model.type !== type) return { refused: `--from ${model.id} is a ${model.type}, not a ${type}: pick a sibling rule of the same type, or a server example (pega-ctx examples ${type})` };
  const raw = m.readRaw(model.id);
  if (raw === undefined) return { refused: `raw rule missing for ${model.id}: pega-ctx live ${model.id}` };
  return { template: decodeToon(raw), from: model.id, fromName: model.name };
}

// Digest of a rule that does not exist yet (or is not updated yet): same projection as sync.
export function plannedDigest(o, index, line = {}) {
  return project(o, { line: { by: '(to be written)', ...line }, index, resolve: resolver(index) }).markdown;
}

export async function run({ positionals, options, root, connect, schemas, examples }) {
  const [type, cls, name] = positionals;
  if (!type || !cls || !name) return { code: 1, output: `Type, Class and Name are required: ${help}` };
  if (typeof options.from !== 'string') return { code: 1, output: `--from <id> required: pick a sibling rule with pega-ctx search, or a server example (pega-ctx examples ${type}); the model never starts from scratch` };
  const m = mirror(root);
  const config = m.readConfig();
  const index = m.readIndex();
  const id = `${type}:${cls}:${name}`;
  if (index.some((r) => r.id === id)) return { code: 1, output: `${id} already exists: pega-ctx update ${id} --patch …` };
  // A type the Pega MCP cannot write: only a draft for Dev Studio, never create-rule.
  const manual = isManual(type);
  if (manual && !options.draft && !options['dry-run']) return { code: 1, output: `${cannotWrite(type)}: add --draft to write what a developer creates in Dev Studio, then pega-ctx live ${id}` };
  // The template: a sibling rule of the mirror, or an example of the server's skill for the type.
  const source = templateOf({ from: options.from, type, index, m, examples });
  if (source.refused) return { code: 1, output: source.refused };
  const { template, from, fromName, notes } = source;
  const keep = keepOf(schemas, type);

  const prepared = prepareCreation(template, {
    type,
    class: cls,
    name,
    label: typeof options.label === 'string' ? options.label : undefined,
    patch: readPatch(options.patch, keep),
    rename: readRenames(options.rename),
    fields: readFields(options.fields, { class: cls, index, m }),
    keep,
  });
  // The raw rule keeps numbers and booleans as strings; the server's schema wants them typed.
  const content = fitted(schemas, type, prepared);
  const findings = lintOf(schemas, { operation: 'create', type, content, m, id });
  // Write ruleset: --ruleset, the "write" table by class prefix, the sibling rules of the class. Never a guess.
  const write = resolveWrite({ class: cls, option: options.ruleset, table: config.write, index });
  if (!write.ruleset) return { code: 1, output: unresolvedMessage(cls, write) };
  const [rsName, rsVersion] = write.ruleset.split(':');
  const ruleset = rsName || undefined;

  // How the neighbours are named: warnings, never a refusal.
  const conventions = departures({ type, class: cls, name, label: content.pyLabel, labelGiven: typeof options.label === 'string', index });
  const conventionLines = conventions.map((c) => `\nconvention: ${c}`).join('');
  const branch = typeof options.branch === 'string' ? options.branch : config.branch;
  const reason = typeof options.reason === 'string' ? options.reason : `pega-ctx create ${name} from ${fromName}`;
  const exampleNotes = notes ? `\n\nnotes of the example (${from}):\n${notes}` : '';
  if (options['dry-run'] || options.draft) {
    const digest = plannedDigest({ ...content, pyRuleSet: ruleset ?? '?', pyRuleSetVersion: rsVersion ?? '(branch)' }, index);
    if (options['dry-run']) {
      return render(options, { payload: { type, ruleset, content }, write, conventions, digest, findings }, `dry-run: nothing is written to Pega\nruleset: ${write.ruleset} (${write.source})${conventionLines}\n\n${digest.trimEnd()}\n\n${findingsText(findings)}${exampleNotes}`);
    }
    const draft = { operation: 'create', id, type, ruleClass: TYPES[type], ruleset, write: `${write.ruleset} (${write.source})`, from, reason, ...(typeof options.branch === 'string' ? { branch } : {}) };
    if (manual) Object.assign(draft, manualHeader({ ...draft, cls, name, changed: changedPaths(withoutPersistence(template, true, keep), content) }));
    const file = writeDraft(m, schemas, draft, content, digest);
    const note = manual ? manualNote(shown(root, file), type) : draftNote(root, file, id);
    return render(options, { draft: file, header: draft, content, conventions, digest, findings }, `${note}\nruleset: ${write.ruleset} (${write.source})${conventionLines}\n\n${digest.trimEnd()}\n\n${draftFindingsText(file, findings)}${exampleNotes}`);
  }
  if (!branch) return { code: 1, output: '--branch <ID> required: create-rule always writes to a branch (or set branch in .pega/config.json)' };
  const refused = refusal(findings, options);
  if (refused) return refused;

  const pega = await connect();
  try {
    return await sendCreate({ m, pega, config, options, id, type, cls, name, content, ruleset, branch, reason });
  } finally {
    await pega.close();
  }
}
