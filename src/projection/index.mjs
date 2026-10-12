// digest(raw) → { type, id, class, name, markdown, references }.
// Six-line header, type-specific body, `## References`. `## Cited by` depends on the graph:
// the mirror adds it when writing the digest (src/mirror/).
import { decodeToon } from '../mcp/toon.mjs';
import { typeOfRaw, ruleId, filled } from './common.mjs';
import { probableReferences } from './generic.mjs';
import * as adminsystemsettings from './adminsystemsettings.mjs';
import * as aiagent from './aiagent.mjs';
import * as aitool from './aitool.mjs';
import * as asyncqueueprocessor from './asyncqueueprocessor.mjs';
import * as attachmentcategory from './attachmentcategory.mjs';
import * as classmetadata from './classmetadata.mjs';
import * as connectgenerativeai from './connectgenerativeai.mjs';
import * as connectrest from './connectrest.mjs';
import * as decisiondataset from './decisiondataset.mjs';
import * as correspondence from './correspondence.mjs';
import * as correspondencetype from './correspondencetype.mjs';
import * as editvalidate from './editvalidate.mjs';
import * as fieldvalue from './fieldvalue.mjs';
import * as notification from './notification.mjs';
import * as servicelevel from './servicelevel.mjs';
import * as servicemcp from './servicemcp.mjs';
import * as activity from './activity.mjs';
import * as casetype from './casetype.mjs';
import * as cls from './class.mjs';
import * as datapage from './datapage.mjs';
import * as datatransform from './datatransform.mjs';
import * as decisiontable from './decisiontable.mjs';
import * as flow from './flow.mjs';
import * as flowaction from './flowaction.mjs';
import * as property from './property.mjs';
import * as reportdefinition from './reportdefinition.mjs';
import * as section from './section.mjs';
import * as validate from './validate.mjs';
import * as view from './view.mjs';
import * as when from './when.mjs';

export const PROJECTIONS = {
  AdminSystemSettings: adminsystemsettings,
  AIAgent: aiagent,
  AITool: aitool,
  AsyncQueueProcessor: asyncqueueprocessor,
  AttachmentCategory: attachmentcategory,
  ClassMetadata: classmetadata,
  ConnectGenerativeAI: connectgenerativeai,
  ConnectREST: connectrest,
  DecisionDataSet: decisiondataset,
  Correspondence: correspondence,
  CorrespondenceType: correspondencetype,
  EditValidate: editvalidate,
  FieldValue: fieldvalue,
  Notification: notification,
  ServiceLevel: servicelevel,
  ServiceMCP: servicemcp,
  Activity: activity,
  CaseType: casetype,
  Class: cls,
  DataPage: datapage,
  DataTransform: datatransform,
  DecisionTable: decisiontable,
  Flow: flow,
  FlowAction: flowaction,
  Property: property,
  ReportDefinition: reportdefinition,
  Section: section,
  Validate: validate,
  View: view,
  When: when,
};

export const MAX_LINES = 100;
// The digest shows at most thirty references; `references` (and thus the graph) keeps them all.
export const MAX_REFERENCES = 30;

const AVAILABLE = { Yes: 'yes', No: 'no', Blocked: 'blocked', Withdrawn: 'withdrawn', Final: 'final' };

// line: the index or list() line (updated, by, description); index: the known rules,
// for generic detection; otherVersions: ['Ruleset:01-01-01', …] besides the raw rule's own;
// resolve: context id → index id (src/mirror/graph.mjs), identity by default;
// reserve: lines kept for what the mirror adds (`## Cited by`).
export function project(toon, { line = {}, index = [], otherVersions = [], resolve = (id) => id, reserve = 0 } = {}) {
  const o = typeof toon === 'string' ? decodeToon(toon) : toon;
  const type = typeOfRaw(o) ?? line.type;
  if (!type) throw new Error(`not a Pega rule (pxObjClass: ${o.pxObjClass ?? 'missing'}): the raw content is damaged, run pega-ctx live on it`);
  const ruleClass = o.pyClassName ?? ''; // a rule with no class (EditValidate) has none
  const name = o.pyRuleName ?? line.name;
  const id = ruleId(type, ruleClass, name);

  const projection = PROJECTIONS[type];
  const { lines: body, references: sure } = projection
    ? projection.body(o)
    : { lines: ['', 'body: type without projection, see docs/projection.md'], references: [] };
  const resolved = sure.map((r) => ({ ...r, to: resolve(r.to) }));
  const probable = probableReferences(o, type, index, new Set(resolved.map((r) => r.to)));
  const seen = new Set([id]);
  const references = [...resolved, ...probable].filter((r) => !seen.has(r.to) && seen.add(r.to));

  const own = filled(o.pyRuleSetVersion) ? `${o.pyRuleSet}:${o.pyRuleSetVersion}` : o.pyRuleSet;
  const others = otherVersions.filter((v) => v !== own);
  const header = [
    `# ${type} ${name}`,
    `class: ${ruleClass}`,
    `rulesets: ${own}${others.length ? ` (also: ${others.join(', ')})` : ''}`,
    `description: ${o.pyLabel ?? line.description ?? ''}`,
    `updated: ${filled(line.updated) ? line.updated.slice(0, 10) : 'unknown date,'} by ${line.by ?? o.pxUpdateOperator ?? 'unknown'}`,
    `available: ${AVAILABLE[o.pyRuleAvailable] ?? o.pyRuleAvailable ?? 'unknown'}`,
  ];
  const shown = references.slice(0, MAX_REFERENCES).map(referenceLine);
  if (references.length > MAX_REFERENCES) shown.push(`… ${references.length - MAX_REFERENCES} more: pega-ctx around ${id} --depth 1`);
  const refs = ['', '## References', ...(shown.length ? shown : ['none'])];

  // A hundred lines at most: the body is cut, the header and the references stay.
  const room = MAX_LINES - header.length - refs.length - 1 - reserve;
  const cutBody = body.length > room
    ? [...body.slice(0, room), `… ${body.length - room} more lines: pega-ctx rule ${id} --raw`]
    : body;
  return { type, id, class: ruleClass, name, markdown: [...header, ...cutBody, ...refs].join('\n') + '\n', references };
}

function referenceLine(r) {
  return `- ${r.to}${r.confidence === 'probable' ? ' ?' : ''} (${r.via})`;
}
