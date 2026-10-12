// EditValidate: the Java body of the check, as written by the developer (pyJavaCode).
// pyJavaClassName / pyJavaStream are generated and stay dropped. Fields read on the fixture: pyWorkClass, pyJavaCode.
import { filled } from './common.mjs';

export function body(o) {
  const lines = [];
  if (filled(o.pyWorkClass)) lines.push('', `work class: ${o.pyWorkClass}`);
  lines.push('', '## Code', '```java', ...String(o.pyJavaCode ?? '').split('\n').map((l) => l.replace(/\t/g, '  ')), '```');
  return { lines, references: [] };
}
