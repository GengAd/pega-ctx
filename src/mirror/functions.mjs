// .pega/functions.md: the functions the application's rules call, from raw/ alone, most used first.
// A call is `@Func(`, `@Lib.Func(` or `@(RuleSet:Lib).Func(`, nested calls included; `@` after a letter
// (an email) or without parentheses (`@baseclass`) is not one.
const MAX_EXAMPLES = 3;
const MAX_CALL = 160;

const START = /(?<![\w.@])@(?:\(([\w-]+:[\w-]+)\)\.([A-Za-z_]\w*)|([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?)\(/g;

// Every call in a text: [{ name: 'Lib.Func' | 'Func', call: '@Lib.Func(a, "b)")' }]. The call ends at its
// closing parenthesis, strings skipped; an unbalanced call is cut at MAX_CALL.
export function calls(text) {
  const found = [];
  for (const m of String(text).matchAll(START)) {
    const name = m[1] ? `${m[1].split(':')[1]}.${m[2]}` : m[4] ? `${m[3]}.${m[4]}` : m[3];
    found.push({ name, call: callText(text, m.index, m.index + m[0].length) });
  }
  return found;
}

function callText(text, start, open) {
  let depth = 1;
  let quote = null;
  let i = open;
  for (; i < text.length && depth > 0; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  const call = text.slice(start, i).replace(/\s+/g, ' ');
  return call.length > MAX_CALL ? `${call.slice(0, MAX_CALL)}…` : call;
}

// Every string of a decoded rule or draft.
export function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

// rules: [{ id, rule (decoded) }] → [{ name, usages, rules: [id], examples: [{ call, id }] }], most used first.
// The same call in several fields of a rule counts once.
export function collect(rules) {
  const byName = new Map();
  for (const { id, rule } of rules) {
    const seen = new Set();
    for (const s of strings(rule)) {
      for (const { name, call } of calls(s)) {
        if (seen.has(call)) continue;
        seen.add(call);
        const f = byName.get(name) ?? { name, usages: 0, rules: [], examples: [] };
        f.usages++;
        if (!f.rules.includes(id)) f.rules.push(id);
        if (f.examples.length < MAX_EXAMPLES && !f.examples.some((e) => e.call === call)) f.examples.push({ call, id });
        byName.set(name, f);
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.usages - a.usages || a.name.localeCompare(b.name));
}

export function renderFunctions(functions) {
  const rules = new Set(functions.flatMap((f) => f.rules)).size;
  const lines = [
    '# Functions the application calls',
    '',
    functions.length
      ? `${functions.length} functions called in ${rules} rules of the mirror, most used first. Reuse these first; for a function not listed here, ask the user.`
      : 'No rule of the mirror calls a function. Ask the user before calling one.',
  ];
  for (const f of functions) {
    lines.push('', `## @${f.name}`, '', `${f.usages} ${f.usages > 1 ? 'usages' : 'usage'} in ${f.rules.length} ${f.rules.length > 1 ? 'rules' : 'rule'}`);
    for (const e of f.examples) lines.push(`- \`${e.call}\` (${e.id})`);
  }
  return `${lines.join('\n')}\n`;
}

// The function names a functions.md lists.
export function listedNames(md = '') {
  return new Set([...md.matchAll(/^## @(\S+)$/gm)].map((m) => m[1]));
}
