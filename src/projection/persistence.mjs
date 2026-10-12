// Persistence fields: what the projection never shows and what `create` strips from the template.
// Read on the fixture (docs/projection.md § Common): instance keys, operators and dates,
// warnings, reference indexes recomputed on save, generated code.
const PX_DROPPED = new Set([
  'pxUpdateOperator', 'pxUpdateDateTime', 'pxCreateDateTime', 'pxCreateOperator', 'pxCreateOpName', 'pxCreateSystemID',
  'pxWarnings', 'pxAPIMethodReferences', 'pxNamedPageReferences', 'pxDataReferences', 'pxSavedInPegaVersion',
  'pxMoveFromSystem', 'pxCreatedInPRPCVersion', 'pxServerReqURI', 'pxCurrentTab',
]);
const PY_DROPPED_ROOT = new Set([
  'pyJavaClassName', 'pyJavaStream', 'pyJavaGenerateAPIVersion', 'pyJavaGenerateTime', 'pyJavaGenerateVersion', 'pyJavaFUAVersion',
  'pyXMLSignature', 'pyTaskStatusXml', 'pyVisioJpeg', 'pyVisioRFB', 'pySPRuleSetName', 'pyPreviousValues', 'pySourceStream',
  'pyRuleSet', 'pyRuleSetVersion', 'pyValueChanged',
]);

// keep: the pz* fields a type uses as real content ({ root, nested }, from declaredPz), not dropped.
export function isDroppedField(key, root, keep) {
  if (keep && (root ? keep.root : keep.nested).has(key)) return false;
  return key.startsWith('pz') || PX_DROPPED.has(key) || (root && PY_DROPPED_ROOT.has(key));
}

// Copy of the decoded raw rule without its persistence fields, at any depth (nested pz* fields
// point to the old instance). pxObjClass stays: nested pages need it.
export function withoutPersistence(o, root = true, keep = undefined) {
  if (Array.isArray(o)) return o.map((x) => withoutPersistence(x, false, keep));
  if (!o || typeof o !== 'object') return o;
  return Object.fromEntries(Object.entries(o).filter(([k]) => !isDroppedField(k, root, keep)).map(([k, v]) => [k, withoutPersistence(v, false, keep)]));
}

// Some types hold real content in pz* fields (Notification pzRecipients, AI agent pzActionTools,
// report columns pzIndexCount). The server's schema says which: a pz* property it declares with a type.
// DataTransform's schema also lists persistence fields, untyped ({}), only to allow them: not kept.
// The instance keys stay dropped whatever the schema says. Declared at the top level → root;
// anywhere else → nested.
const IDENTITY = new Set(['pzInsKey', 'pzOriginalInstanceKey']);
export function declaredPz(schema) {
  const keep = { root: new Set(), nested: new Set() };
  const walk = (s, atRoot) => {
    if (Array.isArray(s)) return s.forEach((x) => walk(x, atRoot));
    if (!s || typeof s !== 'object') return;
    for (const [k, v] of Object.entries(s.properties ?? {})) {
      if (k.startsWith('pz') && !IDENTITY.has(k) && v && typeof v === 'object' && (v.type || v.$ref || v.items)) (atRoot ? keep.root : keep.nested).add(k);
      walk(v, false);
    }
    for (const k of ['allOf', 'anyOf', 'oneOf', 'if', 'then', 'else', 'not']) if (s[k]) walk(s[k], atRoot);
    for (const k of ['$defs', 'items', 'additionalProperties', 'contains']) if (s[k] && typeof s[k] === 'object') walk(k === '$defs' ? Object.values(s[k]) : s[k], false);
  };
  walk(schema, true);
  return keep;
}
