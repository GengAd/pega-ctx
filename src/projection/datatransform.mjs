// DataTransform: the actions in order, nested, with target and source; pages and classes.
// Fields read on the fixture: pyProperties (recursive), pyPagesAndClasses (docs/projection.md).
import { filled, items, references, propertyName } from './common.mjs';

const VERBS = {
  SET: (a) => `${a.pyPropertiesName} = ${a.pyPropertiesValue}`,
  APPEND_TO: (a) => `append to ${a.pyPropertiesName}: ${a.pyPropertiesValue}`,
  APPEND_AND_MAP_TO: (a) => `append and map to ${a.pyPropertiesName}: ${a.pyPropertiesValue}`,
  FOR_EACH_PAGE_IN: (a) => `for each page in ${a.pyPropertiesName}`,
};

export function body(o) {
  const refs = references();
  const pages = Object.fromEntries(items(o.pyPagesAndClasses).map((p) => [p.pyPagesAndClassesPage, p.pyPagesAndClassesClass]));
  const lines = [];
  if (o.pyCallSuperClassModel === 'true') lines.push('', 'calls the parent class data transform first');

  lines.push('', '## Actions');
  const walk = (actions, depth, cls) => {
    for (const a of actions) {
      const verb = VERBS[a.pyActionName] ?? ((x) => [x.pyActionName, x.pyPropertiesName, x.pyPropertiesValue].filter(filled).join(' '));
      const disabled = a.pyDisabled === 'true' ? ' (disabled)' : '';
      lines.push(`${'  '.repeat(depth)}- ${a.pyPropertyStepId} ${verb(a)}${disabled}`);
      refs.property(cls, a.pyPropertiesName, 'target');
      if (/^D_\w+$/.test(a.pyPropertiesValue ?? '')) refs.add('DataPage', cls, a.pyPropertiesValue, 'source');
      else if (String(a.pyPropertiesValue ?? '').startsWith('.')) refs.property(cls, a.pyPropertiesValue, 'source');
      // Inside a loop or a mapping, the context becomes the class of the iterated page.
      const page = propertyName(a.pyPropertiesName);
      walk(items(a.pyProperties), depth + 1, pages[page] ?? cls);
    }
  };
  walk(items(o.pyProperties), 0, o.pyClassName);

  const declared = Object.entries(pages).filter(([page, cls]) => filled(page) && filled(cls));
  if (declared.length) lines.push('', `pages: ${declared.map(([p, c]) => `${p} (${c})`).join(', ')}`);
  return { lines, references: refs.all() };
}
