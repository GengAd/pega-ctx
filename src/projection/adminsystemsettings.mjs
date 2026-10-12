// AdminSystemSettings: the setting per production level, only the levels that hold a value.
// Fields read on the fixture: pyOwner, pyPurpose, pyProductionLevel[] (docs/projection.md).
import { filled, items } from './common.mjs';

export function body(o) {
  const lines = ['', `setting: ${o.pyOwner} ${o.pyPurpose}`];
  const levels = items(o.pyProductionLevel).filter((l) => filled(l.pySetting));
  lines.push('', '## Values', ...(levels.length ? levels.map((l) => `- ${l.pyDescription}: ${l.pySetting}`) : ['none']));
  return { lines, references: [] };
}
