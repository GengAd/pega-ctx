// Graph on the fixture: sure and probable edges, resolution by parent class, Cited by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirror } from '../src/mirror/files.mjs';
import { resolver, build, inheritanceChain } from '../src/mirror/graph.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';
const { root } = await fixtureMirror();
const m = mirror(root);
const { edges } = m.readGraph();
const edge = (from, to) => edges.find((e) => e.from === from && e.to === to);

test('sure edges: CaseType → Flow with its stage, Flow → FlowAction and Activity, FlowAction → View', () => {
  assert.deepEqual(edge(`CaseType:${W}:pyDefault`, `Flow:${W}:CollectHousehold`), { from: `CaseType:${W}:pyDefault`, to: `Flow:${W}:CollectHousehold`, via: 'process', confidence: 'sure', stage: 'Foyer' });
  assert.equal(edge(`Flow:${W}:CollectHousehold`, `FlowAction:${W}:CollectHouseholdSize`)?.via, 'assignment');
  assert.equal(edge(`Flow:${W}:CollectHousehold`, `Activity:${W}:SaveHouseholdPeople`)?.via, 'utility');
  assert.equal(edge(`FlowAction:${W}:CollectHouseholdSize`, `View:${W}:CollectHouseholdSize`)?.confidence, 'sure');
});

test('sure edges of the other types: When → DecisionTable, Activity → DataTransform, DataPage → ReportDefinition', () => {
  const c = 'OrgEv-Int-CventAtt-Data';
  assert.equal(edge(`When:${c}:IsIgnoredRegistrationType`, `DecisionTable:${c}:IgnoredRegistrationType`)?.confidence, 'sure');
  assert.equal(edge(`Activity:${W}:SaveHouseholdPeople`, `DataTransform:${W}:BuildHouseholdReferences`)?.via, 'apply');
  assert.equal(edge('DataPage:MONORG-Test-Data-People:D_PeopleList', 'ReportDefinition:MONORG-Test-Data-People:DataTableEditorReport')?.via, 'source');
});

test('probable edge: Flow → View cited by its name', () => {
  assert.equal(edge(`Flow:${W}:CollectHousehold`, `View:${W}:EnterHouseholdMembers`)?.confidence, 'probable');
});

test('no duplicate edge, no loop on itself', () => {
  const seen = new Set(edges.map((e) => `${e.from}>${e.to}`));
  assert.equal(seen.size, edges.length);
  assert.ok(edges.every((e) => e.from !== e.to));
});

test('index: refs = the targets of the rule\'s edges', () => {
  for (const l of m.readIndex()) {
    assert.deepEqual([...l.refs].sort(), edges.filter((e) => e.from === l.id).map((e) => e.to).sort(), l.id);
  }
});

test('Cited by: in the digest, from the graph, probable marked ?', () => {
  const d = m.readDigest(`View:${W}:CollectHouseholdSize`);
  assert.match(d, /\n## Cited by\n- Flow:\S+:CollectHousehold \? \(name match\)\n- FlowAction:\S+:CollectHouseholdSize \(view\)\n/);
  assert.match(m.readDigest(`CaseType:${W}:pyDefault`), /\n## Cited by\nnone\n$/);
});

test('resolution: same class, then the most specific parent class, data page by its name', () => {
  const index = [
    { id: 'When:A-B:IsOk', type: 'When', class: 'A-B', name: 'IsOk' },
    { id: 'When:A:IsOk', type: 'When', class: 'A', name: 'IsOk' },
    { id: 'When:@baseclass:IsOk', type: 'When', class: '@baseclass', name: 'IsOk' },
    { id: 'View:A-B-C:Entry', type: 'View', class: 'A-B-C', name: 'Entry' },
    { id: 'DataPage:X-Data:D_List', type: 'DataPage', class: 'X-Data', name: 'D_List' },
  ];
  const r = resolver(index);
  assert.equal(r('View:A-B-C:Entry'), 'View:A-B-C:Entry');
  assert.equal(r('When:A-B-C-D:IsOk'), 'When:A-B:IsOk');
  assert.equal(r('DataPage:A-B:D_List'), 'DataPage:X-Data:D_List');
  assert.equal(r('When:Z:IsOk'), 'When:@baseclass:IsOk', 'only @baseclass is a parent of Z');
  assert.equal(r('View:Z:Unknown'), 'View:Z:Unknown', 'outside the index: stays as is, check will report it');
});

test('build: the stage follows the edge, stable sort', () => {
  const g = build([{ id: 'B', references: [{ to: 'C', via: 'v', confidence: 'sure' }] }, { id: 'A', references: [{ to: 'B', via: 'process', confidence: 'sure', stage: 'S1' }] }]);
  assert.deepEqual(g.edges, [{ from: 'A', to: 'B', via: 'process', confidence: 'sure', stage: 'S1' }, { from: 'B', to: 'C', via: 'v', confidence: 'sure' }]);
});

test('inheritance chain by name, from the closest to the farthest', () => {
  const index = ['A-B-C-D', 'A-B', 'A-B-C', 'A-X', '@baseclass'].map((cls, i) => ({ id: `When:${cls}:W${i}`, class: cls }));
  assert.deepEqual(inheritanceChain(index, 'A-B-C-D'), ['A-B-C', 'A-B', '@baseclass']);
});
