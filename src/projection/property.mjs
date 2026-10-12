// Property: mode, type, control, page class for a page or a list, allowed values.
// Fields read on the fixture: pyPropertyMode, pyStringType, pyStreamName (control), pyPageClass,
// pyTableOption, pyPromptTableList[], pyDataRetrievalType (docs/projection.md).
import { filled, items, references } from './common.mjs';

export function body(o) {
  const lines = [];
  if (filled(o.pyDescription)) lines.push('', o.pyDescription);
  lines.push('');
  const pageOrList = /^Page/.test(o.pyPropertyMode ?? '');
  lines.push(`mode: ${o.pyPropertyMode}${pageOrList && filled(o.pyPageClass) ? ` of ${o.pyPageClass}` : ''}${filled(o.pyStringType) ? `, type ${o.pyStringType}` : ''}`);
  if (filled(o.pyStreamName)) lines.push(`control: ${o.pyStreamName}`);
  const values = items(o.pyPromptTableList).map((v) => (v.pyLocalizedValue && v.pyLocalizedValue !== v.pyStandardValue ? `${v.pyStandardValue} (${v.pyLocalizedValue})` : v.pyStandardValue)).filter(filled);
  if (values.length) lines.push(`values (${o.pyTableOption ?? 'list'}): ${values.join(', ')}`);
  else if (filled(o.pyTableOption)) lines.push(`values: ${o.pyTableOption}`);
  if (filled(o.pyDataRetrievalType) && o.pyDataRetrievalType !== 'MANUAL') lines.push(`data retrieval: ${o.pyDataRetrievalType}`);
  // The page class is not a rule: it is in the body, not a reference.
  return { lines, references: references().all() };
}
