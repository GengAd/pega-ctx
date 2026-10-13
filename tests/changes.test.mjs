// pega-ctx changes: what the last sync changed, from .pega/prev/; --since from the index dates;
// check flags an update draft written against a rule that changed since.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, launch } from '../src/commands/index.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { digestDiff } from '../src/mirror/changes.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';

async function changedInPega() {
  const fixture = await fixtureMirror();
  const { pega } = fixture;
  const flow = pega.rows.find((r) => r.name === 'GetInfoStart');
  flow.updated = '2026-10-13T09:00:00.000Z';
  flow.by = 'dev.deux';
  pega.raws.set(flow.key, pega.raws.get(flow.key).replace('pyLabel: Créer GetInfo et saisir le répondant', 'pyLabel: Démarrer GetInfo'));
  pega.rows.splice(pega.rows.findIndex((r) => r.name === 'DataTableEditorReport'), 1);
  const sync = await fixture.pc('sync');
  return { ...fixture, sync };
}

test('changes: the last sync, one dated line per rule, the digest lines that changed', async () => {
  const { pc, root, sync } = await changedInPega();
  assert.match(sync.output, new RegExp(`\\n~ Flow:${W}:GetInfoStart — 2026-10-13 09:00 by dev\\.deux\\n`));
  const r = await pc('changes');
  assert.equal(r.code, 0, r.output);
  const lines = r.output.split('\n');
  assert.match(lines[0], /^last sync, \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(the one before: .+\): 0 added, 1 changed, 1 removed$/);
  assert.equal(lines[1], `~ Flow:${W}:GetInfoStart — 2026-10-13 09:00 by dev.deux`);
  assert.ok(lines.includes('    - description: Créer GetInfo et saisir le répondant'));
  assert.ok(lines.includes('    + description: Démarrer GetInfo'));
  assert.ok(!lines.some((l) => /^ {4}[-+] updated: /.test(l)));
  assert.match(lines.at(-1), /^- ReportDefinition:MONORG-Test-Data-People:DataTableEditorReport — last seen \d{4}-\d{2}-\d{2} \d{2}:\d{2} by /);
  assert.equal(readFileSync(join(root, '.pega/prev/.gitignore'), 'utf8'), '*\n');
  const flows = await pc('changes --type Flow');
  assert.match(flows.output, /^last sync, .*: 0 added, 1 changed, 0 removed\n/);
});

test('changes --since: the rules of the index updated since that date; a wrong date refused', async () => {
  const { pc } = await changedInPega();
  const r = await pc('changes --since 2026-10-13');
  assert.equal(r.output, `1 rules updated in Pega since 2026-10-13 (added and changed; removals and case types are not dated)\n~ Flow:${W}:GetInfoStart — 2026-10-13 09:00 by dev.deux`);
  assert.match((await pc('changes --since soon')).output, /^--since soon: give a date/);
});

test('changes before any sync; digestDiff cut beyond twenty lines', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  mirror(root).writeConfig({ lastSync: null });
  const r = await launch(parse(['changes']), { root });
  assert.equal(r.code, 1);
  assert.match(r.output, /^no sync recorded yet in \.pega\/prev\/: pega-ctx sync/);
  const many = (p) => Array.from({ length: 15 }, (_, i) => `${p}${i}`).join('\n');
  const d = digestDiff(many('a'), many('b'), 'Flow:A:B');
  assert.equal(d.length, 21);
  assert.equal(d.at(-1), '    … 10 more lines: pega-ctx rule Flow:A:B');
});

test('check: an update draft written against a rule that changed in Pega since', async () => {
  const { root, pc } = await fixtureMirror();
  const FA = `FlowAction:${W}:CollectHouseholdSize`;
  const p = join(root, 'p.json');
  writeFileSync(p, JSON.stringify({ pyViewReference: 'OtherView' }));
  assert.equal((await pc(`update ${FA} --patch ${p} --draft`)).code, 0);
  assert.ok(!(await pc('check')).output.includes('changed in Pega since'));
  const m = mirror(root);
  m.writeRaw(FA, `${m.readRaw(FA)}pyNote: changed\n`);
  assert.match((await pc('check')).output, new RegExp(`\\n\\.pega/drafts/FlowAction/${W}/CollectHouseholdSize\\.json was written against an older ${FA}, changed in Pega since: send would refuse it`));
});
