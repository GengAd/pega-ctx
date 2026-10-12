// Helpers shared by the projections. None reads Pega: they receive the decoded raw rule.
import { TYPES } from '../mcp/tools.mjs';
import { shortName } from '../mcp/names.mjs';

// TYPES can grow (types of .pega/config.json): looked up at each call. Any other rule class
// still gets its short name: nothing is left out of the mirror for lack of a type.
export function typeOfRaw(o) {
  const known = Object.entries(TYPES).find(([, cls]) => cls === o.pxObjClass);
  if (known) return known[0];
  return /^Rule-[\w-]+$/.test(o.pxObjClass ?? '') ? shortName(o.pxObjClass) : undefined;
}

export function ruleId(type, cls, name) {
  return `${type}:${cls}:${name}`;
}

// Useful value: neither empty nor "false". Pega stores everything as strings.
export function filled(v) {
  return v !== undefined && v !== null && v !== '' && v !== 'false';
}

export function items(v) {
  return Array.isArray(v) ? v : [];
}

// Standard Pega properties (px, py, pz): no reference, they are not in the application.
export function isAppProperty(name) {
  return /^[A-Za-z_]\w*$/.test(name) && !/^p[xyz][A-Z]/.test(name);
}

// `.Name` or `Primary.Name` → Name; otherwise undefined.
export function propertyName(value) {
  const m = /^(?:Primary)?\.([A-Za-z_]\w*)$/.exec(String(value ?? '').trim());
  return m?.[1];
}

// Inheritance by name pattern: MyOrg-App-Work is a parent of MyOrg-App-Work-Case.
// The Pega engine decides (directed inheritance, circumstancing); here, only what the name says.
export function isParentClass(parent, cls) {
  if (parent === '@baseclass' || parent === cls) return true;
  return parent.endsWith('-') ? cls.startsWith(parent) : cls.startsWith(`${parent}-`);
}

// To sort parent classes from the closest to the farthest: @baseclass always last.
export function classDepth(cls) {
  return cls === '@baseclass' ? -1 : cls.length;
}

// Reference collector of a projection: deduplicates by identifier, keeps the first `via`.
export function references() {
  const seen = new Map();
  return {
    // extra: details kept on the edge (stage of a CaseType process).
    add(type, cls, name, via, extra = {}) {
      if (!type || !cls || !name) return;
      const id = ruleId(type, cls, name);
      if (!seen.has(id)) seen.set(id, { to: id, via, confidence: 'sure', ...extra });
    },
    property(cls, value, via) {
      const name = propertyName(value);
      if (name && isAppProperty(name)) this.add('Property', cls, name, via);
    },
    all: () => [...seen.values()],
  };
}
