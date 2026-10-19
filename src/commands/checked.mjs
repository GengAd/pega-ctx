// The lint step shared by create, update, send and lint: types fitted to the schema, drafts written
// with their "$schema" for the editor, findings shown, and the write refused on an error unless --no-lint.
import { readFileSync } from 'node:fs';
import { TYPES } from '../mcp/tools.mjs';
import { draftText } from '../mirror/draft.mjs';
import { lint, hasErrors, findingsText } from '../lint/lint.mjs';
import { fitTypes } from '../lint/jsonschema.mjs';
import { lineOf } from '../lint/positions.mjs';
import { editorSchema } from '../lint/editor.mjs';
import { declaredPz } from '../projection/persistence.mjs';
import { referenceFindings } from '../lint/references.mjs';

const loaded = (schemas, type) => schemas?.(type) ?? { missing: 'no schema loader' };

// "10" → 10, "true" → true where the server's schema expects a number or a boolean.
export function fitted(schemas, type, content) {
  const { schema } = loaded(schemas, type);
  return schema ? fitTypes(content, schema) : content;
}

// The pz* fields the type's schema declares as content, undefined without a schema.
export function keepOf(schemas, type) {
  const { schema } = loaded(schemas, type);
  return schema ? declaredPz(schema) : undefined;
}

// m, id: with the mirror, the references the content cites are checked too (src/lint/references.mjs);
// id is the rule written, left out of the drafts waiting.
export function lintOf(schemas, { operation, type, content, base, m, id }) {
  const { schema, missing } = loaded(schemas, type);
  const findings = lint({ operation, ruleClass: TYPES[type], content, base, schema, missing });
  if (m) findings.push(...referenceFindings({ operation, type, content, base, index: m.readIndex(), drafts: m.ids('drafts').filter((d) => d !== id), readRaw: m.readRaw }));
  return findings;
}

// Writes the draft, with the editor's schema next to it when there is one, and its digest as a
// .md file (what the draft writes, to read instead of the template's fields); returns its file.
export function writeDraft(m, schemas, header, content, digest) {
  const draftFile = m.draftFile(header.id);
  const { schema, file } = loaded(schemas, header.type);
  const schemaPath = schema ? editorSchema(m, { operation: header.operation, schema, file, draftFile }) : undefined;
  m.writeRuleDraft(header.id, draftText(header, content, { schema: schemaPath }));
  if (digest) m.writeRuleDraftDigest(header.id, `<!-- as written; after your corrections to the .json: pega-ctx send ${header.id} --dry-run -->\n${digest.trimEnd()}\n`);
  return draftFile;
}

// Findings of a draft file, with the line of each one in the file.
export function draftFindingsText(file, findings) {
  return findingsText(findings, { lineOf: lineOf(readFileSync(file, 'utf8')), prefix: '/content' });
}

// undefined when the write can go on; otherwise the refusal.
export function refusal(findings, options, text = findingsText(findings)) {
  if (!hasErrors(findings) || options['no-lint']) return undefined;
  return { code: 1, output: `${text}\nnothing sent: fix the content, or --no-lint to let the server decide` };
}
