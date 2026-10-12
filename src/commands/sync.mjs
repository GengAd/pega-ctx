// pega-ctx sync [--since <date>] [--full] [--ruleset <name>]: brings the mirror up to date.
// list() has no filter by date or ruleset: one listing per type, then comparison of the update date
// with the index; only what changed is read again. Index and graph are recomputed entirely.
import { decodeToon } from '../mcp/toon.mjs';
import { mirroredTypes } from '../mcp/tools.mjs';
import { mirror } from '../mirror/files.mjs';
import { renderStack } from '../mirror/stack.mjs';
import { rebuild } from '../mirror/rebuild.mjs';
import { indexLine, versionDescending } from '../mirror/lines.mjs';
import { writeDraft } from '../mirror/write.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx sync [--since <date>] [--full] [--ruleset <name>]';

// list() gives no class for a rule that has none (Rule-Edit-Validate); the index line says "".
const keyOf = (type, cls, name) => `${type}:${cls ?? ''}:${String(name).toLowerCase()}`;

export async function run({ options, root, connect }) {
  const m = mirror(root);
  const config = m.readConfig();
  const targets = options.ruleset ? [options.ruleset] : config.rulesets ?? [];
  const followed = (ruleset) => !targets.length || targets.includes(ruleset);
  const since = typeof options.since === 'string' ? options.since : undefined;
  const previous = m.readIndex();
  const byKey = new Map(previous.map((l) => [keyOf(l.type, l.class, l.name), l]));

  const pega = await connect();
  const errors = [];
  const lines = new Map(); // key → index line without refs
  const touched = { added: [], changed: [], removed: [] };
  const listedTypes = new Set();
  let stack;
  try {
    try {
      stack = await pega.stack();
    } catch (e) {
      errors.push(`stack(): ${e.message} (stack.md unchanged)`);
    }

    for (const type of mirroredTypes()) {
      let rows;
      try {
        rows = await pega.list({ type });
      } catch (e) {
        errors.push(`list ${type}: ${e.message}`);
        continue;
      }
      listedTypes.add(type);
      // CaseType: no ruleset in the listing, the filter is applied after reading.
      const groups = new Map();
      for (const r of rows.filter((r) => !r.ruleset || followed(r.ruleset))) {
        const k = keyOf(type, r.class, r.name);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      for (const [k, versions] of groups) {
        versions.sort(versionDescending);
        const top = versions[0];
        const old = byKey.get(k);
        const currentRaw = old && m.readRaw(old.id);
        const reread = options.full || !old || currentRaw === undefined || !top.updated || top.updated !== old.updated || (since && top.updated >= since);
        const rulesets = versions.filter((v) => v.ruleset).map((v) => `${v.ruleset}:${v.version}`);
        const base = { description: top.description, updated: top.updated, by: top.by };
        if (!reread) {
          const { refs, ...withoutRefs } = old;
          lines.set(k, { ...withoutRefs, ...base, rulesets: rulesets.length ? rulesets : old.rulesets });
          continue;
        }
        let toon;
        try {
          toon = await pega.read(top.key);
        } catch (e) {
          errors.push(`read ${top.id}: ${e.message}`);
          if (old) lines.set(k, old);
          continue;
        }
        const o = decodeToon(toon);
        if (!top.ruleset && !followed(o.pyRuleSet)) continue;
        const line = indexLine(type, versions, o);
        if (old && old.id !== line.id) m.removeRaw(old.id);
        if (!old) touched.added.push(line.id);
        else if (currentRaw !== toon) touched.changed.push(line.id);
        m.writeRaw(line.id, toon);
        lines.set(k, line);
      }
    }
  } finally {
    await pega.close();
  }

  // A rule that list() no longer returns leaves the mirror, if its type was listed and its ruleset targeted.
  for (const [k, l] of byKey) {
    if (lines.has(k)) continue;
    const targeted = !options.ruleset || (l.rulesets ?? []).some((r) => r.startsWith(`${options.ruleset}:`));
    if (listedTypes.has(l.type) && targeted) {
      m.removeRaw(l.id);
      touched.removed.push(l.id);
    } else {
      const { refs, ...withoutRefs } = l;
      lines.set(k, withoutRefs);
    }
  }

  const { index, withoutProjection, missing } = rebuild(m, [...lines.values()]);
  for (const id of missing) errors.push(`${id}: raw rule missing from raw/, run again with --full`);
  // stack.md lists the rulesets seen in the index; the write table draft is recomputed from it.
  if (stack) m.writeStack(renderStack(stack, { index, write: config.write, previous: m.readStack() ?? '' }));
  m.writeWriteDraft(writeDraft(index));
  m.writeConfig({ ...config, lastSync: new Date().toISOString() });

  const summary = `${touched.added.length} added, ${touched.changed.length} changed, ${touched.removed.length} removed, ${withoutProjection.length} types without projection`;
  const text = [
    summary,
    ...touched.added.map((id) => `+ ${id}`),
    ...touched.changed.map((id) => `~ ${id}`),
    ...touched.removed.map((id) => `- ${id}`),
    ...(errors.length ? ['', 'errors:', ...errors.map((e) => `- ${e}`)] : []),
  ].join('\n');
  const result = render(options, { ...touched, withoutProjection, rules: index.length, errors }, text);
  // No type listed: nothing was synchronized, it is a failure.
  return listedTypes.size ? result : { ...result, code: 1, output: `no list() succeeded: check the connection (java -version, ~/.infinity-rules-mcp/config.json)\n${result.output}` };
}
