// Correspondence: the template, as a type of message (the text itself is in pySourceStream, dropped).
// Fields read on the fixture: pyCorrType, pyNextAction, pyUserEdit, pyVerifyCorr, pyTopLevelCorr (docs/projection.md).
import { filled } from './common.mjs';

export function body(o) {
  const lines = ['', `type: ${o.pyCorrType}`];
  if (filled(o.pyNextAction)) lines.push(`next action: ${o.pyNextAction}`);
  if (filled(o.pyUserEdit) && o.pyUserEdit !== 'NoEdit') lines.push(`user edit: ${o.pyUserEdit}`);
  if (o.pyVerifyCorr === 'true') lines.push('verified before sending: yes');
  if (o.pyTopLevelCorr === 'true') lines.push('top level: yes');
  return { lines, references: [] };
}
