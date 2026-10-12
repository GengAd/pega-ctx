// ServiceLevel: goal, deadline and late intervals, and what happens when each passes.
// Fields read on the fixture: py{Goal,Deadline,Late,NextAction}Default{Days,Hours,Minutes,Seconds},
// pyCalculateTimesFrom, pyMaxLateEvents, pyNextActionSetting, pyEscalations{} (docs/projection.md).
import { filled } from './common.mjs';

const UNITS = [['Days', 'd'], ['Hours', 'h'], ['Minutes', 'min'], ['Seconds', 's']];

function interval(o, prefix) {
  const parts = UNITS.map(([name, unit]) => [Number(o[`${prefix}Default${name}`] ?? 0), unit]).filter(([n]) => n > 0);
  return parts.length ? parts.map(([n, unit]) => `${n}${unit}`).join(' ') : undefined;
}

export function body(o) {
  const lines = [];
  if (filled(o.pyCalculateTimesFrom)) lines.push('', `times counted from: ${o.pyCalculateTimesFrom}`);
  for (const [label, prefix] of [['goal', 'pyGoal'], ['deadline', 'pyDeadline'], ['late, every', 'pyLate']]) {
    const t = interval(o, prefix);
    if (t) lines.push(`${label}: ${t}`);
  }
  if (Number(o.pyMaxLateEvents) > 0) lines.push(`late events: at most ${o.pyMaxLateEvents}`);
  if (filled(o.pyNextActionSetting) && o.pyNextActionSetting !== 'Immediate') lines.push(`next action: ${o.pyNextActionSetting}`);
  if (Number(o.pyUrgencySLA) > 0) lines.push(`urgency: ${o.pyUrgencySLA}`);
  const escalations = Object.entries(o.pyEscalations ?? {}).map(([name, e]) => ({ name, urgency: Number(e.pyEscalationUrgency ?? 0) }));
  const shown = escalations.filter((e) => e.urgency > 0);
  if (shown.length) lines.push('', '## Escalations', ...shown.map((e) => `- ${e.name}: urgency +${e.urgency}`));
  return { lines, references: [] };
}
