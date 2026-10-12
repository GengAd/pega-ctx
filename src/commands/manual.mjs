// Types the Pega MCP cannot write: create-rule, update-rule and copy-rule refuse a class without a
// schema, before Pega (docs/mcp-tools.md). create --draft and update --draft still write the draft,
// marked for Dev Studio: a developer applies it by hand, pega-ctx send refuses it.
import { TYPES, writable } from '../mcp/tools.mjs';

export const isManual = (type) => !writable(type);

export const cannotWrite = (type) => `the Pega MCP cannot write a ${type}: create-rule and update-rule refuse ${TYPES[type] ?? type}, they have no schema for it`;

// Fields Dev Studio's Save As sets itself: not listed among the changes.
const SAVE_AS = ['/pxObjClass', '/pyClassName', '/pyRuleName', '/pyStreamName'];

// The header fields of a draft for Dev Studio: why it will not be sent, the steps, and for a creation
// the paths that differ from the template, apart from what Save As sets.
export function manualHeader({ operation, id, type, cls, name, from, ruleset, branch, changed }) {
  const where = `In Dev Studio, ${branch ? `branch ${branch}` : 'in your branch'}`;
  const steps =
    operation === 'create'
      ? [
          `${where}: open ${from} and Save As ${name}, class ${cls}, ruleset ${ruleset ?? '(ask)'}`,
          'Give each path of "changed" its value in "content"; a path absent from "content" is cleared',
        ]
      : [`${where}: open ${id}`, 'Give each field of "content" its value: an array replaces the whole list, null clears the field'];
  return {
    manual: `${cannotWrite(type)}: pega-ctx send will not send this draft, a developer applies it by hand`,
    steps: [...steps, `Then pega-ctx live ${id}, and delete this file`],
    ...(changed ? { changed: changed.filter((p) => !SAVE_AS.includes(p)) } : {}),
  };
}

// JSON pointers where after differs from before. An array whose length changed is one change.
export function changedPaths(before, after, pointer = '') {
  const tree = (v) => v !== null && typeof v === 'object';
  const sameShape = tree(before) && tree(after) && Array.isArray(before) === Array.isArray(after) && (!Array.isArray(after) || after.length === before.length);
  if (sameShape) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((k) => changedPaths(before[k], after[k], `${pointer}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`));
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [pointer];
}

// What create and update say next to a draft for Dev Studio.
export const manualNote = (path, type) => `draft written for Dev Studio: ${path}\n${cannotWrite(type)}: pega-ctx send will not send it. Give the draft to a developer: its "steps" say what to do`;
