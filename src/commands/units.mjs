// pega-ctx units [--branch B]: runs the PegaUnit tests of a branch, one line per test.
// Non-zero code when a test fails. The server keeps no failure reason: open the test in Dev Studio.
import { mirror } from '../mirror/files.mjs';
import { render } from './common.mjs';
import { pegaText } from './run-case.mjs';

export const help = 'pega-ctx units [--branch B]';

export function unitLines(branch, r) {
  const s = r.summary ?? {};
  const tests = r.data ?? [];
  if (!tests.length) return [`units ${branch}: no PegaUnit test in this branch`];
  const lines = [`units ${branch}: ${tests.length} tests, ${s.passed ?? 0} passed, ${s.failed ?? 0} failed, ${s.other ?? 0} other`];
  // Failures first: they are what the reader acts on.
  const rank = (t) => (t.result === 'Failed' ? 0 : t.result === 'Passed' ? 2 : 1);
  for (const t of [...tests].sort((a, b) => rank(a) - rank(b))) {
    const status = t.result === 'Failed' ? 'FAIL' : t.result === 'Passed' ? 'PASS' : String(t.result ?? '?').toUpperCase();
    const about = [t.ruleUnderTestType, t.elapsedTimeSeconds !== undefined && t.elapsedTimeSeconds !== '' ? `${t.elapsedTimeSeconds} s` : '', t.isInactive === true || t.isInactive === 'true' ? 'inactive' : ''].filter(Boolean);
    lines.push(`${status}  ${t.label ?? t.pxInsName ?? t.pzInsKey}${about.length ? ` (${about.join(', ')})` : ''}`);
  }
  return lines;
}

export async function run({ positionals, options, root, connect }) {
  const m = mirror(root);
  const config = m.exists() ? m.readConfig() : {};
  const branch = typeof options.branch === 'string' ? options.branch : positionals[0] ?? config.branch;
  if (!branch) return { code: 1, output: '--branch <ID> required: PegaUnit tests run per branch (or set branch in .pega/config.json)' };
  const pega = await connect();
  try {
    let r;
    try {
      r = await pega.units(branch);
    } catch (e) {
      return { code: 1, output: `Pega refused run-pegaunits on ${branch}: ${pegaText(e)}` };
    }
    const out = render(options, r, unitLines(branch, r).join('\n'));
    return { ...out, code: Number(r.summary?.failed ?? 0) > 0 ? 1 : 0 };
  } finally {
    await pega.close();
  }
}
