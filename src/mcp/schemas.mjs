// The JSON Schemas the Pega MCP validates writes against, read from the plugin's files, without Java.
// Location as the server reads it: ${PEGA_SKILLS_PATH}/<pega_infinity_version>/skills/rules-*/schema/*.json
// (docs/mcp-tools.md § create and update).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { commandFromPlugin } from './client.mjs';
import { WRITABLE } from './types.mjs';

const SERVER_CONFIG = join(homedir(), '.infinity-rules-mcp/config.json');

// Folder of the skills for the configured Infinity version, e.g. <plugin>/resources/26-1/skills.
export function skillsFolder({ skillsPath, version } = {}) {
  const base = skillsPath ?? commandFromPlugin().env.PEGA_SKILLS_PATH;
  if (!base || !existsSync(base)) throw new Error(`Pega skills folder not found (${base}): reinstall the Pega plugin`);
  const v = version ?? serverVersion() ?? highest(base);
  const folder = join(base, v, 'skills');
  if (!existsSync(folder)) throw new Error(`no skills for Infinity ${v} in ${base}: check pega_infinity_version in ${SERVER_CONFIG}`);
  return folder;
}

function serverVersion() {
  try {
    return JSON.parse(readFileSync(SERVER_CONFIG, 'utf8')).pega_infinity_version;
  } catch {
    return undefined;
  }
}

function highest(base) {
  return readdirSync(base).filter((d) => /^\d+-\d+$/.test(d)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);
}

// Every schema of the folder: [{ ruleClass, skill, file, schema }], sorted by rule class.
export function readSchemas(folder = skillsFolder()) {
  const all = [];
  for (const skill of readdirSync(folder).filter((d) => d.startsWith('rules-')).sort()) {
    const dir = join(folder, skill, 'schema');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const schema = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      all.push({ ruleClass: schema.title, skill, file: `${skill}/schema/${f}`, schema });
    }
  }
  return all.sort((a, b) => a.ruleClass.localeCompare(b.ruleClass));
}

// Loader of the schema of a type, for the lint: (type) → { schema, file } or { missing: why }.
// Never throws: without the plugin, the lint runs pega-ctx's own checks only.
export function pluginSchemas(options) {
  const cache = new Map();
  let folder;
  return (type) => {
    if (cache.has(type)) return cache.get(type);
    const w = WRITABLE.find((x) => x.type === type);
    let r;
    if (!w) r = { missing: `the Pega MCP has no schema for ${type}` };
    else {
      try {
        folder ??= skillsFolder(options);
        r = { schema: JSON.parse(readFileSync(join(folder, w.schema), 'utf8')), file: w.schema };
      } catch (e) {
        r = { missing: e.message };
      }
    }
    cache.set(type, r);
    return r;
  };
}

// Fields that hold a rule's name when the schema says nothing (no x-pega-deriveFrom), in order.
const NAME_FIELDS = ['pyActivityName', 'pyStreamName', 'pyPurpose', 'pyRuleName'];

// The field(s) the rule's name comes from. The schema says it with x-pega-deriveFrom on pyRuleName
// (or pyRuleSet for rulesets): one field, or several joined by a space (`pyOwner + ' ' + pyPurpose`).
// Otherwise the first required name field.
export function keyOf(schema) {
  const props = schema.properties ?? {};
  const derive = props.pyRuleName?.['x-pega-deriveFrom'] ?? props.pyRuleSet?.['x-pega-deriveFrom'];
  if (typeof derive === 'string') {
    const fields = derive.split('+').map((s) => s.trim()).filter((s) => /^p[xyz]\w+$/.test(s));
    if (fields.length) return fields;
  }
  const required = new Set(schema.required ?? []);
  return [NAME_FIELDS.find((f) => required.has(f)) ?? 'pyRuleName'];
}
