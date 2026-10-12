// example/.pega/ is up to date: same index, same graph, same digests as a mirror rebuilt
// from the fixture. Otherwise: node scripts/example.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mirror } from '../src/mirror/files.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const EXAMPLE = join(import.meta.dirname, '..', 'example');
const MESSAGE = 'example/.pega/ behind the fixture or the projections: node scripts/example.mjs';

test('example/.pega/: index, graph and digests up to date', async () => {
  const expected = mirror((await fixtureMirror()).root);
  const example = mirror(EXAMPLE);
  assert.deepEqual(example.readIndex(), expected.readIndex(), MESSAGE);
  assert.deepEqual(example.readGraph(), expected.readGraph(), MESSAGE);
  assert.deepEqual(example.ids('digest').sort(), expected.ids('digest').sort(), MESSAGE);
  for (const id of expected.ids('digest')) assert.equal(example.readDigest(id), expected.readDigest(id), `${id}: ${MESSAGE}`);
});
