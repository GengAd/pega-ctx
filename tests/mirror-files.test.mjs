import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mirror } from '../src/mirror/files.mjs';

test('a rule with no class (Rule-Edit-Validate) is stored under _ and found again with an empty class', () => {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  try {
    const m = mirror(root);
    m.writeRaw('EditValidate::CheckCount', 'raw');
    m.writeDigest('EditValidate::CheckCount', '# digest');
    m.writeDigest('Flow:Org-Work:Start', '# digest');
    assert.equal(m.readRaw('EditValidate::CheckCount'), 'raw');
    assert.deepEqual(m.ids('raw'), ['EditValidate::CheckCount']);
    assert.deepEqual(m.ids('digest').sort(), ['EditValidate::CheckCount', 'Flow:Org-Work:Start']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
