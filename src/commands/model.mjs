// pega-ctx model <Class> [--depth 1]: the data model of a class in one page. Its own properties then the
// inherited ones along the chain the mirror sees (parents by name, then the Class rule's pyDerivesFrom,
// followed even outside the mirror), each with mode, page class, type, values, label and where it comes
// from; properties the rules cite but the mirror lacks; the data pages of the class and the views that
// show its properties. --depth goes down into the classes of Page and PageList properties.
import { mirror } from '../mirror/files.mjs';
import { incoming, inheritanceChain } from '../mirror/graph.mjs';
import { decodeToon } from '../mcp/toon.mjs';
import { items, filled } from '../projection/common.mjs';
import { appTag } from './search.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx model <Class> [--depth 1]';
export const LIMIT = 100;
const MAX_CHAIN = 20;

// The Class rule's directed parent, if the mirror has the rule.
function derivesFrom(m, index, cls) {
  const rule = index.find((r) => r.type === 'Class' && r.class === cls);
  const raw = rule && m.readRaw(rule.id);
  if (!raw) return undefined;
  const parent = decodeToon(raw).pyDerivesFrom;
  return filled(parent) ? parent : undefined;
}

// [{ class, how }] from the class itself to the farthest parent: parents by name first, then directed.
export function chainOf(m, index, cls) {
  const chain = [{ class: cls, how: 'the class' }];
  const seen = new Set([cls]);
  for (let i = 0; i < chain.length && chain.length < MAX_CHAIN; i++) {
    const c = chain[i].class;
    for (const p of inheritanceChain(index, c)) {
      if (!seen.has(p)) {
        seen.add(p);
        chain.push({ class: p, how: `by name, from ${c}` });
      }
    }
    const d = derivesFrom(m, index, c);
    if (d && !seen.has(d)) {
      seen.add(d);
      chain.push({ class: d, how: `directed, from ${c}${index.some((r) => r.class === d) ? '' : ', outside the mirror'}` });
    }
  }
  return chain;
}

function describe(m, line) {
  const raw = m.readRaw(line.id);
  const o = raw ? decodeToon(raw) : {};
  const values = items(o.pyPromptTableList).map((v) => v.pyStandardValue).filter(filled);
  return {
    name: line.name,
    class: line.class,
    id: line.id,
    mode: o.pyPropertyMode ?? '?',
    pageClass: /^Page/.test(o.pyPropertyMode ?? '') && filled(o.pyPageClass) ? o.pyPageClass : undefined,
    type: filled(o.pyStringType) ? o.pyStringType : undefined,
    values,
    label: line.description && line.description !== line.name ? line.description : undefined,
    rulesets: line.rulesets ?? [],
    application: line.application,
  };
}

// The properties a class reaches: closest class first, a property masking a farther one of the same name.
function properties(m, index, graph, chain) {
  const byName = new Map();
  const classes = chain.map((c) => c.class);
  const lines = index.filter((r) => r.type === 'Property' && classes.includes(r.class)).sort((a, b) => classes.indexOf(a.class) - classes.indexOf(b.class) || a.name.localeCompare(b.name));
  for (const l of lines) if (!byName.has(l.name.toLowerCase())) byName.set(l.name.toLowerCase(), describe(m, l));
  // Cited by a rule of the mirror on one of these classes, but not in the mirror.
  const known = new Set(index.map((r) => r.id));
  for (const e of graph.edges) {
    if (!e.to.startsWith('Property:') || known.has(e.to)) continue;
    const [, cls, name] = e.to.split(':');
    if (!classes.includes(cls) || byName.has(name.toLowerCase())) continue;
    byName.set(name.toLowerCase(), { name, class: cls, id: e.to, missing: true, citedBy: [...new Set(incoming(graph, e.to).map((x) => x.from))] });
  }
  return [...byName.values()];
}

function propertyLine(p) {
  if (p.missing) return `- .${p.name} — not in the mirror; cited by ${p.citedBy.join(', ')}`;
  const kind = [p.pageClass ? `${p.mode} of ${p.pageClass}` : p.mode, p.type].filter(Boolean).join(', ');
  const values = p.values.length ? ` — values ${p.values.join(', ')}` : '';
  const label = p.label ? ` — "${p.label}"` : '';
  return `- .${p.name} — ${kind}${values}${label} — ${appTag(p)}${p.rulesets.join(', ')}`;
}

function section(title, chain, props) {
  const lines = [title];
  for (const { class: cls, how } of chain) {
    const own = props.filter((p) => p.class === cls);
    if (!own.length) continue;
    lines.push('', cls === chain[0].class ? `own (${cls}):` : `inherited from ${cls} (${how}):`, ...own.map(propertyLine));
  }
  if (lines.length === 1) lines.push('', 'no property in the mirror');
  return lines;
}

export function run({ positionals, options, root }) {
  const cls = positionals[0];
  if (!cls) return { code: 1, output: `missing class: ${help}` };
  const depth = options.depth === undefined ? 1 : Number(options.depth);
  if (!Number.isInteger(depth) || depth < 0) return { code: 1, output: `--depth ${options.depth}: give 0, 1, 2…` };
  const m = mirror(root);
  m.readConfig();
  const index = m.readIndex();
  const graph = m.readGraph();
  if (!index.some((r) => r.class === cls) && !graph.edges.some((e) => e.to.split(':')[1] === cls)) {
    return { code: 1, output: `no rule of ${cls} in the mirror: pega-ctx search ${cls.split('-').at(-1)} --type Class, or pega-ctx sync` };
  }

  const chain = chainOf(m, index, cls);
  const props = properties(m, index, graph, chain);
  const lines = [`# Model of ${cls}`, '', `inheritance: ${chain.map((c, i) => (i ? `${c.class} (${c.how.split(',')[0]})` : c.class)).join(' → ')}`, '', ...section(`## Properties (${props.length})`, chain, props)];
  const result = { class: cls, chain, properties: props, embedded: [], dataPages: [], views: [] };

  // The classes of Page and PageList properties, depth by depth.
  let count = props.length;
  let level = props.filter((p) => p.pageClass);
  const visited = new Set([cls]);
  for (let d = 1; d <= depth && level.length; d++) {
    const next = [];
    for (const p of level) {
      if (visited.has(p.pageClass)) continue;
      visited.add(p.pageClass);
      const subChain = chainOf(m, index, p.pageClass);
      const sub = properties(m, index, graph, subChain);
      count += sub.length;
      if (count > LIMIT) {
        lines.push('', `… stopped beyond ${LIMIT} properties: pega-ctx model ${p.pageClass} on its own, or --depth ${d - 1}`);
        return render(options, result, lines.join('\n'));
      }
      result.embedded.push({ property: p.name, class: p.pageClass, properties: sub });
      lines.push('', ...section(`## .${p.name}: ${p.pageClass} (${sub.length})`, subChain, sub));
      next.push(...sub.filter((s) => s.pageClass));
    }
    level = next;
  }

  const classes = new Set([...chain.map((c) => c.class), ...result.embedded.map((e) => e.class)]);
  const dataPages = index.filter((r) => r.type === 'DataPage' && classes.has(r.class));
  result.dataPages = dataPages.map((r) => r.id);
  lines.push('', '## Data pages', ...(dataPages.length ? dataPages.map((r) => `- ${r.id}${r.description && r.description !== r.name ? ` — ${r.description}` : ''}`) : ['none in the mirror']));

  // Views of these classes, and views elsewhere that show their properties.
  const shown = new Map();
  const propertyIds = new Set([...props, ...result.embedded.flatMap((e) => e.properties)].map((p) => p.id));
  for (const e of graph.edges) {
    if (!e.from.startsWith('View:') || !propertyIds.has(e.to)) continue;
    shown.set(e.from, [...(shown.get(e.from) ?? []), `.${e.to.split(':')[2]}`]);
  }
  for (const r of index) if (r.type === 'View' && classes.has(r.class) && !shown.has(r.id)) shown.set(r.id, []);
  result.views = [...shown].map(([id, fields]) => ({ id, fields }));
  lines.push('', '## Views', ...(shown.size ? [...shown].sort((a, b) => a[0].localeCompare(b[0])).map(([id, fields]) => `- ${id}${fields.length ? ` — shows ${[...new Set(fields)].join(', ')}` : ''}`) : ['none in the mirror']));
  return render(options, result, lines.join('\n'));
}
