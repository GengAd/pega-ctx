// DataPage: structure, scope, refresh, parameters, sources in order.
// Fields read on the fixture; the field naming the source rule per source type comes from the
// server skill rules-rule-declare-pages (docs/projection.md).
import { filled, items, references } from './common.mjs';

// pyDeclarePagesDataSource → [name field, class field, pega-ctx type of the source rule].
const SOURCES = {
  ReportDefinition: ['pyLoadReportDefinition', 'pyReportDefinitionClass', 'ReportDefinition'],
  DataTransform: ['pyDTName', 'pyClassName', 'DataTransform'],
  LoadActivity: ['pyLoadActivity', 'pyClassName', 'Activity'],
  Connector: ['pyConnectorName', 'pyConnectorClassName', undefined],
  ObjOpen: ['pyLookupName', 'pyLookupClassName', undefined],
};

export function body(o) {
  const refs = references();
  const lines = [];
  if (filled(o.pyDescription)) lines.push('', o.pyDescription);
  const settings = [
    `structure ${o.pyStructure}`,
    filled(o.pyScope) ? `scope ${o.pyScope}` : '',
    filled(o.pyPageType) && o.pyPageType !== 'normal' ? `type ${o.pyPageType}` : '',
    filled(o.pyRefreshStrategy) ? `refresh ${o.pyRefreshStrategy}` : '',
  ].filter(Boolean);
  lines.push('', settings.join(', '));
  const parameters = items(o.pyParameters).map((p) => p.pyParametersParamName).filter(filled);
  if (parameters.length) lines.push(`parameters: ${parameters.join(', ')}`);
  const keys = items(o.pyKeysForPageList).map((k) => k.pyKeyName ?? k.pyPropertyName).filter(filled);
  if (keys.length) lines.push(`keys: ${keys.join(', ')}`);

  const sources = items(o.pyDataSourceList);
  if (sources.length) lines.push('', '## Sources');
  sources.forEach((s, i) => {
    const type = s.pyDeclarePagesDataSource;
    const [nameField, classField, ruleType] = SOURCES[type] ?? [];
    const name = nameField ? s[nameField] : undefined;
    const cls = (classField && filled(s[classField]) ? s[classField] : undefined) ?? o.pyClassName;
    const when = filled(s.pySourceWhen) && s.pySourceWhen !== 'Always' ? `, if ${s.pySourceWhen}` : '';
    lines.push(`${i + 1}. ${type}${filled(name) ? ` ${name}` : ''}${cls !== o.pyClassName ? ` (${cls})` : ''}${when}`);
    if (ruleType && filled(name)) refs.add(ruleType, cls, name, 'source');
    for (const field of ['pyReqDataTransform', 'pyResDataTransform']) {
      if (filled(s[field])) {
        lines.push(`   ${field === 'pyReqDataTransform' ? 'request' : 'response'}: data transform ${s[field]}`);
        refs.add('DataTransform', o.pyClassName, s[field], 'source');
      }
    }
  });
  return { lines, references: refs.all() };
}
