// ServiceMCP: the MCP tools the application exposes to external agents.
// Fields read on the fixture: pyUsage, pyIsMCPServiceEnabled, pyMCPVersion, pzMCPTools[].{pyPurpose,pyCategory}
// (docs/projection.md). pzCaseTypeTools is empty on the fixture: only counted.
import { filled, items, typeOfRaw } from './common.mjs';

export function body(o) {
  const lines = [];
  if (filled(o.pyUsage)) lines.push('', o.pyUsage);
  lines.push('', `enabled: ${o.pyIsMCPServiceEnabled === 'true' ? 'yes' : 'no'}`);
  if (filled(o.pyMCPVersion)) lines.push(`MCP version: ${o.pyMCPVersion}`);
  // Each row names an AI tool (key pyPurpose) and the kind of rule it runs; the tool's class is not in the row.
  const tools = items(o.pzMCPTools).filter((t) => filled(t.pyPurpose));
  if (tools.length) {
    lines.push('', '## Tools');
    for (const t of tools) lines.push(`- ${t.pyPurpose} (${typeOfRaw({ pxObjClass: t.pyCategory }) ?? t.pyCategory})`);
  }
  const caseTypeTools = items(o.pzCaseTypeTools).length;
  if (caseTypeTools) lines.push('', `case type tools: ${caseTypeTools}`);
  return { lines, references: [] };
}
