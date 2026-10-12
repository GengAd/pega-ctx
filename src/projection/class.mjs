// Class: parent, class group, kind, business key. A class is created before the rules that
// apply to it (server skill rules-rule-obj-class): `create Class` starts from a sibling class.
// Fields read on the fixture: pyDerivesFrom, pyClassGroup, pyClassGroupIndicator, pyClassType,
// pyPatternInheritance, pyUsage, pyKeyDefList[] (docs/projection.md).
import { filled, items, references } from './common.mjs';

const GROUP = { HASCLASSGROUP: 'member of', ISCLASSGROUP: 'class group root', NOCLASSGROUP: 'no group' };

export function body(o) {
  const lines = [];
  if (filled(o.pyDescription) && o.pyDescription !== o.pyLabel) lines.push('', o.pyDescription);
  lines.push('');
  lines.push(`derives from: ${o.pyDerivesFrom ?? '?'}${o.pyPatternInheritance === 'true' ? ' (and by name pattern)' : ''}`);
  if (filled(o.pyClassGroupIndicator)) {
    const group = GROUP[o.pyClassGroupIndicator] ?? o.pyClassGroupIndicator;
    lines.push(`group: ${group}${o.pyClassGroupIndicator === 'HASCLASSGROUP' && filled(o.pyClassGroup) ? ` ${o.pyClassGroup}` : ''}`);
  }
  if (filled(o.pyClassType)) lines.push(`kind: ${o.pyClassType}`);
  // pyKeyDefList[].pyKeyName: empty on the fixture, shape read in get-skill rules-rule-obj-class/examples/pyKeyDefList.
  const keys = items(o.pyKeyDefList).map((k) => k.pyKeyName).filter(filled);
  if (keys.length) lines.push(`key: ${keys.join(', ')}`);
  if (filled(o.pyUsage) && o.pyUsage !== o.pyDescription) lines.push(`usage: ${o.pyUsage}`);
  // The parent is not a reference: often a Pega class (Work-, Data-), never in the mirror.
  return { lines, references: references().all() };
}
