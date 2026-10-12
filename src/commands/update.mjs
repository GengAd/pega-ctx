// pega-ctx update <id> --patch <file.json> [--branch B] [--reason R] [--dry-run | --draft]
// Always after an implicit live: the patch applies to the rule as it is in Pega.
// --dry-run: the digest after the patch; --json adds the patch sent. --draft: the patch written to
// .pega/drafts/ with the fingerprint of the rule it was written against, sent later by pega-ctx send.
// Otherwise update-rule (arrays replaced) then live.
import { relative } from 'node:path';
import { decodeToon } from '../mcp/toon.mjs';
import { TYPES } from '../mcp/tools.mjs';
import { mirror } from '../mirror/files.mjs';
import { refresh } from '../mirror/live.mjs';
import { fingerprint } from '../mirror/draft.mjs';
import { fitted, lintOf, writeDraft, draftFindingsText, refusal, keepOf } from './checked.mjs';
import { findingsText } from '../lint/lint.mjs';
import { merge } from './template.mjs';
import { readPatch, plannedDigest, draftNote } from './create.mjs';
import { targetOf, header } from './live.mjs';
import { render, warnings, warningsText } from './common.mjs';
import { isManual, cannotWrite, manualHeader, manualNote } from './manual.mjs';

export const help = 'pega-ctx update <id> --patch <file.json> [--branch B] [--reason R] [--dry-run | --draft]';

// Digest of the rule after the patch, from its raw rule in the mirror.
export function patchedDigest(m, id, patch) {
  const raw = decodeToon(m.readRaw(id));
  const { updated, ...withoutDate } = m.readIndex().find((l) => l.id === id) ?? {};
  return plannedDigest(merge(raw, patch), m.readIndex(), { ...withoutDate, by: '(to be written)' });
}

// update-rule, then live. Shared by update and send.
export async function sendUpdate({ m, pega, options, target, key, patch, branch, reason }) {
  const notes = warnings(await pega.update({ key, patch, branch, description: reason.slice(0, 200) }));
  const after = await refresh(m, pega, target);
  return render(options, { ...after, warnings: notes }, `updated in branch ${branch}\n${warningsText(notes)}\n${after.digest.trimEnd()}`);
}

export async function run({ positionals, options, root, connect, schemas }) {
  if (options.patch === undefined) return { code: 1, output: `--patch <file.json> required: ${help}` };
  const m = mirror(root);
  const config = m.readConfig();
  const target = targetOf(m.readIndex(), positionals[0]);
  // A type the Pega MCP cannot write: only a draft for Dev Studio, never update-rule.
  const manual = isManual(target.type);
  if (manual && !options.draft && !options['dry-run']) return { code: 1, output: `${cannotWrite(target.type)}: add --draft to write what a developer changes in Dev Studio` };
  const patch = fitted(schemas, target.type, readPatch(options.patch, keepOf(schemas, target.type)));
  const branch = typeof options.branch === 'string' ? options.branch : config.branch;
  if (!options['dry-run'] && !options.draft && !branch) {
    return { code: 1, output: '--branch <ID> required: update-rule always writes to a branch (or set branch in .pega/config.json)' };
  }

  const pega = await connect();
  try {
    const before = await refresh(m, pega, target);
    const note = before.state === 'different' ? header('different', config) : '';
    const reason = typeof options.reason === 'string' ? options.reason : `pega-ctx update ${before.id.split(':').at(-1)}`;
    const type = before.id.split(':')[0];
    const findings = lintOf(schemas, { operation: 'update', type, content: patch, base: decodeToon(m.readRaw(before.id)) });
    if (options['dry-run'] || options.draft) {
      const digest = patchedDigest(m, before.id, patch);
      if (options['dry-run']) return render(options, { id: before.id, patch, digest, findings }, `${note}dry-run: nothing is written to Pega\n\n${digest.trimEnd()}\n\n${findingsText(findings)}`);
      const draft = { operation: 'update', id: before.id, type, ruleClass: TYPES[type], key: before.key, basedOn: fingerprint(m.readRaw(before.id)), reason, ...(typeof options.branch === 'string' ? { branch } : {}) };
      if (manual) Object.assign(draft, manualHeader(draft));
      const file = writeDraft(m, schemas, draft, patch);
      const written = manual ? manualNote(relative(root, file), type) : draftNote(root, file, before.id);
      return render(options, { draft: file, header: draft, content: patch, digest, findings }, `${note}${written}\n\n${digest.trimEnd()}\n\n${draftFindingsText(file, findings)}`);
    }
    const refused = refusal(findings, options);
    if (refused) return refused;
    return await sendUpdate({ m, pega, options, target, key: before.key, patch, branch, reason });
  } finally {
    await pega.close();
  }
}
