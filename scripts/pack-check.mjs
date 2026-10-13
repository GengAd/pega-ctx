// node scripts/pack-check.mjs <npm pack --dry-run --json output>: fails if the package holds a file
// outside what pega-ctx ships (bin/, src/, templates/, and the files npm always adds).
import { readFileSync } from 'node:fs';

const ALLOWED = [/^bin\//, /^src\//, /^templates\//, /^package\.json$/, /^README\.md$/, /^CHANGELOG\.md$/, /^LICENSE/i];

const [file] = process.argv.slice(2);
if (!file) {
  console.error('usage: npm pack --dry-run --json > pack.json && node scripts/pack-check.mjs pack.json');
  process.exit(1);
}
const [pack] = JSON.parse(readFileSync(file, 'utf8'));
const paths = pack.files.map((f) => f.path.replaceAll('\\', '/'));
const outside = paths.filter((p) => !ALLOWED.some((a) => a.test(p)));
if (outside.length) {
  console.error(`the package holds files it should not ship:\n${outside.map((p) => `- ${p}`).join('\n')}\ncorrect "files" in package.json`);
  process.exit(1);
}
console.log(`${pack.name} ${pack.version}: ${paths.length} files, ${pack.size} bytes packed, nothing outside bin/, src/, templates/`);
