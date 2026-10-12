#!/usr/bin/env node
// Arguments → src/commands/<command>.mjs. Each command returns { code, output }; a failure says what to do.
import { parse, launch } from '../src/commands/index.mjs';

const { code, output } = await launch(parse(process.argv.slice(2)));
if (output) (code === 0 ? process.stdout : process.stderr).write(`${output}\n`);
process.exit(code);
