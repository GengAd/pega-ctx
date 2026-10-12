// AITool: what the agent is told about it, and the rule it runs.
// Fields read on the fixture: pyIntentDescription, pyAskConfirmation, pyRetentionPolicy,
// pyGenAIDef.pyExamples[], pyIntentActionPage.{pyCategory,pyClassName,pyRuleName} (docs/projection.md).
import { filled, items, references, typeOfRaw } from './common.mjs';

export function body(o) {
  const refs = references();
  const lines = [];
  if (filled(o.pyIntentDescription)) lines.push('', o.pyIntentDescription);
  if (o.pyAskConfirmation === 'true') lines.push('asks confirmation: yes');
  if (filled(o.pyRetentionPolicy) && o.pyRetentionPolicy !== 'ALWAYS_RETAIN') lines.push(`retention: ${o.pyRetentionPolicy}`);
  const examples = items(o.pyGenAIDef?.pyExamples).map((e) => e.pyExample).filter(filled);
  if (examples.length) lines.push('', '## Examples', ...examples.map((e) => `- ${e}`));
  const action = o.pyIntentActionPage;
  if (filled(action?.pyRuleName)) {
    const type = typeOfRaw({ pxObjClass: action.pyCategory });
    lines.push('', '## Action', `${type ?? action.pyCategory} ${action.pyClassName}:${action.pyRuleName}`);
    refs.add(type, action.pyClassName, action.pyRuleName, 'tool action');
  }
  return { lines, references: refs.all() };
}
