// AsyncQueueProcessor: the activity it runs on each queued item, where it runs.
// Fields read on the fixture: pyActivityName, pyBaseClass, pyNodeTypesText, pyIsAutoTuneEnabled,
// pyIsAlertThresholdManuallyEnabled and its thresholds (docs/projection.md).
import { filled, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const lines = [''];
  if (filled(o.pyActivityName)) {
    lines.push(`activity: ${o.pyBaseClass}:${o.pyActivityName}`);
    refs.add('Activity', o.pyBaseClass, o.pyActivityName, 'queue activity');
  }
  if (filled(o.pyNodeTypesText)) lines.push(`node types: ${o.pyNodeTypesText}`);
  if (o.pyIsAutoTuneEnabled === 'true') lines.push('auto-tune: yes');
  if (o.pyIsAlertThresholdManuallyEnabled === 'true') {
    lines.push(`alert thresholds: long running ${o.pyLongRunningThreshold} ms, interrupted after ${o.pyLongRunningInterruptThreshold} ms, ${o.pyMaxReadyToProcessStateMessages} messages ready`);
  }
  return { lines, references: refs.all() };
}
