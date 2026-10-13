// pega-ctx model <Class>: the data model of a class in one page, on the fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';

test('model: inheritance, own properties with mode, page class, label and ruleset; those cited but not in the mirror', async () => {
  const { pc } = await fixtureMirror();
  const r = await pc(`model ${W}`);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, new RegExp(`^# Model of ${W}\\n\\ninheritance: ${W} → MONORG-Test-Work \\(by name\\)\\n\\n## Properties \\(5\\)\\n\\nown \\(${W}\\):\\n`));
  assert.match(r.output, /\n- \.HouseholdMembers — PageList of MONORG-Test-Data-People — "Autres membres du foyer" — \[Test\] Test:01-01-01\n/);
  assert.match(r.output, /\n- \.Requester — not in the mirror; cited by DataTransform:[^,]+:BuildHouseholdReferences, View:[^\n]+:pyEdit\n/);
});

test('model: --depth goes into the page class of a PageList; data pages and views of the classes', async () => {
  const { pc } = await fixtureMirror();
  const r = await pc(`model ${W}`);
  assert.match(r.output, /\n## \.HouseholdMembers: MONORG-Test-Data-People \(6\)\n\nown \(MONORG-Test-Data-People\):\n- \.Age — String, Integer — "Âge" — \[Test\] Test:01-01-01\n- \.Title — String, Text — values Conjoint, Enfant, Autre — "Titre du membre"/);
  assert.match(r.output, /\n## Data pages\n- DataPage:MONORG-Test-Data-People:D_PeopleList — List People\n/);
  assert.match(r.output, /\n## Views\n- View:MONORG-Test-Data-People:HouseholdMembersPicker — shows \.Age, \.FirstName, \.LastName, \.Title\n/);
  const flat = await pc(`model ${W} --depth 0`);
  assert.ok(!flat.output.includes('## .HouseholdMembers:'));
  assert.match(flat.output, /\n## Data pages\nnone in the mirror\n/);
});

test('model --json, an unknown class, a wrong depth', async () => {
  const { pc } = await fixtureMirror();
  const json = JSON.parse((await pc(`model ${W} --json`)).output);
  assert.deepEqual(json.chain.map((c) => c.class), [W, 'MONORG-Test-Work']);
  assert.equal(json.embedded[0].class, 'MONORG-Test-Data-People');
  const unknown = await pc('model MONORG-Test-Work-Nowhere');
  assert.equal(unknown.code, 1);
  assert.match(unknown.output, /^no rule of MONORG-Test-Work-Nowhere in the mirror: pega-ctx search Nowhere --type Class/);
  assert.match((await pc(`model ${W} --depth x`)).output, /^--depth x: give 0, 1, 2/);
});
