// Conditions (Embed-WhenConditions) and expressions, shared by When and Validate.
// Fields read on the fixture: pyConditionFieldName, pyConditionOperation, pyConditionValue1,
// pyConditionValue1Purpose (1FreeFormExpressionBoolean: the whole expression is in pyConditionValue1).
import { filled, isAppProperty } from './common.mjs';

export function conditionText(c) {
  if (/FreeForm/.test(c.pyConditionValue1Purpose ?? '')) return c.pyConditionValue1 ?? '';
  return [c.pyConditionFieldName, c.pyConditionOperation, c.pyConditionValue1].filter(filled).join(' ');
}

// References of an expression: evaluated decision table, data pages, properties of the current page.
export function expressionReferences(refs, cls, text, via) {
  const s = String(text ?? '');
  for (const m of s.matchAll(/pxEvaluateDecisionTable\([^,]*,\s*"(\w+)"\s*\)/g)) refs.add('DecisionTable', cls, m[1], via);
  for (const m of s.matchAll(/\b(D_\w+)/g)) refs.add('DataPage', cls, m[1], via);
  // `.Name` at the head of a path only: `D_X[...].Field` is a property of the data page's class.
  for (const m of s.matchAll(/(?<![\w)\]])\.([A-Za-z_]\w*)/g)) if (isAppProperty(m[1])) refs.add('Property', cls, m[1], via);
}

// First segment of a property path: `.registrationType.code` → registrationType.
export function propertyRoot(path) {
  return /^\.([A-Za-z_]\w*)/.exec(String(path ?? ''))?.[1];
}
