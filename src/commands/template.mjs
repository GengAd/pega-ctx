// Building the content sent to create-rule from a sibling rule, and merging a patch.
// The model never writes a full rule JSON: it picks a template and describes the difference.
import { withoutPersistence } from '../projection/persistence.mjs';
import { TYPES, writable } from '../mcp/tools.mjs';
import { WRITABLE } from '../mcp/types.mjs';

const CLASS_FIELDS = ['pyClassName', 'pyWorkClass'];

// Fields that repeat the rule's name: the key fields of every writable type (from the server's
// schemas), pyRuleName and pyStreamName. Renamed with the rule if they held the old name.
// Not pyViewReference: a FlowAction and its view often share a name without being the same rule.
const NAME_FIELDS = [...new Set(['pyRuleName', 'pyStreamName', ...WRITABLE.filter((w) => w.key.length === 1).map((w) => w.key[0])])].filter((f) => !CLASS_FIELDS.includes(f));

// The key fields of a type and their values for a name. Several key fields (FieldValue:
// pyFieldName, pyFieldValue): the name holds them separated by a space, the first one has none.
export function keyValues(type, name) {
  const { key } = writable(type);
  if (key.length === 1) return { [key[0]]: name };
  const [first, ...rest] = name.split(' ');
  if (!rest.length) throw new Error(`a ${type} is named "${key.join(' ')}" (its key fields joined by a space), not ${name}`);
  return { [key[0]]: first, [key[1]]: rest.join(' ') };
}

// Deep merge: objects merge, an array in the patch replaces the whole array,
// null removes the field.
export function merge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch) || base === null || typeof base !== 'object' || Array.isArray(base)) {
    return patch;
  }
  const r = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete r[k];
    else r[k] = k in base ? merge(base[k], v) : v;
  }
  return r;
}

// template: the decoded raw rule of --from. Returns the content for create-rule.
// rename: [[old, new]]; any value equal to old, at any depth, becomes new
// (a flow action cited by a flow is cited in ten places).
// fields (View only): [{ property, component, pegaClass }]; the view shows these fields, in order.
// keep: the pz* fields the type's schema declares as content (declaredPz), not stripped as persistence.
// A type the Pega MCP cannot write (no key from a schema) is renamed through pyRuleName and pyStreamName:
// its content goes to a draft for Dev Studio (src/commands/manual.mjs).
export function prepareCreation(template, { type, class: cls, name, label, patch = {}, rename = [], fields, keep }) {
  const w = writable(type);
  if (type === 'CaseType' && name !== 'pyDefault') throw new Error(`a CaseType is always named pyDefault, not ${name}: change the class, not the name`);
  // Class, ClassMetadata: the rule is named after its class (key pyClassName).
  if (w?.key[0] === 'pyClassName' && name !== cls) throw new Error(`a ${type} carries its class as name: pega-ctx create ${type} ${cls} ${cls} --from …`);
  // A server example has no pyRuleName: its name is in the key field.
  const oldName = template.pyRuleName ?? (w && template[w.key[0]]);
  const oldClass = template.pyClassName;
  // The template's class becomes the new one everywhere (starting flow of a case type, work class…).
  const table = new Map([...(oldClass && oldClass !== cls ? [[oldClass, cls]] : []), ...rename]);
  // A server example has no pxObjClass either; it comes first, as in a raw rule.
  const content = { pxObjClass: TYPES[type], ...replaceValues(withoutPersistence(template, true, keep), table) };
  for (const field of NAME_FIELDS) if (field in content && content[field] === oldName) content[field] = name;
  for (const field of CLASS_FIELDS) if (content[field] === oldClass) content[field] = cls;
  if (w) Object.assign(content, keyValues(type, name));
  content.pyClassName = cls;
  content.pyLabel = label ?? name;
  // The template's description describes the template: replaced by the label, the patch can refine it.
  if ('pyDescription' in content) content.pyDescription = content.pyLabel;
  if (type === 'Class' && 'pyUsage' in content) content.pyUsage = content.pyLabel;
  if (type === 'View') renameView(content, name, cls);
  if (fields?.length) viewWithFields(content, { class: cls, name, fields });
  return merge(content, patch);
}

function replaceValues(o, table) {
  if (!table.size) return o;
  if (typeof o === 'string') return table.has(o) ? table.get(o) : o;
  if (Array.isArray(o)) return o.map((x) => replaceValues(x, table));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, replaceValues(v, table)]));
  return o;
}

// View component per property type (pyStringType): Integer read on the fixture,
// Text and Date in get-skill rules-rule-ui-view/examples/step-form-view.
export const COMPONENTS = {
  Text: { component: 'TextInput', pegaClass: 'Pega-UI-Content-Field-Text' },
  Integer: { component: 'Integer', pegaClass: 'Pega-UI-Content-Field-Integer' },
  Date: { component: 'Date', pegaClass: 'Pega-UI-Content-Field-Date' },
};

// A view holds its fields on three surfaces (server skill rules-rule-ui-view): pyContent (the source,
// the server recomputes pxViewMetadata from it), pxViewMetadata and pxContextMetadata. The fields
// of the template's region are replaced by the requested ones, on all three.
function viewWithFields(content, { class: cls, name, fields }) {
  const region = (content.pyContent ?? []).find((r) => Array.isArray(r.pyContent));
  if (!region) throw new Error('--fields: the template has no field region (pyContent): pick a form view (DefaultForm template)');
  region.pyPromptClass = cls;
  region.pyContent = fields.map((f) => ({
    pxObjClass: f.pegaClass,
    pyComponentName: f.component,
    pyFieldReference: f.property,
    pyLabel: `.${f.property}`,
    pyLabelOption: 'field',
    pyPromptClass: cls,
    pyValue: `.${f.property}`,
    pyValueWithoutAnnotation: `.${f.property}`,
  }));
  const meta = parseJson(content.pxViewMetadata) ?? { type: 'View', config: {}, children: [] };
  const regionMeta = (meta.children ?? []).find((n) => n.type === 'Region' && n.name === region.pyName) ?? (meta.children ?? []).find((n) => n.type === 'Region');
  const children = fields.map((f) => ({ config: { label: `@FL .${f.property}`, labelOption: 'default', value: `@P .${f.property}` }, type: f.component }));
  if (regionMeta) regionMeta.children = children;
  else meta.children = [{ name: region.pyName ?? 'Fields', type: 'Region', children }];
  meta.name = name;
  meta.config = { ...meta.config, ruleClass: cls, localeReference: `@LR ${cls.toUpperCase()}!VIEW!${name.toUpperCase()}` };
  content.pxViewMetadata = JSON.stringify(meta);
  const context = parseJson(content.pxContextMetadata) ?? {};
  context.$properties = fields.map((f) => `.${f.property}`);
  context.$fields = fields.map((f) => ({ name: `.${f.property}` }));
  content.pxContextMetadata = JSON.stringify(context);
}

function parseJson(text) {
  try {
    return typeof text === 'string' ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

// A view repeats its name and class in pxViewMetadata (JSON string), read on the fixture.
function renameView(content, name, cls) {
  if (typeof content.pxViewMetadata !== 'string') return;
  try {
    const meta = JSON.parse(content.pxViewMetadata);
    meta.name = name;
    if (meta.config?.ruleClass) meta.config.ruleClass = cls;
    content.pxViewMetadata = JSON.stringify(meta);
  } catch {
    // unreadable metadata: left as is, the server will refuse if needed.
  }
}
