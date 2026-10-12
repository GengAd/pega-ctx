// ClassMetadata: the primary fields of a class and, for a data class, its data pages.
// Fields read on the fixture: pyPrimaryFields[].pyPropertyName, pyListDataPage,
// pyDataTypeLocalActions[].{pyActionLabel,pyActionType} (docs/projection.md).
import { filled, items, isAppProperty, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const lines = [];
  const fields = items(o.pyPrimaryFields).map((f) => f.pyPropertyName).filter(filled);
  if (fields.length) lines.push('', `primary fields: ${fields.join(', ')}`);
  for (const f of fields) if (isAppProperty(f)) refs.add('Property', o.pyClassName, f, 'primary field');
  if (filled(o.pyListDataPage)) {
    lines.push(`list data page: ${o.pyListDataPage}`);
    refs.add('DataPage', o.pyClassName, o.pyListDataPage, 'list data page');
  }
  const actions = items(o.pyDataTypeLocalActions).filter((a) => filled(a.pyActionLabel));
  if (actions.length) lines.push(`actions: ${actions.map((a) => `${a.pyActionLabel} (${a.pyActionType})`).join(', ')}`);
  return { lines, references: refs.all() };
}
