// pega-ctx send <draft file | id> [--branch B] [--reason R] [--dry-run] [--force]
// Sends a draft written by create --draft or update --draft, as it is in the file (corrected by hand
// or not): nothing is recomputed from the template. Then live, and the draft is deleted.
// An update draft whose rule changed in Pega since it was written is refused, unless --force.
// A draft of a type the Pega MCP cannot write is for Dev Studio: refused (src/commands/manual.mjs).
// The draft is linted first (pega-ctx lint): an error stops the send, unless --no-lint.
import { readFileSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { mirror, splitId } from '../mirror/files.mjs';
import { refresh } from '../mirror/live.mjs';
import { readDraft, fingerprint } from '../mirror/draft.mjs';
import { checkFields, plannedDigest, sendCreate } from './create.mjs';
import { patchedDigest, sendUpdate } from './update.mjs';
import { render } from './common.mjs';
import { lintOf, draftFindingsText, refusal, keepOf } from './checked.mjs';
import { decodeToon } from '../mcp/toon.mjs';
import { isManual, cannotWrite } from './manual.mjs';

// The rule an update draft applies to, as the mirror has it (live refreshes it before sending).
export function baseOf(m, id) {
  const raw = m.readRaw(id);
  return raw === undefined ? undefined : decodeToon(raw);
}

export const help = 'pega-ctx send <draft file | Type:Class:Name> [--branch B] [--reason R] [--dry-run] [--force] [--no-lint]';

// A path to a file, or the identifier of a rule whose draft is in .pega/drafts/.
export function draftPath(m, root, request) {
  if (!request) throw new Error(`which draft? ${help}`);
  const asFile = resolve(root, request);
  if (existsSync(asFile)) return asFile;
  if (request.split(':').length >= 3 && existsSync(m.draftFile(request))) return m.draftFile(request);
  throw new Error(`no draft ${request}: give a file of .pega/drafts/ or the identifier of a rule written with create --draft or update --draft (pega-ctx check lists them)`);
}

export async function run({ positionals, options, root, connect, schemas }) {
  const m = mirror(root);
  const config = m.readConfig();
  const file = draftPath(m, root, positionals[0]);
  const shown = relative(root, file);
  const { header, content } = readDraft(readFileSync(file, 'utf8'), shown);
  const { id } = header;
  if (typeof id !== 'string' || id.split(':').length < 3) throw new Error(`${shown}: "pega-ctx".id must be Type:Class:Name`);
  const { type, class: cls, name } = splitId(id);
  // A draft for Dev Studio: shown by --dry-run, never sent, so its fields are not checked for sending.
  const manual = isManual(type);
  if (manual && !options['dry-run']) return { code: 1, output: `${shown}: ${cannotWrite(type)}: a developer applies this draft in Dev Studio as its "steps" say, then pega-ctx live ${id}` };
  if (!manual) checkFields(content, shown, 'the draft', { strict: false, keep: keepOf(schemas, type) });
  const reason = typeof options.reason === 'string' ? options.reason : header.reason ?? `pega-ctx send ${name}`;
  const branch = typeof options.branch === 'string' ? options.branch : header.branch ?? config.branch;
  const findings = lintOf(schemas, { operation: header.operation, type, content, base: baseOf(m, id) });
  const findingsShown = draftFindingsText(file, findings);

  if (header.operation === 'create') {
    if (m.readIndex().some((r) => r.id === id)) return { code: 1, output: `${id} already exists: write an update draft (pega-ctx update ${id} --patch … --draft)` };
    if (options['dry-run']) {
      const digest = plannedDigest({ ...content, pyRuleSet: header.ruleset ?? '?', pyRuleSetVersion: '(branch)' }, m.readIndex());
      return render(options, { draft: file, header, content, digest, findings }, `dry-run: nothing is written to Pega\n${shown}: create ${id}\n\n${digest.trimEnd()}\n\n${findingsShown}`);
    }
    if (!branch) return { code: 1, output: '--branch <ID> required: create-rule always writes to a branch (or set branch in .pega/config.json)' };
    const refused = refusal(findings, options, findingsShown);
    if (refused) return refused;
    const pega = await connect();
    try {
      const r = await sendCreate({ m, pega, config, options, id, type, cls, name, content, ruleset: header.ruleset, branch, reason });
      m.removeRuleDraft(id);
      return r;
    } finally {
      await pega.close();
    }
  }

  // update: the patch applies to the rule as it is in Pega, which must be the one the draft was written against.
  if (!m.readIndex().some((r) => r.id === id) && !header.key) throw new Error(`${shown}: ${id} is not in the mirror and the draft has no key: pega-ctx live ${id}`);
  if (options['dry-run']) {
    const digest = patchedDigest(m, id, content);
    return render(options, { draft: file, header, content, digest, findings }, `dry-run: nothing is written to Pega\n${shown}: update ${id}\n\n${digest.trimEnd()}\n\n${findingsShown}`);
  }
  if (!branch) return { code: 1, output: '--branch <ID> required: update-rule always writes to a branch (or set branch in .pega/config.json)' };
  const refused = refusal(findings, options, findingsShown);
  if (refused) return refused;
  const pega = await connect();
  try {
    const target = { type, class: cls, name };
    const now = await refresh(m, pega, target);
    if (header.basedOn && fingerprint(m.readRaw(now.id)) !== header.basedOn && !options.force) {
      return { code: 1, output: `${id} changed in Pega since the draft was written: pega-ctx rule ${id} shows it now; write the draft again (update --draft), or send --force to apply it anyway` };
    }
    const r = await sendUpdate({ m, pega, options, target, key: now.key, patch: content, branch, reason });
    m.removeRuleDraft(id);
    return r;
  } finally {
    await pega.close();
  }
}
