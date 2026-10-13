// Command table and argument parsing, without a library.
import * as around from './around.mjs';
import * as check from './check.mjs';
import * as create from './create.mjs';
import * as doctor from './doctor.mjs';
import * as examples from './examples.mjs';
import * as init from './init.mjs';
import * as install from './install.mjs';
import * as lint from './lint.mjs';
import * as live from './live.mjs';
import * as measure from './measure.mjs';
import * as overrides from './overrides.mjs';
import * as rule from './rule.mjs';
import * as runCase from './run-case.mjs';
import * as search from './search.mjs';
import * as send from './send.mjs';
import * as stack from './stack.mjs';
import * as sync from './sync.mjs';
import * as units from './units.mjs';
import * as update from './update.mjs';
import { mirror } from '../mirror/files.mjs';
import { addTypes } from '../mcp/tools.mjs';
import { pluginSchemas } from '../mcp/schemas.mjs';
import { pluginExamples } from '../mcp/examples.mjs';

export const COMMANDS = { doctor, init, install, sync, stack, search, rule, around, overrides, live, create, examples, update, send, lint, check, 'run-case': runCase, units, measure };

// The MCP client is only loaded by the commands that talk to Pega; the tests pass a fake.
async function connectPega() {
  const { connect } = await import('../mcp/client.mjs');
  return connect();
}

// `--key value`, `--flag` (true), the rest as positionals. `--key=value` too.
export function parse(argv) {
  const [command, ...rest] = argv;
  const positionals = [];
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) {
      positionals.push(a);
      continue;
    }
    const [key, value] = a.slice(2).split(/=(.*)/s, 2);
    if (value !== undefined) options[key] = value;
    else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) options[key] = rest[++i];
    else options[key] = true;
  }
  return { command, positionals, options };
}

// context: { root, connect }; by default the current folder and the plugin's Pega MCP.
export async function launch({ command, positionals, options }, context = {}) {
  const { root = process.cwd(), connect = connectPega, schemas = pluginSchemas(), examples: exampleFiles = pluginExamples() } = context;
  const mod = COMMANDS[command];
  if (!mod) {
    const known = Object.keys(COMMANDS).join(', ');
    return { code: 1, output: `${command ? `unknown command: ${command}` : 'no command'}: choose among ${known}` };
  }
  try {
    // Rule classes the project follows on top of the known types ("types" in .pega/config.json).
    const m = mirror(root);
    if (m.exists()) addTypes(m.readConfig().types);
    return await mod.run({ ...context, positionals, options, root, connect, schemas, examples: exampleFiles });
  } catch (e) {
    return { code: 1, output: e.message };
  }
}
