// CaseType: stages in order, for each its processes and the flow of each; starting flows.
// Fields read on the fixture: pyStages, pyAlternateStages, pyCasetypeStartingFlows (docs/projection.md).
import { filled, items, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const cls = o.pyClassName;
  const lines = [];
  if (filled(o.pyDescription) && o.pyDescription !== o.pyLabel) lines.push('', o.pyDescription);

  const stages = (title, list) => {
    if (!list.length) return;
    lines.push('', `## ${title}`);
    list.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.pyStageName}${attributes(s)}`);
      for (const p of items(s.pyProcesses)) {
        lines.push(`   - ${p.pyLabel ?? p.pyFlowName}: flow ${p.pyFlowName}`);
        refs.add('Flow', cls, p.pyFlowName, 'process', { stage: s.pyStageName });
      }
    });
  };
  stages('Stages', items(o.pyStages));
  stages('Alternate stages', items(o.pyAlternateStages));

  const starting = items(o.pyCasetypeStartingFlows).filter((f) => filled(f.pyStartingFlowType));
  if (starting.length) {
    lines.push('', `start: ${starting.map((f) => `${f.pyStartingFlowType}${f.pyAutomaticStart === 'true' ? ' (automatic)' : ''}`).join(', ')}`);
    for (const f of starting) refs.add('Flow', f.pyClass ?? cls, f.pyStartingFlowType, 'start');
  }
  return { lines, references: refs.all() };
}

function attributes(s) {
  const a = [];
  if (s.pyIsInitializationStage === 'true') a.push('initial');
  if (s.pyIsTerminalStage === 'true') a.push('terminal');
  if (filled(s.pyStageEntryStatus)) a.push(`entry status ${s.pyStageEntryStatus}`);
  if (filled(s.pyStageWorkStatus)) a.push(`status ${s.pyStageWorkStatus}`);
  if (filled(s.pyStageTransition) && s.pyStageTransition !== 'automatic') a.push(`transition ${s.pyStageTransition}`);
  return a.length ? ` (${a.join(', ')})` : '';
}
