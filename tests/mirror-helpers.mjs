// A .pega/ built from the fixture, in a temporary folder, by init + sync on the fake client.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, parse } from '../src/commands/index.mjs';
import { fakePega } from './fake-pega.mjs';
import { pluginExamples } from '../src/mcp/examples.mjs';

export const SKILLS = join(import.meta.dirname, 'fixture', 'skills');

export async function fixtureMirror(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  const pega = fakePega(options);
  // No schema unless the test gives a loader: the lint does not depend on the plugin being installed.
  // Examples: the copies of tests/fixture/skills/, not the plugin's.
  const context = { root, connect: async () => pega, schemas: options.schemas ?? (() => ({ missing: 'no schema in the tests' })), examples: pluginExamples({ folder: SKILLS }) };
  const pc = (line) => launch(parse(line.split(' ').filter(Boolean)), context);
  const init = await pc('init --ruleset Test,Gameboard,Cvent');
  if (init.code) throw new Error(init.output);
  const sync = await pc('sync');
  return { root, pega, pc, sync };
}
