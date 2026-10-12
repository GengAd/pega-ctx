#!/usr/bin/env node
// Builds example/.pega/ from the fixture (init + sync on the tests' fake client).
// Run again when a projection changes: tests/example.test.mjs reports it.
import { rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parse } from '../src/commands/index.mjs';
import { fakePega } from '../tests/fake-pega.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'example');
rmSync(join(root, '.pega'), { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const pega = fakePega();
const context = { root, connect: async () => pega };
for (const line of ['init --ruleset Test,Gameboard,Cvent', 'sync']) {
  const r = await launch(parse(line.split(' ')), context);
  if (r.code) throw new Error(`${line}: ${r.output}`);
  process.stdout.write(`${r.output.split('\n')[0]}\n`);
}
