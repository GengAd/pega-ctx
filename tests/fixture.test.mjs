// The fixture itself: each raw rule decodes, is stored at its identifier, and has its list() row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeToon } from '../src/mcp/toon.mjs';
import { TYPES } from '../src/mcp/tools.mjs';
import { raws, rowOf, read } from './fixture-helpers.mjs';

test('at least ten different types', () => {
  assert.ok(new Set(raws.map((r) => r.type)).size >= 10);
});

for (const r of raws) {
  test(`${r.id}: decoded and stored at its identifier`, () => {
    const o = decodeToon(read(r));
    assert.equal(o.pxObjClass, TYPES[r.type]);
    assert.equal(o.pyClassName, r.class);
    assert.equal(o.pyRuleName, r.name);
  });

  test(`${r.id}: has its list() row`, () => {
    const row = rowOf(r);
    assert.ok(row, 'row missing from tests/fixture/list.jsonl');
    assert.match(row.key, new RegExp(`^${TYPES[r.type].toUpperCase()} `));
  });
}

test('no email address in the fixture', () => {
  for (const r of raws) assert.doesNotMatch(read(r), /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, r.file);
});
