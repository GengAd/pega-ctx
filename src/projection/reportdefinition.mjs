// ReportDefinition: queried class, columns (with sort), filters, joins, groupings.
// Fields read on the fixture: pyContent.pyClassName, pyContent.pyFields.pyListFields[],
// pyFilters.pyFilter[], pySource.pyJoinInfo[], pyMaxRecords (docs/projection.md).
// Filters and joins are empty in the fixture: rendered by their non-empty fields.
import { filled, items, references } from './common.mjs';

const scalars = (x) => Object.entries(x ?? {}).filter(([k, v]) => k !== 'pxObjClass' && typeof v === 'string' && filled(v)).map(([k, v]) => `${k} ${v}`).join(', ');

export function body(o) {
  const refs = references();
  const c = o.pyContent ?? {};
  const cls = c.pyClassName ?? o.pyClassName;
  const lines = [];
  if (filled(o.pyDescription) && o.pyDescription !== o.pyLabel) lines.push('', o.pyDescription);
  lines.push('', `queried class: ${cls}${filled(c.pyMaxRecords) ? `, ${c.pyMaxRecords} rows at most` : ''}`);

  const columns = items(c.pyFields?.pyListFields);
  if (columns.length) lines.push('', '## Columns');
  for (const f of columns) {
    // pySortOrder 99999: unsorted column (all unsorted columns of the fixture).
    const sort = filled(f.pySortOrder) && f.pySortOrder !== '99999' ? `, sort ${f.pySortOrder} ${f.pySortType ?? ''}`.trimEnd() : '';
    lines.push(`- ${f.pyFieldName}${filled(f.pyFieldLabel) ? ` "${f.pyFieldLabel}"` : ''}${sort}`);
    refs.property(cls, f.pyFieldName, 'column');
  }
  const groups = [
    ['Group by', items(c.pyFields?.pyGroupBy)],
    ['Aggregates', items(c.pyFields?.pyAggregate)],
    ['Filters', items(c.pyFilters?.pyFilter)],
    ['Joins', items(c.pySource?.pyJoinInfo)],
  ];
  for (const [title, entries] of groups) {
    if (!entries.length) continue;
    lines.push('', `## ${title}`, ...entries.map((e) => `- ${scalars(e)}`));
  }
  return { lines, references: refs.all() };
}
