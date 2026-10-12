// Index line of a rule from its versions returned by list() and its decoded raw rule.
// Shared by sync and live.
export const versionDescending = (a, b) => String(b.version ?? '').localeCompare(String(a.version ?? ''), 'en', { numeric: true });

// versions: list() rows of the same rule, highest first; o: the decoded raw rule of the highest.
export function indexLine(type, versions, o) {
  const top = versions[0] ?? {};
  const rulesets = versions.filter((v) => v.ruleset).map((v) => `${v.ruleset}:${v.version}`);
  const cls = o.pyClassName ?? ''; // a rule with no class (EditValidate) has an empty class
  return {
    id: `${type}:${cls}:${o.pyRuleName}`,
    type,
    class: cls,
    name: o.pyRuleName,
    // A class is not versioned: empty pyRuleSetVersion, the ruleset alone.
    rulesets: rulesets.length ? rulesets : [o.pyRuleSetVersion ? `${o.pyRuleSet}:${o.pyRuleSetVersion}` : o.pyRuleSet],
    description: top.description || o.pyLabel || '',
    ...(top.updated ? { updated: top.updated } : {}),
    by: top.by ?? o.pxUpdateOperator,
  };
}
