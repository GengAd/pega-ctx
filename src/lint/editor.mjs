// Schemas for the editor: each draft points with "$schema" to .pega/schemas/, so that VS Code (or any
// editor with a JSON Schema service) highlights the draft, underlines what the server would refuse
// and completes field names. The copies differ from the server's schemas in two ways only:
// - a field described as a JSON-stringified value also accepts an object or an array, since the draft
//   shows it unfolded (src/mirror/draft.mjs);
// - an update draft holds a patch: its copy requires no field at the top level.
// The files are derived: rewritten with each draft, they can be ignored by git.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';

const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';

function relaxed(s) {
  if (Array.isArray(s)) return s.map(relaxed);
  if (!s || typeof s !== 'object') return s;
  const r = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, relaxed(v)]));
  if (r.type === 'string' && /JSON[- ]stringified|JSON string/i.test(r.description ?? '')) r.type = ['string', 'object', 'array'];
  return r;
}

// Writes the copies for one rule schema and returns the "$schema" value for a draft file.
export function editorSchema(m, { operation, schema, file, draftFile }) {
  const folder = join(m.paths.base, 'schemas');
  mkdirSync(folder, { recursive: true });
  const name = basename(file);
  const { $id, ...copy } = relaxed(schema);
  const rule = operation === 'update' ? `update-${name}` : name;
  if (operation === 'update') delete copy.required;
  writeFileSync(join(folder, rule), `${JSON.stringify(copy, null, 2)}\n`);
  const wrapper = `draft-${rule}`;
  writeFileSync(join(folder, wrapper), `${JSON.stringify({
    $schema: DRAFT_2020,
    title: `pega-ctx ${operation} draft, ${schema.title}`,
    type: 'object',
    required: ['pega-ctx', 'content'],
    properties: { $schema: { type: 'string' }, 'pega-ctx': { type: 'object' }, content: { $ref: rule } },
  }, null, 2)}\n`);
  return relative(dirname(draftFile), join(folder, wrapper));
}
