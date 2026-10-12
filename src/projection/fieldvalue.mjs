// FieldValue: a displayed text for a field and one of its values.
// Fields read on the fixture: pyFieldName, pyFieldValue, pyLocalizedValue (docs/projection.md).
import { filled } from './common.mjs';

export function body(o) {
  const lines = ['', `field: ${o.pyFieldName}`, `value: ${o.pyFieldValue}`];
  if (filled(o.pyLocalizedValue)) lines.push(`shown as: ${o.pyLocalizedValue}`);
  return { lines, references: [] };
}
