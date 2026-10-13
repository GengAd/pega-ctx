// .pega/conventions.md: how the application names its rules, observed in the index alone, per class
// prefix (Org-App-), and the warnings `create` gives for a new rule that departs from it. Never a refusal.
const SHARE = 0.75; // a convention: three quarters of the rules that can be decided
const MIN = 3; // fewer decided rules: no convention

// Short lists: enough to decide most names and labels; a word of both languages decides nothing.
const EN = new Set('add address amount approve approval account age apply assign build case cancel check child collect confirm count create customer data date delete detail details document edit editor email enter first for get household id ignored individual info information is item items last list member members name new number of order person people phone picker player price process product query reason references registration reject report request review save scene score scores search select send set setting settings size start status submit table task title to total update user validate value view with'.split(' '));
const FR = new Set('adresse ajouter autre autres client commande compte confirmer créer de des demande détail détails du enregistrer et foyer informations la le les liste membre membres modifier montant nom nombre personne personnes pour prénom prenom répondant saisie saisir statut supprimer taille titre valider vérifier'.split(' '));
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ]/i;

// "CollectHouseholdSize" → ['collect', 'household', 'size']; labels split on spaces and punctuation.
export function words(text = '') {
  return String(text)
    .replace(/^D_/, '')
    .replace(/([a-zà-ÿ0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-zÀ-ÿ0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

// 'en', 'fr' or null (cannot be decided).
export function language(text = '') {
  if (ACCENT.test(text)) return 'fr';
  let en = 0;
  let fr = 0;
  for (const w of words(text)) {
    const e = EN.has(w);
    const f = FR.has(w);
    if (e && !f) en++;
    if (f && !e) fr++;
  }
  return en > fr ? 'en' : fr > en ? 'fr' : null;
}

export function casing(name = '') {
  const n = name.replace(/^D_/, '');
  if (/\s/.test(n)) return 'with spaces';
  if (n.includes('_')) return 'snake_case';
  if (/^[A-Z][A-Za-z0-9]*$/.test(n)) return 'PascalCase';
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(n)) return 'camelCase';
  return 'other';
}

const LANGUAGES = { en: 'English', fr: 'French' };

// The value three quarters of the decided items share, 'mixed' otherwise, null if too few are decided.
function majority(values) {
  const decided = values.filter(Boolean);
  if (decided.length < MIN) return null;
  const counts = new Map();
  for (const v of decided) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { value: n / decided.length >= SHARE ? top : 'mixed', n, of: decided.length };
}

// Pega's own names (pyDefault, pxView…) and a class rule named after its class say nothing of the project.
const ownName = (r) => !/^p[xyz][A-Z]/.test(r.name) && r.name !== r.class;
export const prefixOf = (cls = '') => {
  const parts = cls.split('-');
  return parts.length >= 3 ? `${parts.slice(0, 2).join('-')}-` : null;
};

// index → [{ prefix, rules, names, labels, casing, firstWords, viewsLikeFlowActions, onClass, classes }], biggest first.
export function observe(index) {
  const groups = new Map();
  for (const r of index) {
    const prefix = prefixOf(r.class);
    if (!prefix) continue;
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(r);
  }
  const result = [];
  for (const [prefix, rules] of groups) {
    const named = rules.filter(ownName);
    // A label equal to the name is the technical name, not a label.
    const labelled = rules.filter((r) => r.description && r.description !== r.name);
    const first = new Map();
    for (const r of named) {
      const w = r.name.replace(/^D_/, '').match(/^[A-Z]?[a-z0-9]+/)?.[0];
      if (w) first.set(w, [...new Set([...(first.get(w) ?? []), r.name])]);
    }
    const flowActions = rules.filter((r) => r.type === 'FlowAction');
    const views = new Set(rules.filter((r) => r.type === 'View').map((r) => `${r.class}:${r.name}`));
    const onClass = named.filter((r) => {
      const last = r.class.split('-').at(-1);
      return last.length > 2 && r.name.startsWith(last) && r.name !== last;
    });
    result.push({
      prefix,
      rules: rules.length,
      names: majority(named.map((r) => language(r.name))),
      labels: majority(labelled.map((r) => language(r.description))),
      casing: majority(named.map((r) => casing(r.name))),
      firstWords: [...first].filter(([, n]) => n.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 5),
      viewsLikeFlowActions: flowActions.length ? { n: flowActions.filter((f) => views.has(`${f.class}:${f.name}`)).length, of: flowActions.length } : null,
      onClass: onClass.map((r) => r.name).slice(0, 5),
      classes: [...new Set(rules.map((r) => r.class))].sort(),
    });
  }
  return result.sort((a, b) => b.rules - a.rules || a.prefix.localeCompare(b.prefix));
}

const said = (m, what) => {
  if (!m) return `${what}: too few rules to tell`;
  if (m.value === 'mixed') return `${what}: mixed (no value in three quarters of ${m.of} rules)`;
  return `${what}: ${LANGUAGES[m.value] ?? m.value} (${m.n} of ${m.of})`;
};

export function renderConventions(groups) {
  const lines = [
    '# Naming conventions',
    '',
    'Observed in the mirror by pega-ctx sync, per class prefix, largest first. Name a new rule as its neighbours are named; `pega-ctx create` warns when a name or a label departs from this.',
  ];
  for (const g of groups) {
    lines.push('', `## ${g.prefix} (${g.rules} rules)`, '');
    lines.push(`- ${said(g.names, 'names')}`, `- ${said(g.labels, 'labels')}`, `- ${said(g.casing, 'case of names')}`);
    if (g.firstWords.length) lines.push(`- recurring first words: ${g.firstWords.map(([w, n]) => `${w} (${n.slice(0, 3).join(', ')}${n.length > 3 ? `, … ${n.length - 3} more` : ''})`).join('; ')}`);
    if (g.viewsLikeFlowActions) lines.push(`- views named like their flow action: ${g.viewsLikeFlowActions.n} of ${g.viewsLikeFlowActions.of} flow actions`);
    if (g.onClass.length) lines.push(`- names built on the class's last segment: ${g.onClass.join(', ')}`);
    lines.push(`- classes: ${g.classes.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

// The `convention:` lines of create for a new rule.
export function departures({ type, class: cls, name, label, labelGiven = false, index }) {
  const notes = [];
  if (type === 'Class' && !labelGiven) notes.push(`no --label: the class's label stays "${label ?? name}"; give it a readable one with --label`);
  const g = observe(index).find((x) => x.prefix === prefixOf(cls));
  if (!g) return notes;
  const nameLanguage = language(name);
  if (type !== 'Class' && g.names && g.names.value !== 'mixed' && nameLanguage && nameLanguage !== g.names.value) {
    notes.push(`${name} reads ${LANGUAGES[nameLanguage]}, the rules of ${g.prefix} are named in ${LANGUAGES[g.names.value]}`);
  }
  if (type !== 'Class' && g.casing && g.casing.value !== 'mixed' && !/^p[xyz][A-Z]/.test(name) && casing(name) !== g.casing.value) {
    notes.push(`${name} is ${casing(name)}, the rules of ${g.prefix} are ${g.casing.value}`);
  }
  // A class without --label already has its line: its label is not its own.
  const labelLanguage = label && label !== name && !(type === 'Class' && !labelGiven) ? language(label) : null;
  if (g.labels && g.labels.value !== 'mixed' && labelLanguage && labelLanguage !== g.labels.value) {
    notes.push(`the label "${label}" reads ${LANGUAGES[labelLanguage]}, the labels of ${g.prefix} are in ${LANGUAGES[g.labels.value]}`);
  }
  return notes;
}
