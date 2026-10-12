// View (Constellation): the pxViewMetadata tree, field by field, included views, reference lists.
// pxViewMetadata is a JSON string in the raw TOON. Fields read on the fixture (docs/projection.md).
import { filled, references } from './common.mjs';

// Config keys of no use to understand the view: rendering, inherited labels, display options.
const IGNORED = new Set(['inheritedProps', 'labelOption', 'targetClassLabelOption', 'ruleClass', 'classKeys', 'id']);

export function body(o) {
  const refs = references();
  const lines = [];
  let meta;
  try {
    meta = JSON.parse(o.pxViewMetadata ?? '');
  } catch {
    return { lines: ['', 'body: pxViewMetadata missing or unreadable'], references: [] };
  }
  if (filled(o.pyTemplateName)) lines.push('', `template: ${o.pyTemplateName}`);
  lines.push('', '## Content');
  for (const child of meta.children ?? []) node(child, 0, o.pyClassName, lines, refs);
  return { lines, references: refs.all() };
}

// `@P .Name` (property), `@L text` (literal label), `@FL .Name` (field label, redundant).
function text(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/^@(?:P|FL) /, '').replace(/^@L /, '');
}

function node(n, depth, cls, lines, refs) {
  const c = n.config ?? {};
  const indent = '  '.repeat(depth);
  const childClass = c.targetObjectClass ?? c.contextClass ?? cls;

  if (n.type === 'Region') {
    lines.push(`${indent}- region ${n.name}`);
  } else if (n.type === 'reference') {
    const target = c.ruleClass ?? cls;
    lines.push(`${indent}- view ${c.name}${target !== cls ? ` (${target})` : ''}${c.context ? ` on ${c.context}` : ''}`);
    refs.add('View', target, c.name, 'included view');
    refs.property(cls, c.context, 'context');
  } else if (typeof c.value === 'string' && c.value.startsWith('@P ')) {
    const marks = [n.type];
    if (c.required === true) marks.push('required');
    if (c.readOnly === true) marks.push('read-only');
    if (typeof c.label === 'string' && c.label.startsWith('@L ')) marks.push(`"${text(c.label)}"`);
    lines.push(`${indent}- ${text(c.value)}: ${marks.join(', ')}`);
    refs.property(cls, text(c.value), 'field');
  } else {
    // Composite component: its type and scalar settings, then its sub-components.
    const settings = Object.entries(c)
      .filter(([k, v]) => !IGNORED.has(k) && v !== '' && (typeof v !== 'object' || v === null) && !String(v).startsWith('@FL '))
      .map(([k, v]) => `${k} ${text(v)}`);
    lines.push(`${indent}- ${n.type ?? 'group'}${n.name && n.name !== n.type ? ` ${n.name}` : ''}${settings.length ? `: ${settings.join(', ')}` : ''}`);
    if (typeof c.referenceList === 'string' && /^D_\w+$/.test(c.referenceList)) {
      refs.add('DataPage', childClass, c.referenceList, 'list source');
    }
    if (typeof c.pagelistValue === 'string') refs.property(cls, text(c.pagelistValue), 'list');
  }

  for (const child of n.children ?? []) node(child, depth + 1, childClass, lines, refs);
  // Sub-components stored in the config (columns, presets, details): same nodes.
  for (const v of Object.values(c)) {
    if (!Array.isArray(v)) continue;
    for (const x of v) if (x && typeof x === 'object' && (x.type || x.children)) node(x, depth + 1, childClass, lines, refs);
  }
  if (c.rowHeader?.type) node(c.rowHeader, depth + 1, childClass, lines, refs);
}
