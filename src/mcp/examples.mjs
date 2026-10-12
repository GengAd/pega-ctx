// The examples of the server's rule skills, read from the plugin's files: a template for a type the
// application has no rule of yet. A top-level example (rules-<class>/examples/<name>.md) is a complete
// rule: front matter (name, description), one ```json block, then notes. The examples in
// sub-folders are parts (a step, a row) and are not offered as templates.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { skillsFolder } from './schemas.mjs';
import { writable } from './tools.mjs';

// (options) → { list(type), read(type, name) }; options.folder replaces the plugin's skills folder.
export function pluginExamples({ folder } = {}) {
  const base = () => folder ?? skillsFolder();
  const dirOf = (type) => {
    const w = writable(type);
    if (!w) throw new Error(`the Pega MCP has no skill for ${type}: no example, and create-rule refuses it`);
    return join(base(), w.skill, 'examples');
  };
  return {
    list(type) {
      const dir = dirOf(type);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort((a, b) => (a === 'stub.md' ? -1 : b === 'stub.md' ? 1 : a.localeCompare(b)))
        .map((f) => ({ name: f.replace(/\.md$/, ''), ...frontMatter(readFileSync(join(dir, f), 'utf8')) }));
    },
    read(type, name = 'stub') {
      const file = join(dirOf(type), `${name}.md`);
      if (!existsSync(file)) {
        const known = this.list(type).map((e) => e.name);
        throw new Error(`no example ${name} for ${type}${known.length ? `: one of ${known.join(', ')} (pega-ctx examples ${type})` : ''}`);
      }
      return parseExample(readFileSync(file, 'utf8'), `${type} example ${name}`);
    },
  };
}

function frontMatter(text) {
  const m = /^---\n([^]*?)\n---/.exec(text);
  const field = (k) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(m?.[1] ?? '')?.[1]?.trim() ?? '';
  return { label: field('name'), description: field('description') };
}

// { label, description, content, notes }: content is the JSON of the example, notes its text after it.
export function parseExample(text, what = 'example') {
  const m = /```json\n([^]*?)\n```/.exec(text);
  if (!m) throw new Error(`${what}: no JSON block, the plugin's file is not a rule template`);
  let content;
  try {
    content = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${what}: unreadable JSON (${e.message})`);
  }
  const notes = text.slice(m.index + m[0].length).replace(/^\s*## Notes\s*/i, '').trim();
  return { ...frontMatter(text), content, notes };
}
