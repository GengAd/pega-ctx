// When: the logic and its numbered conditions, each as one expression.
// Fields read on the fixture: pyLogic, pyCondition[] (docs/projection.md).
import { filled, items, references } from './common.mjs';
import { conditionText, expressionReferences } from './condition.mjs';

export function body(o) {
  const refs = references();
  const lines = [];
  if (filled(o.pyDescription)) lines.push('', o.pyDescription);
  const conditions = items(o.pyCondition);
  lines.push('', `true if: ${filled(o.pyLogic) ? o.pyLogic : conditions.map((c) => c.pyConditionLabel).join(' AND ')}`);
  for (const c of conditions) {
    const t = conditionText(c);
    lines.push(`${c.pyConditionLabel ?? '?'}. ${t}`);
    expressionReferences(refs, o.pyClassName, t, 'condition');
  }
  return { lines, references: refs.all() };
}
