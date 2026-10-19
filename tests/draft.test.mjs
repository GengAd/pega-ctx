// Drafts: create --draft and update --draft write what will be sent, send sends it as it is in the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { draftText, readDraft } from '../src/mirror/draft.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';
const FA = `FlowAction:${W}:CollectHouseholdSize`;
const VIEW = `View:${W}:CollectHouseholdSize`;
const sent = (pega, kind) => pega.calls.filter((c) => c[0] === kind).map((c) => c[1]);

test('draftText: identity fields first, JSON strings unfolded, folded back by readDraft', () => {
  const meta = '{"name":"V","children":[{"type":"Region"}]}';
  const content = { pyViewMetadata: 'x', pxViewMetadata: meta, pyLabel: 'V', pyRuleName: 'V', pyClassName: 'A-B', pxObjClass: 'Rule-UI-View', pyNote: '[not json', pyList: [{ pyJson: '[1,2]' }] };
  const text = draftText({ operation: 'create', id: 'View:A-B:V', type: 'View' }, content);
  const o = JSON.parse(text);
  assert.deepEqual(Object.keys(o.content).slice(0, 4), ['pxObjClass', 'pyRuleName', 'pyClassName', 'pyLabel']);
  assert.deepEqual(o.content.pxViewMetadata, { name: 'V', children: [{ type: 'Region' }] });
  assert.deepEqual(o['pega-ctx'].unfolded, ['/pxViewMetadata', '/pyList/0/pyJson']);
  assert.ok(text.includes('\n  "content": {\n    "pxObjClass": "Rule-UI-View",'), 'two-space indentation');
  const back = readDraft(text);
  assert.equal(back.content.pxViewMetadata, meta);
  assert.equal(back.content.pyList[0].pyJson, '[1,2]');
  assert.equal(back.content.pyNote, '[not json');
});

test('readDraft: one line that says what to do', () => {
  assert.throws(() => readDraft('{', 'd.json'), /^Error: d\.json: not valid JSON .*: fix it/);
  assert.throws(() => readDraft('{"content":{}}', 'd.json'), /no "pega-ctx" header/);
  assert.throws(() => readDraft('{"pega-ctx":{"operation":"delete"},"content":{}}', 'd.json'), /operation is "delete", expected create or update/);
  assert.throws(() => readDraft('{"pega-ctx":{"operation":"create"},"content":[]}', 'd.json'), /"content" must be a JSON object/);
});

test('create --draft: the file in .pega/drafts/, nothing sent; check lists it; send sends it as corrected by hand', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const m = mirror(root);
  pega.calls.length = 0;
  const r = await pc(`create View ${W} Confirmation --from ${VIEW} --draft`);
  assert.equal(r.code, 0, r.output);
  const id = `View:${W}:Confirmation`;
  const file = m.draftFile(id);
  assert.match(r.output, new RegExp(`^draft written: \\.pega/drafts/View/${W}/Confirmation\\.json \\(to read: \\.pega/drafts/View/${W}/Confirmation\\.md\\)\\nread the \\.md, correct the \\.json if needed, then: pega-ctx send ${id} --branch <ID>\\nruleset: Test:01-01-01 `));
  assert.match(r.output, /\n# View Confirmation\n/);
  assert.deepEqual(pega.calls, [], 'nothing sent to Pega');
  const digestFile = file.replace(/\.json$/, '.md');
  assert.match(readFileSync(digestFile, 'utf8'), /^<!-- .*send .* --dry-run.* -->\n# View Confirmation\n/, 'the digest to read, next to the draft');
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(draft['pega-ctx'].operation, 'create');
  assert.equal(draft['pega-ctx'].from, VIEW);
  assert.equal(draft['pega-ctx'].ruleset, 'Test');
  assert.equal(draft.content.pxViewMetadata.name, 'Confirmation', 'the view metadata is readable as an object');
  // The template's field is not in the mirror: the draft says so, with the line to fix.
  assert.match(r.output, /\nlint: 1 error, 1 warning\nerror line \d+ {2}\/content\/[^:]+: ref: Property HouseholdMemberCount \(field\) is missing from the mirror on MONORG-Test-Work-GetInfo and its parents: create it first, fix the name, or pega-ctx live Property:MONORG-Test-Work-GetInfo:HouseholdMemberCount if it lives in an application the mirror does not follow\n/);

  const check = await pc('check');
  assert.equal(check.code, 1);
  assert.match(check.output, new RegExp(`draft waiting: \\.pega/drafts/View/${W}/Confirmation\\.json: read it, then pega-ctx send ${id} --branch <ID>, or delete the file`));

  // Corrected by hand: the label changes, the field becomes one of the mirror, the metadata stays an object in the file.
  draft.content.pyLabel = 'Confirm the request';
  writeFileSync(file, JSON.stringify(draft, null, 2).replaceAll('HouseholdMemberCount', 'HouseholdMembers'));
  assert.match((await pc(`lint ${id}`)).output, /\nlint: 1 warning\nwarning line \d+ {2}\/content: not checked against a schema/);
  const dry = await pc(`send ${id} --dry-run`);
  assert.match(dry.output, /^dry-run: nothing is written to Pega\n\.pega\/drafts\/View\/[^:]+: create View:[^\n]+\n\n# View Confirmation\n[^]*\ndescription: Confirm the request\n/);
  assert.deepEqual(pega.calls, []);
  assert.match((await pc(`send ${id}`)).output, /--branch <ID> required/);

  const s = await pc(`send .pega/drafts/View/${W}/Confirmation.json --branch US42`);
  assert.equal(s.code, 0, s.output);
  const [request] = sent(pega, 'create');
  assert.equal(request.content.pyLabel, 'Confirm the request');
  assert.equal(typeof request.content.pxViewMetadata, 'string', 'folded back before sending');
  assert.equal(JSON.parse(request.content.pxViewMetadata).name, 'Confirmation');
  assert.equal(request.branch, 'US42');
  assert.equal(request.ruleset, 'Test');
  assert.match(request.description, /^pega-ctx create Confirmation from CollectHouseholdSize$/);
  assert.ok(!existsSync(file), 'the draft is deleted once sent');
  assert.ok(!existsSync(digestFile), 'and its digest');
  assert.match((await pc(`send ${id} --branch US42`)).output, /^no draft View:/);
});

test('update --draft: the patch and the fingerprint of the rule; send refuses if the rule changed in Pega, unless --force', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const m = mirror(root);
  const p = join(root, 'p.json');
  writeFileSync(p, JSON.stringify({ pyViewReference: 'EnterHouseholdMembers' }));
  const r = await pc(`update ${FA} --patch ${p} --draft --branch US42`);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /\nview: EnterHouseholdMembers\n/);
  assert.ok(!pega.calls.some((c) => c[0] === 'update'));
  const draft = JSON.parse(readFileSync(m.draftFile(FA), 'utf8'));
  assert.deepEqual(draft.content, { pyViewReference: 'EnterHouseholdMembers' });
  assert.equal(draft['pega-ctx'].branch, 'US42');
  assert.match(draft['pega-ctx'].basedOn, /^[0-9a-f]{16}$/);

  const row = pega.rows.find((x) => x.type === 'FlowAction');
  const original = pega.raws.get(row.key);
  pega.raws.set(row.key, original.replace('pyLabel:', 'pyLabel: Changed meanwhile\nignored:'));
  const refused = await pc(`send ${FA}`);
  assert.equal(refused.code, 1);
  assert.match(refused.output, /changed in Pega since the draft was written: .*send --force/);
  assert.ok(existsSync(m.draftFile(FA)), 'a refused draft stays');

  const forced = await pc(`send ${FA} --force`);
  assert.equal(forced.code, 0, forced.output);
  const [request] = sent(pega, 'update');
  assert.deepEqual(request.patch, { pyViewReference: 'EnterHouseholdMembers' });
  assert.equal(request.branch, 'US42', 'the branch written in the draft');
  assert.ok(!existsSync(m.draftFile(FA)));
});

test('send: content with a field managed by Pega or outside py*/px* refused; a create draft of an existing rule refused', async () => {
  const { root, pc } = await fixtureMirror();
  const m = mirror(root);
  const id = `FlowAction:${W}:Confirm`;
  await pc(`create FlowAction ${W} Confirm --from ${FA} --draft`);
  const file = m.draftFile(id);
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify({ ...draft, content: { ...draft.content, pzInsKey: 'x' } }));
  assert.match((await pc(`send ${id} --branch B1`)).output, /fields managed by Pega, remove them from the draft: pzInsKey/);
  writeFileSync(file, JSON.stringify({ ...draft, content: { ...draft.content, label: 'x' } }));
  assert.match((await pc(`send ${id} --branch B1`)).output, /not Pega fields \(py…, px…\): label/);
  writeFileSync(file, JSON.stringify({ ...draft, 'pega-ctx': { ...draft['pega-ctx'], id: FA } }));
  assert.match((await pc(`send ${id} --branch B1`)).output, /already exists: write an update draft/);
});

test('a type the Pega MCP cannot write: a draft for Dev Studio, with its steps; never sent', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const m = mirror(root);
  const P = 'AutreOrg-Gameboard-Data-Player';
  const SECTION = `Section:${P}:IndividualScores`;
  const id = `Section:${P}:TeamScores`;
  pega.calls.length = 0;
  const p = join(root, 'p.json');
  writeFileSync(p, JSON.stringify({ pyDescription: 'Scores of the team' }));

  const direct = await pc(`create Section ${P} TeamScores --from ${SECTION} --branch US42`);
  assert.equal(direct.code, 1);
  assert.match(direct.output, /^the Pega MCP cannot write a Section: create-rule and update-rule refuse Rule-HTML-Section, they have no schema for it: add --draft /);

  const r = await pc(`create Section ${P} TeamScores --from ${SECTION} --patch ${p} --draft --branch US42`);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, new RegExp(`^draft written for Dev Studio: \\.pega/drafts/Section/${P}/TeamScores\\.json\\n[^\\n]*pega-ctx send will not send it`));
  assert.match(r.output, /\n# Section TeamScores\n/);
  const header = JSON.parse(readFileSync(m.draftFile(id), 'utf8'))['pega-ctx'];
  assert.match(header.manual, /pega-ctx send will not send this draft/);
  assert.deepEqual(header.steps, [
    `In Dev Studio, branch US42: open ${SECTION} and Save As TeamScores, class ${P}, ruleset Gameboard`,
    'Give each path of "changed" its value in "content"; a path absent from "content" is cleared',
    `Then pega-ctx live ${id}, and delete this file`,
  ]);
  assert.deepEqual(header.changed, ['/pyDescription', '/pyLabel'], 'the name and the class are set by Save As');

  assert.match((await pc('check')).output, new RegExp(`draft for Dev Studio waiting: \\.pega/drafts/Section/${P}/TeamScores\\.json: a developer applies it`));
  const send = await pc(`send ${id} --branch US42`);
  assert.equal(send.code, 1);
  assert.match(send.output, /: the Pega MCP cannot write a Section: .*a developer applies this draft in Dev Studio as its "steps" say/);
  assert.equal((await pc(`send ${id} --dry-run`)).code, 0, 'the digest stays readable');
  assert.ok(existsSync(m.draftFile(id)));

  const u = await pc(`update ${SECTION} --patch ${p} --branch US42`);
  assert.equal(u.code, 1);
  assert.match(u.output, /add --draft to write what a developer changes in Dev Studio$/);
  const ud = await pc(`update ${SECTION} --patch ${p} --draft --branch US42`);
  assert.equal(ud.code, 0, ud.output);
  const updated = JSON.parse(readFileSync(m.draftFile(SECTION), 'utf8'));
  assert.deepEqual(updated.content, { pyDescription: 'Scores of the team' });
  assert.equal(updated['pega-ctx'].steps[0], `In Dev Studio, branch US42: open ${SECTION}`);
  assert.ok(!pega.calls.some((c) => c[0] === 'create' || c[0] === 'update'), 'nothing written to Pega');
});
