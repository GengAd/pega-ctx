// Flow: the shapes in graph order from Start, each with its outgoing connectors.
// Fields read on the fixture: pyModelProcess.pyShapes / pyConnectors, pyLocalActions (docs/projection.md).
import { filled, items, references } from './common.mjs';

const CONDITIONS = { Always: 'always', Action: 'action' };

export function body(o) {
  const refs = references();
  const cls = o.pyClassName;
  const model = o.pyModelProcess ?? {};
  const shapes = model.pyShapes ?? {};
  const connectors = Object.values(model.pyConnectors ?? {});
  const outgoing = (id) => connectors.filter((c) => c.pyFrom === id);

  // Breadth-first walk from the start shape; isolated shapes come last.
  const order = [];
  const queue = [o.pyStartActivity ?? Object.keys(shapes).find((id) => shapes[id].pxObjClass?.startsWith('Data-MO-Event-Start'))];
  while (queue.length) {
    const id = queue.shift();
    if (!id || order.includes(id) || !shapes[id]) continue;
    order.push(id);
    queue.push(...outgoing(id).map((c) => c.pyTo));
  }
  order.push(...Object.keys(shapes).filter((id) => !order.includes(id)));

  const lines = [];
  if (filled(o.pyCategory) && o.pyCategory !== 'FlowStandard') lines.push(`category: ${o.pyCategory}`);
  lines.push('', '## Shapes');
  order.forEach((id, i) => {
    const s = shapes[id];
    lines.push(`${i + 1}. ${id}: ${describeShape(s, cls, refs)}`);
    for (const c of outgoing(id)) {
      lines.push(`   → ${c.pyTo}${condition(c)}`);
      if (c.pyConditionType === 'Action' && filled(c.pyMOName)) refs.add('FlowAction', cls, c.pyMOName, 'assignment');
    }
  });

  const local = items(o.pyLocalActions).map((a) => a.pyActionName).filter(filled);
  if (local.length) {
    lines.push('', `local actions: ${local.join(', ')}`);
    for (const name of local) refs.add('FlowAction', cls, name, 'local action');
  }
  return { lines, references: refs.all() };
}

function describeShape(s, cls, refs) {
  const name = filled(s.pyMOName) ? s.pyMOName : '';
  switch (s.pxObjClass) {
    case 'Data-MO-Event-Start':
      return 'start';
    case 'Data-MO-Event-End':
      return 'end';
    case 'Data-MO-Activity-Assignment':
      return `assignment ${name}${filled(s.pyRouteTo) ? `, routed to ${s.pyRouteTo}` : ''}`;
    case 'Data-MO-Activity-Utility':
      if (filled(s.pyImplementation)) refs.add('Activity', s.pyBaseClass ?? cls, s.pyImplementation, 'utility');
      return `utility ${name}, activity ${s.pyImplementation}`;
    default:
      // Shape absent from the fixture: its type and implementation, without guessing the reference.
      return [s.pyFromMODefName ?? s.pxObjClass, name, filled(s.pyImplementation) ? `(${s.pyImplementation})` : '']
        .filter(Boolean)
        .join(' ');
  }
}

function condition(c) {
  const type = CONDITIONS[c.pyConditionType] ?? c.pyConditionType;
  if (c.pyConditionType === 'Always') return '';
  return ` (${type}${filled(c.pyExpression) ? ` ${c.pyExpression}` : ''})`;
}
