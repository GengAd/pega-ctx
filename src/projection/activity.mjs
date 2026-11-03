// Activity: the steps in order (nested), each: method, page, non-empty parameters,
// repetition, condition, description. Fields read on the fixture: pySteps[] (recursive),
// pyStepsCallParams, pyParamArray, pyStepsRepeatDef, pyPagesAndClasses (docs/projection.md).
import { filled, items, references, propertyName } from './common.mjs';

const REPETITIONS = { EMBEDDED: 'for each page' };

// Not parameters: what Pega stores with them, Property-Set's placeholder (pyTempPlaceHolder) and the
// platform fields (px*, pz*) a step saved from Dev Studio carries, such as pxCreateDateTime.
const parameter = ([k, v]) => k !== 'pyTempPlaceHolder' && !/^p[xz]/.test(k) && typeof v === 'string' && filled(v);

export function body(o) {
  const refs = references();
  const pages = Object.fromEntries(items(o.pyPagesAndClasses).filter((p) => filled(p.pyPagesAndClassesPage)).map((p) => [p.pyPagesAndClassesPage, p.pyPagesAndClassesClass]));
  const lines = [];
  if (filled(o.pyDescription)) lines.push('', o.pyDescription);
  if (filled(o.pyActivityType) && o.pyActivityType !== 'ACTIVITY') lines.push('', `type: ${o.pyActivityType}`);
  const parameters = items(o.pyParameters).map((p) => p.pyParametersParamName).filter(filled);
  if (parameters.length) lines.push(`parameters: ${parameters.join(', ')}`);

  lines.push('', '## Steps');
  // A step with no page runs on the page of its parent: the iterated page in a loop for each page.
  const walk = (steps, prefix, depth, parentClass) => {
    steps.forEach((s, i) => {
      const number = `${prefix}${i + 1}`;
      const page = filled(s.pyStepsObjectName) ? s.pyStepsObjectName : '';
      const cls = page ? pages[page] ?? o.pyClassName : parentClass;
      const method = filled(s.pyStepsActivityName) ? s.pyStepsActivityName : 'group';
      const repetition = REPETITIONS[s.pyStepsRepeatDef?.pyStepsRepeatDefHasRepeat] ?? (filled(s.pyStepsRepeatDef?.pyStepsRepeatDefHasRepeat) ? s.pyStepsRepeatDef.pyStepsRepeatDefHasRepeat : '');
      const when = items(s.pyStepsPreCondParams).map((c) => c.pyStepsPreCondParamsWhen).filter(filled);
      const head = [`${method}${page ? ` on ${page}` : ''}`, repetition, when.length ? `if ${when.join(' and ')}` : ''].filter(Boolean).join(', ');
      lines.push(`${'  '.repeat(depth)}${number}. ${head}${filled(s.pyStepsDescription) ? ` — ${s.pyStepsDescription}` : ''}`);

      const callParams = Object.entries(s.pyStepsCallParams ?? {}).filter(parameter);
      const arrayParams = items(s.pyParamArray).flatMap((p) => Object.entries(p).filter(parameter));
      const params = [...callParams, ...arrayParams];
      if (params.length) lines.push(`${'  '.repeat(depth + 1)}${params.map(([k, v]) => `${k} ${v}`).join(', ')}`);
      stepReferences(refs, cls, callParams, arrayParams);
      const loopClass = s.pyStepsRepeatDef?.pyStepsRepeatDefHasRepeat === 'EMBEDDED' ? items(s.pyStepsRepeatDef.pyForEachValidClasses).find((c) => filled(c.pyForEachClass))?.pyForEachClass : undefined;
      walk(items(s.pySteps), `${number}.`, depth + 1, loopClass ?? cls);
    });
  };
  walk(items(o.pySteps), '', 0, o.pyClassName);
  return { lines, references: refs.all() };
}

// Methods of the fixture whose parameter names a rule: Apply-DataTransform (DataTransform),
// Save-DataPage (DataPage). The others go through generic detection.
function stepReferences(refs, pageClass, callParams, arrayParams) {
  const p = Object.fromEntries(callParams);
  if (filled(p.DataTransform)) refs.add('DataTransform', pageClass, p.DataTransform, 'apply');
  if (filled(p.DataPage)) refs.add('DataPage', pageClass, p.DataPage, 'data page');
  for (const [k, v] of arrayParams) {
    if (/^Propert(y|iesName)$/.test(k)) {
      const name = propertyName(String(v).replace(/\(.*$/, ''));
      if (name) refs.property(pageClass, `.${name}`, 'step');
    }
  }
}
