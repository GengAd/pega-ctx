// CorrespondenceType: the data classes behind a correspondence type.
// Fields read on the fixture: pyCorrType, pyCorrClass, pyAddressClass, pyWorkClass (docs/projection.md).
import { filled } from './common.mjs';

export function body(o) {
  const lines = ['', `type: ${o.pyCorrType}`];
  for (const [label, field] of [['correspondence class', 'pyCorrClass'], ['address class', 'pyAddressClass'], ['work class', 'pyWorkClass']]) {
    if (filled(o[field])) lines.push(`${label}: ${o[field]}`);
  }
  return { lines, references: [] };
}
