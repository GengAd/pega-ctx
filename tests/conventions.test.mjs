// .pega/conventions.md, written by sync from the index, and the convention lines of create.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirror } from '../src/mirror/files.mjs';
import { language, casing, words, departures } from '../src/mirror/conventions.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

test('language and case: accents, the two word lists, words of both languages left aside', () => {
  assert.deepEqual(words('CollectHouseholdSize'), ['collect', 'household', 'size']);
  assert.deepEqual(words('D_PeopleList'), ['people', 'list']);
  assert.equal(language('CollectHouseholdSize'), 'en');
  assert.equal(language('Composition du foyer'), 'fr');
  assert.equal(language('Âge'), 'fr');
  assert.equal(language('NomDuFoyer'), 'fr');
  assert.equal(language('PegaCtxFxAIAgent'), null);
  assert.equal(casing('GetInfoStart'), 'PascalCase');
  assert.equal(casing('collectSize'), 'camelCase');
  assert.equal(casing('collect_size'), 'snake_case');
  assert.equal(casing('D_PeopleList'), 'PascalCase');
});

test('sync writes conventions.md: per class prefix, largest first, names English, labels French, PascalCase', async () => {
  const { root } = await fixtureMirror();
  const md = mirror(root).readConventions();
  assert.match(md, /^# Naming conventions\n/);
  assert.deepEqual([...md.matchAll(/^## (\S+) \(\d+ rules\)$/gm)].map((m) => m[1]), ['MONORG-Test-', 'AutreOrg-Gameboard-', 'OrgEv-Int-']);
  const main = md.split('\n## ')[1];
  assert.match(main, /\n- names: English \(\d+ of \d+\)\n- labels: French \(\d+ of \d+\)\n- case of names: PascalCase \(\d+ of \d+\)\n/);
  assert.match(main, /\n- recurring first words: .*Collect \(CollectHousehold, CollectHouseholdSize\)/);
  assert.match(main, /\n- views named like their flow action: 1 of 1 flow actions\n/);
  assert.match(main, /\n- names built on the class's last segment: GetInfoStart\n/);
  assert.match(md, /\n## OrgEv-Int- \(2 rules\)\n\n- names: too few rules to tell\n/);
});

test('create: a name in the other language, another case, a label in the other language, a class without --label', async () => {
  const { root } = await fixtureMirror();
  const index = mirror(root).readIndex();
  const W = 'MONORG-Test-Work-GetInfo';
  assert.deepEqual(departures({ type: 'Property', class: W, name: 'NomDuFoyer', label: 'Household name', index }), [
    'NomDuFoyer reads French, the rules of MONORG-Test- are named in English',
    'the label "Household name" reads English, the labels of MONORG-Test- are in French',
  ]);
  assert.deepEqual(departures({ type: 'View', class: W, name: 'collect_size', label: 'Taille du foyer', index }), ['collect_size is snake_case, the rules of MONORG-Test- are PascalCase']);
  assert.deepEqual(departures({ type: 'Property', class: W, name: 'HouseholdName', label: 'Nom du foyer', index }), []);
  assert.deepEqual(departures({ type: 'Class', class: 'MONORG-Test-Work-Survey', name: 'MONORG-Test-Work-Survey', label: 'GetInfo', index }), ['no --label: the class\'s label stays "GetInfo"; give it a readable one with --label']);
  assert.deepEqual(departures({ type: 'Class', class: 'MONORG-Test-Work-Survey', name: 'MONORG-Test-Work-Survey', label: 'Enquête', labelGiven: true, index }), []);
  // A group too small to have a convention says nothing.
  assert.deepEqual(departures({ type: 'When', class: 'OrgEv-Int-CventAtt-Data', name: 'est_ouvert', label: 'Est ouvert', index }), []);
});
