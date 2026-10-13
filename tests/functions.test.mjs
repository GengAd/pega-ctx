// .pega/functions.md: the functions the rules call, written by sync; check warns about others in a draft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, launch } from '../src/commands/index.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { calls, listedNames } from '../src/mirror/functions.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

test('calls: the three forms, nested calls, strings with parentheses; not an email nor a name without parentheses', () => {
  assert.deepEqual(calls('@pxEvaluateDecisionTable(@Utilities.pxGetStepPageReference(),"IgnoredRegistrationType")'), [
    { name: 'pxEvaluateDecisionTable', call: '@pxEvaluateDecisionTable(@Utilities.pxGetStepPageReference(),"IgnoredRegistrationType")' },
    { name: 'Utilities.pxGetStepPageReference', call: '@Utilities.pxGetStepPageReference()' },
  ]);
  assert.deepEqual(calls('@(Pega-RULES:String).inString(.A, "x)y")=-1'), [{ name: 'String.inString', call: '@(Pega-RULES:String).inString(.A, "x)y")' }]);
  assert.deepEqual(calls('write to dev@host(1) or @baseclass, @P .x'), []);
  assert.equal(calls(`@F(${'a'.repeat(300)}`)[0].call.length, 161);
});

test('sync writes functions.md: the five functions of the fixture, most used first, each with real calls and their rule', async () => {
  const { root } = await fixtureMirror();
  const md = mirror(root).readFunctions();
  assert.deepEqual([...listedNames(md)], ['inString', 'IsInPageList', 'PageExists', 'pxEvaluateDecisionTable', 'Utilities.pxGetStepPageReference']);
  assert.match(md, /^# Functions the application calls\n\n5 functions called in 2 rules of the mirror, most used first\. Reuse these first; for a function not listed here, ask the user\.\n/);
  assert.match(md, /\n## @inString\n\n2 usages in 1 rule\n- `@inString\(D_GetTable\[TableID:\.TableID\]\.UnlockedStages,"Scene 2"\)` \(Validate:AutreOrg-Gameboard-Work-Game:ValidateToScene2\)\n/);
  assert.match(md, /\n## @Utilities\.pxGetStepPageReference\n\n1 usage in 1 rule\n- `@Utilities\.pxGetStepPageReference\(\)` \(When:OrgEv-Int-CventAtt-Data:IsIgnoredRegistrationType\)\n$/);
});

test('check: a function a draft calls and no rule calls is a warning line after the waiting draft, marked as a warning', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  const m = mirror(root);
  m.writeConfig({ lastSync: new Date().toISOString() });
  m.writeFunctions('# Functions the application calls\n\n## @inString\n');
  mkdirSync(join(root, '.pega/drafts/When/A-B'), { recursive: true });
  writeFileSync(join(root, '.pega/drafts/When/A-B/IsOpen.json'), JSON.stringify({
    'pega-ctx': { operation: 'create', id: 'When:A-B:IsOpen' },
    content: { pyCondition: '@inString(.A, "x") && @MadeUp(.B)' },
  }));
  const r = await launch(parse(['check']), { root });
  const lines = r.output.split('\n');
  assert.equal(lines.length, 2, r.output);
  assert.match(lines[1], /^warning: \.pega\/drafts\/When\/A-B\/IsOpen\.json calls @MadeUp, which no rule of the application calls \(\.pega\/functions\.md\): ask the user/);
  const json = JSON.parse((await launch(parse(['check', '--json']), { root })).output);
  assert.deepEqual(json.filter((f) => f.level === 'warning').map((f) => f.kind), ['function']);
});
