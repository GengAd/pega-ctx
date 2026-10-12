// Section (UI-Kit): the layouts in order, their cells (field, included section, label),
// the data pages used as list sources. Fields read on the fixture: pySections → pySectionBody →
// pyTable.pyRows[].pyCells[], recursive through the cells' pySections (docs/projection.md).
import { filled, items, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const lines = [];
  if (filled(o.pyPreDataTransform?.pyName)) {
    lines.push(`data transform before display: ${o.pyPreDataTransform.pyName}`);
    refs.add('DataTransform', o.pyClassName, o.pyPreDataTransform.pyName, 'pre data transform');
  }
  lines.push('', '## Layout');
  sections(items(o.pySections), 0, o.pyClassName, lines, refs);
  return { lines, references: refs.all() };
}

function sections(list, depth, cls, lines, refs) {
  for (const s of list) for (const b of items(s.pySectionBody)) layout(b, depth, cls, lines, refs);
}

function layout(b, depth, cls, lines, refs) {
  const indent = '  '.repeat(depth);
  const rowClass = b.pyRowPromptClass ?? b.pyPageListPropertyClass ?? cls;
  if (b.pyBodyType === 'INCLUDE' && filled(b.pyInclude)) {
    lines.push(`${indent}- section ${b.pyInclude}`);
    refs.add('Section', cls, b.pyInclude, 'included section');
    return;
  }
  const source = filled(b.pyPageListProperty) ? ` on ${b.pyPageListProperty}${rowClass !== cls ? ` (${rowClass})` : ''}` : '';
  lines.push(`${indent}- layout ${b.pyTable?.pyLayoutFormatType ?? b.pyBodyType}${source}`);
  if (filled(b.pyDPName)) refs.add('DataPage', rowClass, b.pyDPName, 'list source');
  if (filled(b.pyPreDataTransform?.pyName)) refs.add('DataTransform', cls, b.pyPreDataTransform.pyName, 'pre data transform');

  for (const row of items(b.pyTable?.pyRows)) {
    for (const cell of items(row.pyCells)) {
      const text = describeCell(cell, rowClass, refs);
      if (text) lines.push(`${indent}  - ${text}`);
      // A SUB_SECTION cell also carries the included section in pySections: not repeated.
      if (cell.pyType !== 'SUB_SECTION') sections(items(cell.pySections), depth + 2, cell.pyUsingPageClass ?? rowClass, lines, refs);
    }
  }
}

function describeCell(c, cls, refs) {
  const visible = c.pyUserData?.pyVisible;
  // pyVisible OTHER: condition written in pyCondition.
  const condition = !filled(visible) || visible === 'ALWAYS' ? ''
    : visible === 'OTHER' && filled(c.pyUserData.pyCondition) ? `, visible if ${c.pyUserData.pyCondition}`
    : `, visible ${visible}`;
  const readOnly = c.pyReadOnly === 'true' ? ', read-only' : '';
  if (c.pyType === 'SUB_SECTION' && filled(c.pyValue)) {
    const target = c.pyUsingPageClass ?? cls;
    refs.add('Section', target, c.pyValue, 'included section');
    return `section ${c.pyValue}${target !== cls ? ` (${target})` : ''}${condition}`;
  }
  if (String(c.pyValue ?? '').startsWith('.')) {
    refs.property(cls, c.pyValue, 'field');
    return `${c.pyValue}: ${c.pyType ?? 'field'}${readOnly}${condition}`;
  }
  if (filled(c.pyValue)) return `${(c.pyType ?? '').toLowerCase()} "${c.pyValue}"${condition}`;
  return '';
}
