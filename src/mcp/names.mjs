// Short type name of a Pega rule class, the first part of an identifier `Type:Class:Name`.
// The names of the specification are kept; any other class gets a name built from it
// (Rule-Obj-ServiceLevel → ServiceLevel), so that every rule class has one.
const NAMED = {
  'Rule-Obj-CaseType': 'CaseType',
  'Rule-Obj-Flow': 'Flow',
  'Rule-Obj-FlowAction': 'FlowAction',
  'Rule-HTML-Section': 'Section',
  'Rule-UI-View': 'View',
  'Rule-Obj-Model': 'DataTransform',
  'Rule-Obj-When': 'When',
  'Rule-Obj-Activity': 'Activity',
  'Rule-Declare-DecisionTable': 'DecisionTable',
  'Rule-Obj-Property': 'Property',
  'Rule-Declare-Pages': 'DataPage',
  'Rule-Obj-Validate': 'Validate',
  'Rule-Obj-Report-Definition': 'ReportDefinition',
  'Rule-Obj-Class': 'Class',
  'Rule-Obj-Corr': 'Correspondence',
  'Rule-CorrType': 'CorrespondenceType',
};

export function shortName(ruleClass) {
  if (NAMED[ruleClass]) return NAMED[ruleClass];
  return ruleClass
    .split('-')
    .filter((part, i) => !(i === 0 && part === 'Rule') && !(i === 1 && ['Obj', 'Declare'].includes(part)))
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}
