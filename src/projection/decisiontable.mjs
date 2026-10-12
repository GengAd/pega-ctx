// DecisionTable: condition columns, result columns, the rows, the default result.
// Fields read on the fixture: pyColumns[] (pyProperty, pyPropertyLabel, pyDefaultOperator,
// pyCondition[]: one value per row), pyPropertyColumns[] (pyPropertyValues[]), pyResults[],
// pyDefaultResult (docs/projection.md).
import { filled, items, references } from './common.mjs';
import { propertyRoot } from './condition.mjs';

const cell = (v) => String(v ?? '').replaceAll('|', '\\|');

export function body(o) {
  const refs = references();
  const cls = o.pyClassName;
  const conditions = items(o.pyColumns).filter((c) => filled(c.pyProperty));
  const sets = items(o.pyPropertyColumns).filter((c) => filled(c.pyProperty));
  const results = items(o.pyResults);
  const rowCount = Math.max(results.length, ...conditions.map((c) => items(c.pyCondition).length), 0);

  const header = [...conditions.map((c) => `${c.pyPropertyLabel || c.pyProperty} (${c.pyProperty})`), ...sets.map((c) => `${c.pyPropertyLabel || c.pyProperty} (${c.pyProperty}) ←`), 'result'];
  const lines = [];
  if (filled(o.pyDescription)) lines.push('', o.pyDescription);
  lines.push('', `| ${header.map(cell).join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
  for (let i = 0; i < rowCount; i++) {
    const values = [
      ...conditions.map((c) => {
        const v = items(c.pyCondition)[i];
        return filled(v) ? `${c.pyDefaultOperator ?? '='} ${v}` : '';
      }),
      ...sets.map((c) => items(c.pyPropertyValues)[i] ?? ''),
      results[i] ?? '',
    ];
    lines.push(`| ${values.map(cell).join(' | ')} |`);
  }
  // "false" is a real result here: no filled(), which treats it as empty.
  const fallback = o.pyDefaultResult ?? '';
  lines.push('', `otherwise: ${fallback !== '' ? fallback : '(no result)'}`);

  for (const c of [...conditions, ...sets]) {
    const name = propertyRoot(c.pyProperty);
    if (name) refs.property(cls, `.${name}`, 'column');
  }
  return { lines, references: refs.all() };
}
