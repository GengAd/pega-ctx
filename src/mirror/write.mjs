// Where a new rule is written: the write ruleset depends on the class (a layercake has several
// applications and several rulesets each). Three sources, in order: --ruleset, the `write` table of
// .pega/config.json (first matching class prefix), the sibling rules of the same class in the mirror.
// No candidate, or several rulesets for the same class: no guess, the caller refuses and lists them.

// `Test_Branch_US42:01-01-01` → `Test`: a branch ruleset belongs to its base ruleset.
export const baseRuleset = (ruleset) => String(ruleset ?? '').split(':')[0].replace(/_Branch_.+$/, '');
const versionOf = (ruleset) => String(ruleset ?? '').split(':')[1] ?? '';
const higher = (a, b) => (String(b).localeCompare(String(a), 'en', { numeric: true }) > 0 ? b : a);

// A prefix ending with `-` covers every class starting with it; otherwise the class itself and its
// children by name (`MyOrg-App-Work-Claim` covers `MyOrg-App-Work-Claim-Sub`).
export function prefixMatches(prefix, cls) {
  if (!prefix || !cls) return false;
  return prefix.endsWith('-') ? cls.startsWith(prefix) : cls === prefix || cls.startsWith(`${prefix}-`);
}

// The rulesets seen in the index: name, highest version, number of rules, classes.
export function rulesetsSeen(index) {
  const seen = new Map();
  for (const r of index) {
    for (const rs of r.rulesets ?? []) {
      const name = baseRuleset(rs);
      if (!name) continue;
      const s = seen.get(name) ?? { name, version: '', rules: 0, classes: new Set() };
      s.version = higher(s.version, versionOf(rs));
      s.rules += 1;
      s.classes.add(r.class);
      seen.set(name, s);
    }
  }
  return [...seen.values()]
    .map((s) => ({ ...s, classes: [...s.classes].sort() }))
    .sort((a, b) => b.rules - a.rules || a.name.localeCompare(b.name));
}

const withVersion = (name, version) => (version ? `${name}:${version}` : name);

// Rulesets of the rules of exactly this class: [{ name, version, rules }].
function classRulesets(index, cls) {
  const byName = new Map();
  for (const r of index) {
    if (r.class !== cls) continue;
    for (const rs of r.rulesets ?? []) {
      const name = baseRuleset(rs);
      if (!name) continue;
      const s = byName.get(name) ?? { name, version: '', rules: 0 };
      s.version = higher(s.version, versionOf(rs));
      s.rules += 1;
      byName.set(name, s);
    }
  }
  return [...byName.values()].sort((a, b) => b.rules - a.rules || a.name.localeCompare(b.name));
}

// The write ruleset of a class. table: the `write` object of the config ({ byClass: [{ prefix, ruleset }], default }).
// Returns { ruleset, source } or { ruleset: undefined, candidates, reason: 'none' | 'ambiguous' }.
export function resolveWrite({ class: cls, option, table, index }) {
  if (typeof option === 'string' && option) return { ruleset: option, source: '--ruleset' };
  const entry = (table?.byClass ?? []).find((e) => prefixMatches(e.prefix, cls));
  if (entry?.ruleset) return { ruleset: entry.ruleset, source: `write table, prefix ${entry.prefix}` };
  const siblings = classRulesets(index, cls);
  if (siblings.length === 1) return { ruleset: withVersion(siblings[0].name, siblings[0].version), source: `sibling rules of ${cls}` };
  if (siblings.length > 1) {
    return { ruleset: undefined, reason: 'ambiguous', candidates: siblings.map((s) => `${withVersion(s.name, s.version)} (${s.rules} rules)`) };
  }
  if (table?.default) return { ruleset: table.default, source: 'write table, default' };
  return { ruleset: undefined, reason: 'none', candidates: rulesetsSeen(index).map((s) => withVersion(s.name, s.version)) };
}

// One line that says what to do when resolveWrite found nothing usable.
export function unresolvedMessage(cls, r) {
  if (r.reason === 'ambiguous') {
    return `several rulesets hold rules of ${cls}: ${r.candidates.join(', ')}. Ask the user which one, then pass --ruleset R:V or add the class to "write" in .pega/config.json`;
  }
  const seen = r.candidates.length ? ` (rulesets seen: ${r.candidates.join(', ')})` : '';
  return `no write ruleset known for ${cls}${seen}: ask the user, then pass --ruleset R:V or add a prefix to "write" in .pega/config.json (draft: .pega/write.draft.json)`;
}

// Draft of the `write` table from the index, for a human to keep, correct and complete.
// Each class with a single ruleset gets the most general prefix that covers only classes of that same
// ruleset in the mirror, two name segments at least (`MyOrg-App-`): an organization alone often spans
// several applications. Classes with several rulesets are listed apart, without an entry.
export function writeDraft(index) {
  const classes = [...new Set(index.map((r) => r.class).filter(Boolean))].sort();
  const single = new Map();
  const ambiguous = [];
  for (const cls of classes) {
    const rs = classRulesets(index, cls);
    if (rs.length === 1) single.set(cls, rs[0].name);
    else if (rs.length > 1) ambiguous.push({ class: cls, rulesets: rs.map((s) => `${withVersion(s.name, s.version)} (${s.rules} rules)`) });
  }
  const seen = new Map(rulesetsSeen(index).map((s) => [s.name, s]));
  const entries = new Map();
  for (const [cls, name] of single) {
    const parts = cls.split('-');
    const candidates = [];
    for (let i = Math.min(2, parts.length - 1); i < parts.length; i++) candidates.push(`${parts.slice(0, i).join('-')}-`);
    candidates.push(cls);
    const pure = (prefix) => classes.every((k) => !prefixMatches(prefix, k) || single.get(k) === name);
    const prefix = candidates.find((p) => p !== '-' && pure(p)) ?? cls;
    const e = entries.get(prefix) ?? { prefix, ruleset: withVersion(name, seen.get(name)?.version), rules: 0, classes: [] };
    e.classes.push(cls);
    e.rules += index.filter((r) => r.class === cls).length;
    entries.set(prefix, e);
  }
  // First match wins: the most specific prefixes first.
  const byClass = [...entries.values()].sort((a, b) => b.prefix.length - a.prefix.length || a.prefix.localeCompare(b.prefix));
  return { byClass, default: null, ambiguous };
}
