// AsyncJobScheduler: the activity it runs, when, where and as whom.
// Fields read on the fixture: pyActivityName, pyBaseClass, pyRecurringFrequency, pyRecurrencePattern.{pyDailyInterval,
// pyStartTime,pyUseTimeZone}, pyApplicableTo, pyNodeTypesText, pyAccessGroupContext, pyAccessGroup (docs/projection.md).
import { filled, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const lines = [''];
  if (filled(o.pyActivityName)) {
    lines.push(`activity: ${o.pyBaseClass}:${o.pyActivityName}`);
    refs.add('Activity', o.pyBaseClass, o.pyActivityName, 'scheduled activity');
  }
  const p = o.pyRecurrencePattern ?? {};
  if (filled(o.pyRecurringFrequency)) {
    const every = filled(p.pyDailyInterval) && p.pyDailyInterval !== '1' ? `, every ${p.pyDailyInterval} days` : '';
    const at = filled(p.pyStartTime) ? ` at ${p.pyStartTime}${filled(p.pyUseTimeZone) ? ` ${p.pyUseTimeZone}` : ''}` : '';
    lines.push(`schedule: ${o.pyRecurringFrequency}${every}${at}`);
  }
  if (filled(o.pyApplicableTo)) lines.push(`runs on: ${o.pyApplicableTo}${filled(o.pyNodeTypesText) ? `, node types ${o.pyNodeTypesText}` : ''}`);
  if (o.pyAccessGroupContext === 'false' && filled(o.pyAccessGroup)) lines.push(`access group: ${o.pyAccessGroup}`);
  return { lines, references: refs.all() };
}
