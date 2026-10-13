// pega-ctx sync [--since <date>] [--full] [--ruleset <name>] [--application A] [--type T,U] [--jobs N]:
// brings the mirror up to date. list() has no filter by date or ruleset: one listing per type, then
// comparison of the update date with the index; only what changed is read again, --jobs calls at a time.
// Each rule read is noted in sync.partial.jsonl: an interrupted sync does not read it again.
// Index and graph are recomputed entirely.
import { decodeToon } from '../mcp/toon.mjs';
import { mirroredTypes } from '../mcp/tools.mjs';
import { mirror } from '../mirror/files.mjs';
import { renderStack, applicationOrder, rulesetOwners } from '../mirror/stack.mjs';
import { rebuild } from '../mirror/rebuild.mjs';
import { indexLine, versionDescending } from '../mirror/lines.mjs';
import { writeDraft, baseRuleset } from '../mirror/write.mjs';
import { render, listOption } from './common.mjs';
import { keepPrevious, recordSync, when } from '../mirror/changes.mjs';

export const help = 'pega-ctx sync [--since <date>] [--full] [--ruleset <name>] [--application A] [--type T,U] [--jobs N]';

// Calls at a time by default: the test server reads 40 rules in 19.5 s one by one, 4.7 s at 4,
// 1.4 s at 16, without a failure (docs/mirror.md § sync).
export const JOBS = 4;

// Runs fn on each item, `jobs` at a time; results in the order of the items.
export async function pool(items, jobs, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, worker));
  return results;
}

// Progress on stderr, one line rewritten, only on a terminal: a model reads the summary alone.
function terminalProgress() {
  if (!process.stderr.isTTY) return () => {};
  return (text) => process.stderr.write(text ? `\r${text}\x1b[K` : '\r\x1b[K');
}

// list() gives no class for a rule that has none (Rule-Edit-Validate); the index line says "".
const keyOf = (type, cls, name) => `${type}:${cls ?? ''}:${String(name).toLowerCase()}`;

export async function run({ options, root, connect, progress = terminalProgress() }) {
  const m = mirror(root);
  const config = m.readConfig();
  const since = typeof options.since === 'string' ? options.since : undefined;
  const jobs = options.jobs === undefined ? JOBS : Number(options.jobs);
  if (!Number.isInteger(jobs) || jobs < 1) return { code: 1, output: `--jobs ${options.jobs}: give a whole number of calls at a time, 1 or more (${JOBS} by default)` };
  const allTypes = mirroredTypes();
  const onlyTypes = listOption(options.type);
  const unknownTypes = onlyTypes.filter((t) => !allTypes.includes(t));
  if (unknownTypes.length) return { code: 1, output: `--type ${unknownTypes.join(',')}: unknown, choose among ${allTypes.join(', ')}` };
  const types = onlyTypes.length ? onlyTypes : allTypes;
  const application = typeof options.application === 'string' ? options.application : undefined;
  if (application && options.ruleset) return { code: 1, output: '--ruleset and --application: give one of them' };
  const partial = options.full ? new Map() : m.readPartial();
  if (options.full) m.removePartial();
  const previous = m.readIndex();
  const byKey = new Map(previous.map((l) => [keyOf(l.type, l.class, l.name), l]));

  const pega = await connect();
  const errors = [];
  const lines = new Map(); // key → index line without refs
  const touched = { added: [], changed: [], removed: [] };
  const listedTypes = new Set();
  let stack;
  let targets = [];
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
    // --application A: the rulesets of A alone, listed in A's context alone.
    const current = data?.application ?? config.application;
    const ofApplication = application && (data?.layers?.find((l) => l.application === application)?.rulesets ?? []).map((r) => r.split(':')[0]).filter((r) => !r.includes('_Branch_'));
    if (application && !ofApplication.length) {
      throw new Error(`--application ${application}: not in the stack of ${current}, or without rulesets (pega-ctx stack lists the applications)`);
    }
    targets = options.ruleset ? [options.ruleset] : application ? ofApplication : [...new Set([...(config.rulesets ?? []), ...ofApplications])];
    const followed = (ruleset) => !targets.length || targets.includes(ruleset);

    // A listing only returns the rules of its application's context: the current one, then each other
    // followed application through its alias (docs/mcp-tools.md).
    const contexts = application === undefined || application === current ? [{ application: current, alias: null }] : [];
    const others = options.ruleset ? [] : application ? (application === current ? [] : [application]) : (config.applications ?? []).filter((a) => a !== current);
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
        let listed = 0;
        const results = await pool(types, jobs, async (type) => {
          try {
            return { rows: await pega.list({ type }) };
          } catch (e) {
            return { error: e };
          } finally {
            progress(`list ${ctx.application}: ${++listed}/${types.length} types`);
          }
        });
        // In the order of the types, whatever order the answers came in.
        types.forEach((type, i) => {
          const { rows, error } = results[i];
          if (error) return errors.push(`list ${type}${ctx.alias ? ` in ${ctx.application}` : ''}: ${error.message}`);
          listedIn.set(type, (listedIn.get(type) ?? 0) + 1);
          const all = rowsByType.get(type) ?? { rows: [], keys: new Set() };
          for (const r of rows) if (!all.keys.has(r.key)) all.keys.add(r.key) && all.rows.push({ ...r, context: ctx.alias });
          rowsByType.set(type, all);
        });
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
    // First what to read, then the reads, context by context (the alias is the server's state, shared
    // by every call), `jobs` at a time within a context.
    const toRead = [];
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
        const rulesets = versions.filter((v) => v.ruleset).map((v) => `${v.ruleset}:${v.version}`);
        // Read by a sync that stopped before writing the index: raw/ already holds it, at this date.
        const done = partial.get(top.key);
        const kept = done && top.updated && done.updated === top.updated && m.readRaw(done.id);
        if (kept) {
          const o = decodeToon(kept);
          if (!top.ruleset && !followed(o.pyRuleSet)) continue;
          const line = indexLine(type, versions, o);
          if (old && old.id !== line.id) m.removeRaw(old.id);
          if (!old) touched.added.push(line.id);
          else if (old.updated !== top.updated) touched.changed.push(line.id);
          lines.set(k, line);
          continue;
        }
        const reread = options.full || !old || currentRaw === undefined || !top.updated || top.updated !== old.updated || (since && top.updated >= since);
        if (!reread) {
          const { refs, ...withoutRefs } = old;
          lines.set(k, { ...withoutRefs, description: top.description, updated: top.updated, by: top.by, rulesets: rulesets.length ? rulesets : old.rulesets });
          continue;
        }
        toRead.push({ k, type, versions, top, old, currentRaw, context: contextOf(top) });
      }
    }
    const aliases = [...new Set(toRead.map((t) => t.context))].sort((a, b) => (a === null ? -1 : b === null ? 1 : 0));
    let readCount = 0;
    try {
      for (const alias of aliases) {
        if (alias !== context) await pega.alias(alias);
        context = alias;
        await pool(toRead.filter((t) => t.context === alias), jobs, async ({ k, type, versions, top, old, currentRaw }) => {
          let toon;
          try {
            toon = await pega.read(top.key);
          } catch (e) {
            errors.push(`read ${top.id}: ${e.message}`);
            if (old) lines.set(k, old);
            return;
          } finally {
            progress(`read ${++readCount}/${toRead.length} rules`);
          }
          const o = decodeToon(toon);
          if (!top.ruleset && !followed(o.pyRuleSet)) return;
          const line = indexLine(type, versions, o);
          if (old && old.id !== line.id) m.removeRaw(old.id);
          if (!old) touched.added.push(line.id);
          else if (currentRaw !== toon) touched.changed.push(line.id);
          m.writeRaw(line.id, toon);
          m.appendPartial({ key: top.key, id: line.id, updated: top.updated });
          lines.set(k, line);
        });
      }
    } finally {
      if (context) await pega.alias(null);
      progress('');
    }
  } finally {
    await pega.close();
  }

  // A rule that list() no longer returns leaves the mirror, if its type was listed and its ruleset targeted.
  for (const [k, l] of byKey) {
    if (lines.has(k)) continue;
    const targeted = !(options.ruleset || application) || (l.rulesets ?? []).some((r) => targets.includes(r.split(':')[0]));
    if (listedTypes.has(l.type) && targeted) {
      m.removeRaw(l.id);
      touched.removed.push(l.id);
    } else {
      const { refs, ...withoutRefs } = l;
      lines.set(k, withoutRefs);
    }
  }

  // What this sync replaces, for pega-ctx changes: kept before the rebuild rewrites it.
  for (const list of Object.values(touched)) list.sort();
  keepPrevious(m, previous, touched);
  // stack.json first: the index lines take their application from it.
  if (stack) m.writeStackData(stack);
  const { index, withoutProjection, missing } = rebuild(m, [...lines.values()]);
  for (const id of missing) errors.push(`${id}: raw rule missing from raw/, run again with --full`);
  // stack.md lists the rulesets seen in the index; the write table draft is recomputed from it.
  if (stack) m.writeStack(renderStack(stack, { index, write: config.write, previous: m.readStack() ?? '', followed: config.applications }));
  m.writeWriteDraft(writeDraft(index));
  const at = new Date().toISOString();
  m.writeConfig({ ...config, lastSync: at });
  m.removePartial();
  recordSync(m, { from: config.lastSync ?? null, at, ...touched });
  const byId = new Map(index.map((l) => [l.id, l]));
  const previousById = new Map(previous.map((l) => [l.id, l]));
  const dated = (sign, id, line) => `${sign} ${id}${line && when(line) ? ` — ${when(line)}` : ''}`;

  const summary = `${touched.added.length} added, ${touched.changed.length} changed, ${touched.removed.length} removed, ${withoutProjection.length} types without projection`;
  const text = [
    summary,
    ...touched.added.map((id) => dated('+', id, byId.get(id))),
    ...touched.changed.map((id) => dated('~', id, byId.get(id))),
    ...touched.removed.map((id) => dated('-', id, previousById.get(id))),
    ...(errors.length ? ['', 'errors:', ...errors.map((e) => `- ${e}`)] : []),
  ].join('\n');
  const result = render(options, { ...touched, withoutProjection, rules: index.length, errors }, text);
  // No type listed: nothing was synchronized, it is a failure.
  return listedTypes.size ? result : { ...result, code: 1, output: `no list() succeeded: check the connection (java -version, ~/.infinity-rules-mcp/config.json)\n${result.output}` };
}
