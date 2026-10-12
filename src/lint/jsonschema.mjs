// JSON Schema (draft 2020-12), the part the Pega MCP's schemas use, without a dependency:
// type, enum, const, required, properties, additionalProperties, items, $ref (#/$defs/… only),
// allOf, anyOf, oneOf, not, if/then/else, pattern, min/maxLength, min/maxItems, contains,
// minProperties, dependentRequired. The x-pega-* extensions: x-pega-condition is the message of a
// sub-schema that fails; x-pega-autoFill or x-pega-autoDerived on a required field means the server
// fills it when absent.
// The keywords listed in docs/mcp-tools.md were counted on the 37 schemas of 26-1.

// validate(value, schema) → [{ pointer, message }], pointer as in JSON Pointer ("/pyCondition/0/pyLogic").
export function validate(value, schema) {
  const errors = [];
  check(value, schema, schema, '', errors);
  return errors;
}

function resolve(s, root) {
  let guard = 0;
  while (s && typeof s === 'object' && typeof s.$ref === 'string' && guard++ < 20) {
    if (!s.$ref.startsWith('#/')) throw new Error(`schema: $ref ${s.$ref} not supported (only #/…)`);
    const target = s.$ref.slice(2).split('/').reduce((o, k) => o?.[k.replaceAll('~1', '/').replaceAll('~0', '~')], root);
    if (!target) throw new Error(`schema: $ref ${s.$ref} points to nothing`);
    // Keywords next to $ref apply too (2020-12).
    const { $ref, ...rest } = s;
    s = Object.keys(rest).length ? { allOf: [target], ...rest } : target;
  }
  return s;
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const matchesType = (v, t) => t === typeOf(v) || (t === 'number' && typeof v === 'number');
const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));
const child = (pointer, k) => `${pointer}/${String(k).replaceAll('~', '~0').replaceAll('/', '~1')}`;

function check(v, s, root, pointer, errors) {
  if (s === true || s === undefined) return true;
  if (s === false) {
    errors.push({ pointer, message: 'not allowed here: remove it' });
    return false;
  }
  s = resolve(s, root);
  const before = errors.length;
  const sub = [];
  checkKeywords(v, s, root, pointer, sub);
  // A sub-schema that carries its own explanation: that sentence instead of the details.
  if (sub.length && s['x-pega-condition']) errors.push({ pointer, message: s['x-pega-condition'] });
  else errors.push(...sub);
  return errors.length === before;
}

function checkKeywords(v, s, root, pointer, errors) {
  if (s.type !== undefined) {
    const types = [s.type].flat();
    if (!types.some((t) => matchesType(v, t))) {
      errors.push({ pointer, message: `expected ${types.join(' or ')}, found ${typeOf(v)}${typeof v === 'string' ? ` ${show(v)}` : ''}` });
      return;
    }
  }
  if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) errors.push({ pointer, message: `must be ${show(s.const)}, not ${show(v)}` });
  if (Array.isArray(s.enum) && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) {
    errors.push({ pointer, message: `${show(v)} is not allowed: one of ${s.enum.map(show).join(', ')}` });
  }
  if (typeof v === 'string') {
    if (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(v)) errors.push({ pointer, message: `${show(v)} does not match ${s.pattern}` });
    if (s.minLength !== undefined && [...v].length < s.minLength) errors.push({ pointer, message: `at least ${s.minLength} characters` });
    if (s.maxLength !== undefined && [...v].length > s.maxLength) errors.push({ pointer, message: `at most ${s.maxLength} characters, found ${[...v].length}` });
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errors.push({ pointer, message: `at least ${s.minItems} entries, found ${v.length}` });
    if (s.maxItems !== undefined && v.length > s.maxItems) errors.push({ pointer, message: `at most ${s.maxItems} entries, found ${v.length}` });
    if (s.items !== undefined) v.forEach((x, i) => check(x, s.items, root, child(pointer, i), errors));
    if (s.contains !== undefined && !v.some((x) => check(x, s.contains, root, pointer, []))) {
      errors.push({ pointer, message: s.contains['x-pega-condition'] ?? 'no entry has the expected shape' });
    }
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const autoFilled = (k) => {
      const p = resolve(s.properties?.[k], root);
      return p?.['x-pega-autoFill'] !== undefined || p?.['x-pega-autoDerived'] === true;
    };
    for (const k of s.required ?? []) {
      if (!(k in v) && !autoFilled(k)) errors.push({ pointer, message: `missing field ${k}: add it` });
    }
    for (const [k, needed] of Object.entries(s.dependentRequired ?? {})) {
      if (k in v) for (const n of needed) if (!(n in v)) errors.push({ pointer, message: `${k} needs ${n}: add it` });
    }
    if (s.minProperties !== undefined && Object.keys(v).length < s.minProperties) errors.push({ pointer, message: `at least ${s.minProperties} fields` });
    for (const [k, x] of Object.entries(v)) {
      if (s.properties && k in s.properties) check(x, s.properties[k], root, child(pointer, k), errors);
      else if (s.additionalProperties !== undefined) {
        if (s.additionalProperties === false) errors.push({ pointer: child(pointer, k), message: `unknown field ${k} for this schema: remove it` });
        else check(x, s.additionalProperties, root, child(pointer, k), errors);
      }
    }
  }
  for (const x of s.allOf ?? []) check(v, x, root, pointer, errors);
  if (s.anyOf) choice(v, s.anyOf, root, pointer, errors, (passing) => passing >= 1);
  if (s.oneOf) choice(v, s.oneOf, root, pointer, errors, (passing) => passing === 1);
  if (s.not !== undefined && check(v, s.not, root, pointer, [])) {
    errors.push({ pointer, message: s.not['x-pega-condition'] ?? describeNot(s.not, root) });
  }
  if (s.if !== undefined) {
    const branch = check(v, s.if, root, pointer, []) ? s.then : s.else;
    if (branch !== undefined) check(v, branch, root, pointer, errors);
  }
}

function describeNot(n, root) {
  const r = resolve(n, root);
  if (Array.isArray(r.required) && r.required.length) return `${r.required.join(', ')} not allowed here: remove ${r.required.length > 1 ? 'them' : 'it'}`;
  return 'matches a shape that is not allowed here';
}

// anyOf / oneOf: if no branch passes, the errors of the closest branch (fewest errors).
function choice(v, branches, root, pointer, errors, ok) {
  const results = branches.map((b) => {
    const e = [];
    check(v, b, root, pointer, e);
    return e;
  });
  const passing = results.filter((e) => !e.length).length;
  if (ok(passing)) return;
  if (passing > 1) return void errors.push({ pointer, message: `matches ${passing} of the allowed shapes, exactly one expected` });
  // Ties: a branch whose type does not even match the value is the farthest.
  const score = (e) => e.length + (e.some((x) => x.pointer === pointer && x.message.startsWith('expected ')) ? 0.5 : 0);
  const closest = results.reduce((a, b) => (score(b) < score(a) ? b : a));
  errors.push(...closest);
}

// The raw rule keeps as strings what Pega stores as strings ("10", "true"); where the schema expects
// an integer, a number or a boolean, the value is converted. Follows properties, items, $ref and allOf
// only: a branch of anyOf or if/then is not known in advance.
export function fitTypes(v, s, root = s) {
  if (!s || typeof s !== 'object') return v;
  s = resolve(s, root);
  for (const x of s.allOf ?? []) v = fitTypes(v, x, root);
  const types = [s.type].flat().filter(Boolean);
  if (typeof v === 'string' && types.length === 1) {
    if (types[0] === 'integer' && /^-?\d+$/.test(v)) return Number(v);
    if (types[0] === 'number' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    if (types[0] === 'boolean' && (v === 'true' || v === 'false')) return v === 'true';
  }
  if (Array.isArray(v) && s.items) return v.map((x) => fitTypes(x, s.items, root));
  if (v && typeof v === 'object' && !Array.isArray(v) && s.properties) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k in s.properties ? fitTypes(x, s.properties[k], root) : x]));
  }
  return v;
}
