// pega-ctx lint <draft file | id>: checks a draft against the server's schema, pega-ctx's rules and the
// mirror (what it cites exists), without Pega. One line per finding with its line in the file; code 1 if there is an error.
// send runs it before sending. The schema comes from the Pega plugin's files (src/mcp/schemas.mjs).
import { readFileSync } from 'node:fs';
import { shown } from './common.mjs';
import { mirror, splitId } from '../mirror/files.mjs';
import { readDraft } from '../mirror/draft.mjs';
import { hasErrors } from '../lint/lint.mjs';
import { lintOf, draftFindingsText } from './checked.mjs';
import { draftPath, baseOf } from './send.mjs';

export const help = 'pega-ctx lint <draft file | Type:Class:Name>';

export function run({ positionals, options, root, schemas }) {
  const m = mirror(root);
  const file = draftPath(m, root, positionals[0]);
  const { header, content } = readDraft(readFileSync(file, 'utf8'), shown(root, file));
  const { type } = splitId(header.id ?? '');
  const findings = lintOf(schemas, { operation: header.operation, type, content, base: baseOf(m, header.id), m, id: header.id });
  const code = hasErrors(findings) ? 1 : 0;
  return { code, output: options.json ? JSON.stringify(findings, null, 2) : `${shown(root, file)}\n${draftFindingsText(file, findings)}` };
}
