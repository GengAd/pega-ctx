// Shared by the commands: find a rule, render text or JSON.
import { relative, sep } from 'node:path';

// A file as the output shows it: relative to the project root, with / on every system (Windows takes it too),
// so that the same instructions and tests hold everywhere.
export const shown = (root, file) => relative(root, file).split(sep).join('/');

// Exact `Type:Class:Name`; otherwise `Name` or `Type:Name` if only one rule has that name.
// type: the type the caller expects; it settles a name two types share (a Class and its ClassMetadata).
export function findRule(index, request, { type: expected } = {}) {
  if (!request) throw new Error('missing identifier: give Type:Class:Name (pega-ctx search <words> to find it)');
  const exact = index.find((r) => r.id === request);
  if (exact) return exact;
  const parts = request.split(':');
  const name = parts.at(-1);
  // Full identifier: exact or nothing. Falling back on the name would return another class's pyDefault.
  if (parts.length === 3) {
    throw new Error(`unknown rule: ${request}. Look it up with pega-ctx search ${name}, or run pega-ctx sync (a rule created outside pega-ctx is only in the mirror afterwards)`);
  }
  const type = parts.length === 2 ? parts[0] : undefined;
  let candidates = index.filter((r) => r.name === name && (!type || r.type === type));
  if (candidates.length > 1 && expected && candidates.filter((r) => r.type === expected).length === 1) candidates = candidates.filter((r) => r.type === expected);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) throw new Error(`several rules named ${name}: give the identifier among ${candidates.map((r) => r.id).join(', ')}`);
  throw new Error(`unknown rule: ${request}. Look it up with pega-ctx search ${name}, or run pega-ctx sync`);
}

export function render(options, object, text) {
  return { code: 0, output: options.json ? JSON.stringify(object, null, 2) : text };
}

export const listOption = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

// Warnings returned by create-rule / update-rule, even on success (`warning`, `validationWarnings`):
// shown as is, the user must see them.
export function warnings(response) {
  const r = response && typeof response === 'object' ? response : {};
  const list = [r.warning, r.warnings, r.validationWarnings].flat().filter((w) => w !== undefined && w !== null && w !== '');
  return list.map((w) => (typeof w === 'string' ? w : JSON.stringify(w)).replace(/\s+/g, ' ').trim());
}

export function warningsText(list) {
  return list.map((w) => `Pega warning: ${w}\n`).join('');
}
