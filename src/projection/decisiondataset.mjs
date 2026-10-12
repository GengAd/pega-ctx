// DecisionDataSet: what the data set reads and by which keys.
// Fields read on the fixture: pyTypeLabel, pyConfiguration.{pyTableName,pyKeys[].pyKey,pyPartitionKey} (docs/projection.md).
import { filled, items, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const c = o.pyConfiguration ?? {};
  const lines = ['', `kind: ${o.pyTypeLabel ?? o.pyType}`];
  if (filled(c.pyTableName)) lines.push(`table: ${c.pyTableName}`);
  const keys = items(c.pyKeys).map((k) => k.pyKey).filter(filled);
  if (keys.length) lines.push(`keys: ${keys.join(', ')}`);
  if (filled(c.pyPartitionKey)) lines.push(`partition key: ${c.pyPartitionKey}`);
  for (const k of [...keys, c.pyPartitionKey]) refs.property(o.pyClassName, k, 'key');
  return { lines, references: refs.all() };
}
