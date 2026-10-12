// FlowAction: displayed form (view or section), processing before and after, validation, conditions.
// Fields read on the fixture; their role (pre / post) comes from the server skill rules-rule-obj-flowaction
// (docs/projection.md). pyPreProcessingActivity and pyLocalActionActivity are absent from the fixture.
import { filled, items, references } from './common.mjs';

const STEPS = [
  ['pyPreProcessingActivity', 'before display, activity', 'Activity', 'pre activity'],
  ['pyPreProcessingTransformRule', 'before display, data transform', 'DataTransform', 'pre data transform'],
  ['pyValidateActivity', 'on submit, validate', 'Validate', 'validate'],
  ['pyActionTransformRule', 'after submit, data transform', 'DataTransform', 'post data transform'],
  ['pyLocalActionActivity', 'after submit, activity', 'Activity', 'post activity'],
];

const USAGES = {
  LOCALACTION: 'local action',
  LOCALANDCONNECTOR: 'local action and connector',
  CONNECTORACTION: 'connector',
};

export function body(o) {
  const refs = references();
  const cls = o.pyClassName;
  const lines = [''];
  if (filled(o.pyViewReference)) {
    lines.push(`view: ${o.pyViewReference}`);
    refs.add('View', cls, o.pyViewReference, 'view');
  }
  if (filled(o.pySectionReference)) {
    lines.push(`section: ${o.pySectionReference}`);
    refs.add('Section', cls, o.pySectionReference, 'section');
  }
  for (const [field, label, type, via] of STEPS) {
    if (!filled(o[field])) continue;
    lines.push(`${label}: ${o[field]}`);
    refs.add(type, cls, o[field], via);
  }
  const when = items(o.pyActionWhensList).map((w) => w.pyWhenName).filter(filled);
  if (when.length) {
    lines.push(`visible if: ${when.join(' and ')}`);
    for (const w of when) refs.add('When', cls, w, 'condition');
  }
  const privileges = items(o.pyActionPrivilegeList).map((p) => p.pyPrivilegeName).filter(filled);
  if (privileges.length) lines.push(`privileges: ${privileges.join(', ')}`);
  if (filled(o.pyUsedAs)) lines.push(`usage: ${USAGES[o.pyUsedAs] ?? o.pyUsedAs}`);
  return { lines, references: refs.all() };
}
