// Fake Pega client serving the fixture: same interface as src/mcp/client.mjs (stack, list, read,
// close). The tests change `rows` and `raws` to simulate a change in Pega.
import { raws as fixtureRaws, rows as fixtureRows, rowOf, read as readFile } from './fixture-helpers.mjs';

export function fakePega({ failures = [] } = {}) {
  const rows = fixtureRows.map((l) => ({ ...l }));
  const raws = new Map(fixtureRaws.map((r) => [rowOf(r).key, readFile(r)]));
  const calls = [];
  return {
    rows,
    raws,
    calls,
    async stack() {
      calls.push(['stack']);
      return {
        application: 'Test', version: '01.01.01', rulesets: ['Test'], builtOn: [{ application: 'Constellation', version: '01.01' }], constellation: true,
        // As the real climb returns it (application rules, 2026-10-12), PegaRULES shortened.
        layers: [
          { application: 'Test', version: '01.01.01', rulesets: ['Test:01-01', 'MONORG:01-01'], builtOn: [{ application: 'Constellation', version: '01.01' }] },
          { application: 'Constellation', version: '01.01', rulesets: ['Constellation:01-01'], builtOn: [{ application: 'PegaRULES', version: '8' }] },
          { application: 'PegaRULES', version: '8', rulesets: ['Pega-ProcessCommander:08-26', 'Pega-RULES:08-26'], builtOn: [] },
        ],
      };
    },
    async list({ type }) {
      calls.push(['list', type]);
      if (failures.includes(type)) throw new Error('500 Internal Server Error');
      return rows.filter((r) => r.type === type).map((r) => ({ ...r }));
    },
    async read(key) {
      calls.push(['read', key]);
      if (!raws.has(key)) throw new Error(`unknown key: ${key}`);
      return raws.get(key);
    },
    // Writes: recorded, not applied (the fake cannot produce the TOON of a new rule).
    async create(request) {
      calls.push(['create', request]);
      // Like the real server: a warning even on success.
      return { status: 'created', warning: 'Rule write succeeded, but the completed branch summary was not updated.' };
    },
    async update(request) {
      calls.push(['update', request]);
      return { status: 'updated' };
    },
    async close() {},
  };
}
