// pega-ctx check: the mirror's inconsistencies, one line each with its fix.
// Non-zero code if there is anything.
import { shown } from './common.mjs';
import { mirror, splitId } from '../mirror/files.mjs';
import { incoming } from '../mirror/graph.mjs';
import { PROJECTIONS } from '../projection/index.mjs';
import { isManual } from './manual.mjs';
import { readDraft } from '../mirror/draft.mjs';
import { calls, strings, listedNames } from '../mirror/functions.mjs';
import { readFileSync } from 'node:fs';

export const help = 'pega-ctx check';
// Types that only exist to be cited: orphans are suspect.
const MUST_BE_CITED = new Set(['Section', 'View', 'DataTransform']);
const MAX_DAYS = 7;

export function run({ options, root, now = new Date() }) {
  const m = mirror(root);
  const config = m.readConfig();
  const index = m.readIndex();
  const graph = m.readGraph();
  const known = new Set(index.map((r) => r.id));
  const findings = [];

  for (const e of graph.edges) {
    if (e.confidence === 'sure' && !known.has(e.to)) {
      findings.push({ kind: 'missing', id: e.from, to: e.to, text: `${e.from} cites ${e.to}, missing from the mirror: pega-ctx sync, or the rule comes from an application that is not followed` });
    }
  }
  for (const r of index) {
    if (MUST_BE_CITED.has(r.type) && !incoming(graph, r.id).length) {
      findings.push({ kind: 'orphan', id: r.id, text: `${r.id} is cited by no rule of the mirror: delete it in Pega, or its caller is outside the mirror` });
    }
  }
  const withoutProjection = new Map();
  for (const r of index) if (!PROJECTIONS[r.type]) withoutProjection.set(r.type, (withoutProjection.get(r.type) ?? 0) + 1);
  for (const [type, n] of withoutProjection) {
    findings.push({ kind: 'without-projection', id: type, text: `${n} ${type} rules without projection: digest reduced to the header, see docs/projection.md` });
  }
  // A draft waiting to be sent: written by create --draft or update --draft, never sent nor deleted.
  // A draft for Dev Studio (a type the Pega MCP cannot write) waits for a developer, not for send.
  const listed = listedNames(m.readFunctions());
  for (const id of m.ids('drafts')) {
    const file = shown(root, m.draftFile(id));
    findings.push(
      isManual(splitId(id).type)
        ? { kind: 'draft', id, text: `draft for Dev Studio waiting: ${file}: a developer applies it as its "steps" say, then pega-ctx live ${id}, and the file is deleted` }
        : { kind: 'draft', id, text: `draft waiting: ${file}: read it, then pega-ctx send ${id} --branch <ID>, or delete the file` },
    );
    // A function no rule of the application calls: a warning, the user decides.
    let content;
    try {
      content = readDraft(readFileSync(m.draftFile(id), 'utf8'), file).content;
    } catch {
      continue;
    }
    const unknown = [...new Set(strings(content).flatMap((s) => calls(s).map((c) => c.name)))].filter((n) => !listed.has(n));
    for (const name of unknown) findings.push({ kind: 'function', level: 'warning', id, text: `warning: ${file} calls @${name}, which no rule of the application calls (.pega/functions.md): ask the user before relying on it` });
  }
  const last = config.lastSync ? new Date(config.lastSync) : undefined;
  const days = last ? (now - last) / 86_400_000 : Infinity;
  if (days > MAX_DAYS) {
    findings.push({ kind: 'sync', text: last ? `last sync ${Math.floor(days)} days ago: pega-ctx sync` : 'never synchronized: pega-ctx sync' });
  }

  const output = options.json ? JSON.stringify(findings, null, 2) : findings.length ? findings.map((f) => f.text).join('\n') : 'nothing to report';
  // A warning alone does not make check fail.
  return { code: findings.some((f) => f.level !== 'warning') ? 1 : 0, output };
}
