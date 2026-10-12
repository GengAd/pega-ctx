// Reading and writing .pega/: config.json, stack.md, index.jsonl, graph.json, write.draft.json, digest/, raw/, drafts/.
// An identifier Type:Class:Name is stored as <Type>/<Class>/<Name>.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const FOLDER = '.pega';

export function paths(root = process.cwd()) {
  const base = join(root, FOLDER);
  return {
    base,
    config: join(base, 'config.json'),
    stack: join(base, 'stack.md'),
    index: join(base, 'index.jsonl'),
    graph: join(base, 'graph.json'),
    writeDraft: join(base, 'write.draft.json'),
    raw: join(base, 'raw'),
    digest: join(base, 'digest'),
    drafts: join(base, 'drafts'),
  };
}

export function splitId(id) {
  const [type, ...rest] = id.split(':');
  const name = rest.pop();
  return { type, class: rest.join(':'), name };
}

function fileOf(folder, id, extension) {
  const { type, class: cls, name } = splitId(id);
  return join(folder, type, cls, `${name}${extension}`);
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

const readIfExists = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);

export function mirror(root = process.cwd()) {
  const p = paths(root);
  return {
    paths: p,
    exists: () => existsSync(p.config),

    readConfig() {
      const text = readIfExists(p.config);
      if (text === undefined) throw new Error(`no mirror in ${root}: run pega-ctx init from the project root`);
      return JSON.parse(text);
    },
    writeConfig: (config) => write(p.config, `${JSON.stringify(config, null, 2)}\n`),

    writeWriteDraft: (draft) => write(p.writeDraft, `${JSON.stringify(draft, null, 2)}\n`),

    readStack: () => readIfExists(p.stack),
    writeStack: (text) => write(p.stack, text),

    readIndex() {
      const text = readIfExists(p.index);
      return text ? text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    writeIndex: (lines) => write(p.index, lines.map((l) => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : '')),

    readGraph: () => JSON.parse(readIfExists(p.graph) ?? '{"edges":[]}'),
    writeGraph: (graph) => write(p.graph, `${JSON.stringify(graph, null, 1)}\n`),

    readRaw: (id) => readIfExists(fileOf(p.raw, id, '.toon')),
    writeRaw: (id, toon) => write(fileOf(p.raw, id, '.toon'), toon),
    removeRaw: (id) => rmSync(fileOf(p.raw, id, '.toon'), { force: true }),

    readDigest: (id) => readIfExists(fileOf(p.digest, id, '.md')),
    writeDigest: (id, md) => write(fileOf(p.digest, id, '.md'), md),
    removeDigest: (id) => rmSync(fileOf(p.digest, id, '.md'), { force: true }),

    // Drafts of create / update (src/mirror/draft.mjs), one JSON file per rule.
    draftFile: (id) => fileOf(p.drafts, id, '.json'),
    writeRuleDraft: (id, text) => write(fileOf(p.drafts, id, '.json'), text),
    removeRuleDraft: (id) => rmSync(fileOf(p.drafts, id, '.json'), { force: true }),

    // Identifiers present in raw/ or digest/, from the folder tree.
    ids(layer) {
      const folder = p[layer];
      if (!existsSync(folder)) return [];
      const ids = [];
      for (const type of readdirSync(folder)) {
        if (!statSync(join(folder, type)).isDirectory()) continue;
        for (const cls of readdirSync(join(folder, type))) {
          for (const f of readdirSync(join(folder, type, cls))) ids.push(`${type}:${cls}:${f.replace(/\.(toon|md|json)$/, '')}`);
        }
      }
      return ids;
    },
  };
}
