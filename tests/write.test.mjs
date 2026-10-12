// Write ruleset per class: prefix matching, resolution order, draft of the "write" table, on the fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mirror } from '../src/mirror/files.mjs';
import { prefixMatches, baseRuleset, resolveWrite, writeDraft, rulesetsSeen } from '../src/mirror/write.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const { root } = await fixtureMirror();
const index = mirror(root).readIndex();

test('prefix: with a trailing dash every class starting with it, otherwise the class and its children by name', () => {
  assert.ok(prefixMatches('MyOrg-App-', 'MyOrg-App-Work-Claim'));
  assert.ok(!prefixMatches('MyOrg-App-', 'MyOrg-Apple-Work'));
  assert.ok(prefixMatches('MyOrg-App-Work-Claim', 'MyOrg-App-Work-Claim'));
  assert.ok(prefixMatches('MyOrg-App-Work-Claim', 'MyOrg-App-Work-Claim-Sub'));
  assert.ok(!prefixMatches('MyOrg-App-Work-Claim', 'MyOrg-App-Work-ClaimX'));
  assert.ok(!prefixMatches('@baseclass', 'MyOrg-App'), '@baseclass is not a write prefix for every class');
});

test('a branch ruleset belongs to its base ruleset', () => {
  assert.equal(baseRuleset('Test_Branch_MESB1:01-01-01'), 'Test');
  assert.equal(baseRuleset('Test'), 'Test');
});

test('rulesets seen in the fixture: three, with their highest version and their classes', () => {
  assert.deepEqual(rulesetsSeen(index).map((s) => [s.name, s.version, s.rules]), [
    ['Test', '01-01-01', 34],
    ['Cvent', '01-01-05', 2],
    ['Gameboard', '01-01-17', 2],
  ]);
});

test('resolution: --ruleset, then the first matching prefix of the table, then the siblings, then the default', () => {
  const table = { byClass: [{ prefix: 'MONORG-Test-Work-', ruleset: 'Work:01-01-01' }, { prefix: 'MONORG-', ruleset: 'Org:01-01-01' }], default: 'Fallback:01-01-01' };
  assert.deepEqual(resolveWrite({ class: 'MONORG-Test-Work-X', option: 'Cli:01', table, index }), { ruleset: 'Cli:01', source: '--ruleset' });
  assert.equal(resolveWrite({ class: 'MONORG-Test-Work-X', table, index }).ruleset, 'Work:01-01-01', 'first match in order');
  assert.equal(resolveWrite({ class: 'MONORG-Test-Data-People', table, index }).ruleset, 'Org:01-01-01');
  assert.equal(resolveWrite({ class: 'OrgEv-Int-CventAtt-Data', table, index }).ruleset, 'Cvent:01-01-05', 'siblings when no prefix matches');
  assert.equal(resolveWrite({ class: 'Nobody-Here', table, index }).ruleset, 'Fallback:01-01-01', 'the default comes last');
  assert.deepEqual(resolveWrite({ class: 'Nobody-Here', table: { byClass: [], default: null }, index }).reason, 'none');
});

test('draft: the most general prefix of two segments at least that covers one ruleset only; most specific first', () => {
  const draft = writeDraft(index);
  assert.deepEqual(draft.byClass.map((e) => [e.prefix, e.ruleset, e.rules]), [
    ['AutreOrg-Gameboard-', 'Gameboard:01-01-17', 2],
    ['MONORG-Test-', 'Test:01-01-01', 33],
    ['OrgEv-Int-', 'Cvent:01-01-05', 2],
  ]);
  assert.equal(draft.default, null);
  assert.deepEqual(draft.ambiguous, []);
});

test('draft: two rulesets in one application → narrower prefixes; a class with both → listed apart', () => {
  const extra = [
    { id: 'When:MONORG-Test-Work-Other:A', type: 'When', class: 'MONORG-Test-Work-Other', name: 'A', rulesets: ['TestExt:01-01-02'] },
    { id: 'When:MONORG-Test-Data-People:B', type: 'When', class: 'MONORG-Test-Data-People', name: 'B', rulesets: ['TestExt:01-01-02'] },
  ];
  const draft = writeDraft([...index, ...extra]);
  const prefixes = Object.fromEntries(draft.byClass.map((e) => [e.prefix, e.ruleset]));
  assert.equal(prefixes['MONORG-Test-'], undefined, 'no longer pure');
  assert.equal(prefixes['MONORG-Test-Work-GetInfo'], 'Test:01-01-01');
  assert.equal(prefixes['MONORG-Test-Work-Other'], 'TestExt:01-01-02');
  assert.deepEqual(draft.ambiguous.map((a) => a.class), ['MONORG-Test-Data-People']);
});

test('sync writes the draft in .pega/write.draft.json', () => {
  const draft = JSON.parse(readFileSync(mirror(root).paths.writeDraft, 'utf8'));
  assert.equal(draft.byClass.length, 3);
});
