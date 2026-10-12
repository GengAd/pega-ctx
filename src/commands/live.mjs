// pega-ctx live <id>: the rule read in Pega right now, projected as by sync; raw/ and digest/
// updated on the way. First line if the digest differs from the mirror. Run it before any write.
import { mirror, splitId } from '../mirror/files.mjs';
import { refresh } from '../mirror/live.mjs';
import { findRule, render } from './common.mjs';

export const help = 'pega-ctx live <id>';

// A rule outside the mirror (just created) is given by its full identifier.
export function targetOf(index, request) {
  try {
    return findRule(index, request);
  } catch (e) {
    if (request?.split(':').length >= 3) return splitId(request);
    throw e;
  }
}

export function header(state, config) {
  const synced = config.lastSync ? config.lastSync.slice(0, 10) : 'never';
  if (state === 'different') return `different from the mirror (synced on ${synced})\n\n`;
  if (state === 'new') return 'missing from the mirror, added\n\n';
  return '';
}

export async function run({ positionals, options, root, connect }) {
  const m = mirror(root);
  const config = m.readConfig();
  const target = targetOf(m.readIndex(), positionals[0]);
  const pega = await connect();
  try {
    const r = await refresh(m, pega, target);
    return render(options, r, `${header(r.state, config)}${r.digest.trimEnd()}`);
  } finally {
    await pega.close();
  }
}
