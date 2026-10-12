// Validate: the checks in order, by group: property, validity condition, message.
// pySteps is the activity generated from the form: dropped. Fields read on the fixture:
// pyValidationValues[].pyValidations[], pyAddValidates (docs/projection.md).
import { filled, items, references } from './common.mjs';
import { conditionText, expressionReferences } from './condition.mjs';

export function body(o) {
  const refs = references();
  const cls = o.pyClassName;
  const lines = [];
  if (filled(o.pyDescription)) lines.push('', o.pyDescription);
  lines.push('', '## Checks');
  for (const group of items(o.pyValidationValues)) {
    if (filled(group.pyLabel)) lines.push(`### ${group.pyLabel}`);
    items(group.pyValidations).forEach((v, i) => {
      const what = filled(v.pyPropertyName) ? v.pyPropertyName : v.pyValidationType;
      const details = [];
      const valid = items(v.pyValidWhen?.pyCondition).map(conditionText).filter(filled);
      if (valid.length) details.push(`valid if ${valid.join(' and ')}`);
      if (v.pyRequired === 'true') details.push('required');
      if (filled(v.pyMessageValue)) details.push(`message ${v.pyMessageValue}`);
      if (filled(v.pyPropertyName) && v.pyValidationType !== 'ValidateProperty') details.push(v.pyValidationType);
      lines.push(`${i + 1}. ${what}${details.length ? `: ${details.join(', ')}` : ''}`);
      refs.property(v.pyClassName ?? cls, v.pyPropertyName, 'check');
      for (const t of valid) expressionReferences(refs, cls, t, 'condition');
    });
    const called = items(group.pyAddValidates).map((a) => a.pyRuleName).filter(filled);
    if (called.length) {
      lines.push(`also calls: ${called.join(', ')}`);
      for (const name of called) refs.add('Validate', cls, name, 'called validate');
    }
  }
  return { lines, references: refs.all() };
}
