// The only layer that talks to Pega: launches the Pega MCP over stdio and calls its tools.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as tools from './tools.mjs';

const PLUGIN_CACHE = join(homedir(), '.claude/plugins/cache/Pega/pega-infinity-authoring');

// Folder of the Pega plugin: PEGA_CTX_PLUGIN (any variant, Claude Code, Copilot, Codex: the folder holding
// .mcp.json and resources/), otherwise the highest version in Claude Code's plugin cache.
export function pluginFolder(root = PLUGIN_CACHE, given = process.env.PEGA_CTX_PLUGIN) {
  if (given) {
    if (!existsSync(join(given, '.mcp.json'))) throw new Error(`no .mcp.json in PEGA_CTX_PLUGIN (${given}): give the Pega plugin folder that holds .mcp.json and resources/`);
    return given;
  }
  if (!existsSync(root)) {
    throw new Error(`Pega plugin not found in ${root}: install pega-infinity-authoring in Claude Code, or set PEGA_CTX_PLUGIN to the plugin's folder (Copilot, Codex)`);
  }
  const versions = readdirSync(root).filter((v) => /^\d/.test(v));
  if (!versions.length) throw new Error(`no version of the Pega plugin in ${root}: reinstall the plugin`);
  versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return join(root, versions.at(-1));
}

// Launch command read from the plugin's .mcp.json.
// The ${user_config.*} entries are dropped: the server reads ~/.infinity-rules-mcp/config.json itself.
export function commandFromPlugin(folder = pluginFolder()) {
  const mcp = JSON.parse(readFileSync(join(folder, '.mcp.json'), 'utf8'));
  const [server] = Object.values(mcp.mcpServers ?? {});
  if (!server) throw new Error(`no server in ${folder}/.mcp.json: reinstall the Pega plugin`);
  const replace = (s) => s.replaceAll('${CLAUDE_PLUGIN_ROOT}', folder).replaceAll('${PLUGIN_ROOT}', folder);
  const env = {};
  for (const [key, value] of Object.entries(server.env ?? {})) {
    if (!value.includes('${user_config.')) env[key] = replace(value);
  }
  return { command: server.command, args: (server.args ?? []).map(replace), env };
}

// Raw client: tools() and call(name, arguments). The server writes its tokens in cwd.
export async function open({ command, args, env = {}, cwd = process.cwd() } = commandFromPlugin()) {
  const transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env: { ...process.env, ...env },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'pega-ctx', version: '0.0.0' });
  try {
    await client.connect(transport);
  } catch (e) {
    throw new Error(`Pega MCP unreachable (${e.message}): check java -version (17+) and ~/.infinity-rules-mcp/config.json`);
  }
  return {
    async tools() {
      const all = [];
      let cursor;
      do {
        const page = await client.listTools(cursor ? { cursor } : {});
        all.push(...page.tools);
        cursor = page.nextCursor;
      } while (cursor);
      return all;
    },
    async call(name, toolArguments = {}) {
      const res = await client.callTool({ name, arguments: toolArguments }, undefined, { timeout: 300_000 });
      const text = (res.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (res.isError) {
        const error = new Error(`${name}: ${text.slice(0, 300)}`);
        error.text = text;
        throw error;
      }
      return res.structuredContent ?? text;
    },
    close: () => client.close(),
  };
}

// The interface used by the rest of pega-ctx. `call(name, args)` is the only point of contact:
// the tests inject a fake that serves the fixture.
export function pegaInterface(call, close = async () => {}) {
  return {
    stack: () => tools.stack(call),
    applications: () => tools.applications(call),
    alias: (name) => tools.alias(call, name),
    list: (filter) => tools.list(call, filter),
    read: (key) => tools.read(call, key),
    create: (request) => tools.create(call, request),
    update: (request) => tools.update(call, request),
    close,
  };
}

export async function connect(command) {
  const raw = await open(command);
  return pegaInterface(raw.call, raw.close);
}
