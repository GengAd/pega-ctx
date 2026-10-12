// pega-ctx sync [--since <date>] [--full] [--ruleset <name>]: brings the mirror up to date.
// list() has no filter by date or ruleset: one listing per type, then comparison of the update date
// with the index; only what changed is read again. Index and graph are recomputed entirely.
import { decodeToon } from '../mcp/toon.mjs';
import { mirroredTypes } from '../mcp/tools.mjs';
import { mirror } from '../mirror/files.mjs';
import { renderStack, applicationOrder, rulesetOwners } from '../mirror/stack.mjs';
import { rebuild } from '../mirror/rebuild.mjs';
import { indexLine, versionDescending } from '../mirror/lines.mjs';
import { writeDraft, baseRuleset } from '../mirror/write.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx sync [--since <date>] [--full] [--ruleset <name>]';

// list() gives no class for a rule that has none (Rule-Edit-Validate); the index line says "".
const keyOf = (type, cls, name) => `${type}:${cls ?? ''}:${String(name).toLowerCase()}`;

export async function run({ options, root, connect }) {
  const m = mirror(root);
  const config = m.readConfig();
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
    const data = stack ?? m.readStackData();
    const stackText = m.readStack() ?? '';
    const order = applicationOrder(data, stackText);
    const owners = rulesetOwners(data, stackText);
    // Followed rulesets: --ruleset; otherwise "rulesets" and those of the followed applications, branches aside.
    const ofApplications = (config.applications ?? [])
      .flatMap((a) => data?.layers?.find((l) => l.application === a)?.rulesets ?? [])
      .map((r) => r.split(':')[0])
      .filter((r) => !r.includes('_Branch_'));
    for (const a of config.applications ?? []) {
      if (data?.layers && !data.layers.some((l) => l.application === a)) errors.push(`${a}: not in the stack of ${data.application}, its rulesets are unknown: remove it from "applications" or name its rulesets in "rulesets"`);
    }
    const targets = options.ruleset ? [options.ruleset] : [...new Set([...(config.rulesets ?? []), ...ofApplications])];
    const followed = (ruleset) => !targets.length || targets.includes(ruleset);

    // A listing only returns the rules of its application's context: the current one, then each other
    // followed application through its alias (docs/mcp-tools.md).
    const contexts = [{ application: data?.application ?? config.application, alias: null }];
    const others = options.ruleset ? [] : (config.applications ?? []).filter((a) => a !== contexts[0].application);
    if (others.length) {
      const known = await pega.applications();
      for (const a of others) {
        const found = known.find((k) => k.application === a);
        if (found?.alias) contexts.push({ application: a, alias: found.alias });
        else errors.push(`${a}: not mirrored, the operator cannot open it (no alias in list-available-applications)`);
      }
    }

    const rowsByType = new Map();
    const listedIn = new Map();
    for (const ctx of contexts) {
      try {
        if (ctx.alias) await pega.alias(ctx.alias);
      } catch (e) {
        errors.push(`${ctx.application}: alias ${ctx.alias} refused (${e.message})`);
        continue;
      }
      try {
        for (const type of mirroredTypes()) {
          let rows;
          try {
            rows = await pega.list({ type });
          } catch (e) {
            errors.push(`list ${type}${ctx.alias ? ` in ${ctx.application}` : ''}: ${e.message}`);
            continue;
          }
          listedIn.set(type, (listedIn.get(type) ?? 0) + 1);
          const all = rowsByType.get(type) ?? { rows: [], keys: new Set() };
          for (const r of rows) if (!all.keys.has(r.key)) all.keys.add(r.key) && all.rows.push({ ...r, context: ctx.alias });
          rowsByType.set(type, all);
        }
      } finally {
        if (ctx.alias) await pega.alias(null);
      }
    }
    for (const [type, n] of listedIn) if (n === contexts.length) listedTypes.add(type);

    // The version Pega finds first: the highest application of the stack, then the highest version.
    const rank = (v) => {
      const i = order.indexOf(owners.get(baseRuleset(v.ruleset)));
      return i < 0 ? order.length : i;
    };
    const byPriority = (a, b) => rank(a) - rank(b) || versionDescending(a, b);
    // A rule is read in the context of the application its ruleset belongs to, otherwise where it was listed.
    const contextOf = (r) => contexts.find((c) => c.application === owners.get(baseRuleset(r.ruleset)))?.alias ?? r.context ?? null;
    let context = null;
    const enter = async (alias) => {
      if (alias !== context) await pega.alias(alias);
      context = alias;
    };
    try {
      for (const [type, { rows }] of rowsByType) {
        // CaseType: no ruleset in the listing, the filter is applied after reading.
        const groups = new Map();
        for (const r of rows.filter((r) => !r.ruleset || followed(r.ruleset))) {
          const k = keyOf(type, r.class, r.name);
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(r);
        }
        for (const [k, versions] of groups) {
          versions.sort(byPriority);
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
            await enter(contextOf(top));
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
      if (context) await pega.alias(null);
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

  // stack.json first: the index lines take their application from it.
  if (stack) m.writeStackData(stack);
  const { index, withoutProjection, missing } = rebuild(m, [...lines.values()]);
  for (const id of missing) errors.push(`${id}: raw rule missing from raw/, run again with --full`);
  // stack.md lists the rulesets seen in the index; the write table draft is recomputed from it.
  if (stack) m.writeStack(renderStack(stack, { index, write: config.write, previous: m.readStack() ?? '', followed: config.applications }));
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
