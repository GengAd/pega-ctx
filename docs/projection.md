# Projection per type

For each type: fields kept, fields dropped, and why. The names come from `tests/fixture/raw/` (see `/fixture`).

Per type: what the digest keeps, then the raw list of top-level fields as a full `get-rule` returns them. Any field not cited under "Kept" is dropped. Each projection has at least one fixture rule (checked by `tests/projection.test.mjs`). The 14 types below, then the 13 of the last section, have a projection; every other type of `TYPES` (`docs/mcp-tools.md` § Pega types and classes), and any rule class outside it, gets the header, the line `body: type without projection` and the generic references, until a real rule of that type enters the fixture (types still without one: the ruleset types, Declare-*, and the writable types whose server stub Pega refuses: AsyncJobScheduler, AsyncQueueProcessor, DecisionDataSet, ConnectGenerativeAI, TestUnitCase, TestApplicationCase, TestApplicationBusinessAction, UITheme).

## Cross-cutting rules

- **Header**: six lines, always. `updated` comes from the `list()` row (`updated`, `by`); a CaseType has no date in `list()`, the digest writes `unknown date`. `rulesets`: the raw rule's own, the other versions as `(also: …)` when the mirror knows them.
- **`## Cited by`** is not produced by the projection: it depends on the graph, the mirror adds it when writing `digest/` (step 4). The expected digests of `tests/fixture/digest/` therefore do not have it.
- **Class of the references**: the class of the context (the rule, the page iterated by a data transform, the `targetObjectClass` of a view list, the `ruleClass` of an included view). pega-ctx does not resolve inheritance: the graph matches a reference to an index rule by name and parent class.
- **Standard properties** (`px`, `py`, `pz` prefix): never a reference, they are not in the application and would fill `check` with false misses.
- **Size**: a hundred lines at most. The body is cut first (`… N more lines: pega-ctx rule <id> --raw`), references are limited to thirty (`… N more: pega-ctx around <id> --depth 1`). `references` keeps everything for the graph.
- **Generic detection** (`src/projection/generic.mjs`): by identifier **token** in each string, not by whole string, because a When cites its table inside an expression (`@pxEvaluateDecisionTable(…, "IgnoredRegistrationType")`). Same class or parent class by name pattern (`A-B` parent of `A-B-C`, `@baseclass` parent of everything). Ignored: `pz*` fields, generated code and prose (`pySourceStream`, `pyJavaStream`, `pyStreamName`, `pyLabel`, `pyDescription`…), and the rule's own name (a View cites its own name, which is also its FlowAction's). Edges found this way have `via` `name match`.
- **Role of a field**: the name is read on the fixture; when its role is not obvious (pre or post), it comes from the server skill (`get-skill rules-rule-obj-<class>`), never from a guess. A shape or component absent from the fixture is rendered as is (type, name, implementation), without a sure reference: generic detection catches it.
- **Language**: the digest's vocabulary is English; labels, descriptions and stage names are the application's own and stay as written in Pega.

## Common to the 14 projected types

`pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyClassName` `pyLabel` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyValueChanged` `pzChecksum` `pzIndexCount` `pzInsKey` `pzOriginalInstanceKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

Digest header: `pyRuleName`, `pyClassName`, `pyLabel`, `pyRuleSet` + `pyRuleSetVersion`, `pyRuleAvailable`. `pxUpdateOperator` is the raw rule's only operator, without a date: the date comes from `list()`. Dropped on principle: `pzInsKey`, `pzOriginalInstanceKey`, `pzChecksum`, `pzIndexCount`, `pzRuleSetVersionMajor` / `Minor` / `Patch` (repeat `pyRuleSetVersion`), `pyValueChanged`.

Families that recur beyond the common ones, to drop unless proven otherwise: `pyJava*` (generated code), `pyXMLSignature`, `pyRelativePath`, `pyStreamName`, `pyTaskStatusXml`, `pyVisioJpeg` / `pyVisioRFB` (flow drawing), `pxMoveFromSystem`, `pySPRuleSetName` (private ruleset, carries an operator identifier), `pyCircumstance*` empty when the rule is not circumstanced.

## Activity

Fixture: `MONORG-Test-Work-GetInfo:SaveHouseholdPeople`.

Kept: `pyDescription`; `pyActivityType` other than `ACTIVITY`; names of `pyParameters`; `pySteps`, recursive, numbered `1.2.3`: `pyStepsActivityName` (method), `pyStepsObjectName` (page), `pyStepsRepeatDef.pyStepsRepeatDefHasRepeat` (`EMBEDDED` → "for each page"), `pyStepsPreCondParams[].pyStepsPreCondParamsWhen`, `pyStepsDescription`, then the non-empty parameters of `pyStepsCallParams` and `pyParamArray`. References: `DataTransform` of an `Apply-DataTransform`, `DataPage` of a `Save-DataPage`, `Property` of a `Property` / `PropertiesName` parameter, in the class of the step's page (`pyPagesAndClasses`). Dropped: `pyStepsPageAliases`, `pyStepsTransParams`, `pyForEachValidClasses`, `pyTaskStatusXml`, generated code.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pyActivityName` `pyActivityPrivilegeList` `pyActivityRolesList` `pyActivityType` `pyAuthenticatedOnly` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyDescription` `pyJavaClassName` `pyJavaGenerateAPIVersion` `pyJavaGenerateTime` `pyJavaGenerateVersion` `pyJavaStream` `pyLocalParameters` `pyOldActivityType` `pyPagesAndClasses` `pyParameters` `pyRelativePath` `pyStatus` `pySteps` `pyTaskStatusXml` `pyXMLSignature`

## CaseType

Fixture: `MONORG-Test-Work-GetInfo:pyDefault`.

Kept: `pyDescription` (under the header when it differs from `pyLabel`); `pyStages` then `pyAlternateStages`, in order: `pyStageName`, `pyIsInitializationStage`, `pyIsTerminalStage`, `pyStageEntryStatus`, `pyStageWorkStatus`, `pyStageTransition` (other than `automatic`), and for each `pyProcesses` the `pyLabel` and the `pyFlowName` (reference `Flow`, via `process`); `pyCasetypeStartingFlows` (`pyStartingFlowType`, `pyAutomaticStart`; reference `Flow`, via `start`). Dropped: stage and flow identifiers (`pyStageID`, `pxFlowID`), channels, geolocation, display settings (`pyIcon`, `pyLifeCycleTabs`, `pyProcessesViewMode`), counters (`pyStageIDMax`), warnings. No data model: in Constellation, it is not in the CaseType but in the class's properties.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pyAllowRemoteInstantiation` `pyAltStageIDMax` `pyAlternateStages` `pyAttachments` `pyCalculations` `pyCaseMatchList` `pyCaseOptionalProcesses` `pyCasePredictions` `pyCaseWideLocalActions` `pyCasetypeStartingFlows` `pyConstantTrackingEnabled` `pyCoverableClasses` `pyDependents` `pyDescription` `pyDoNotLockParent` `pyEnableSearch` `pyFlowOutlineContainer` `pyFlowsToStart` `pyHideSaveButton` `pyIcon` `pyInitialCaseUrgency` `pyIsConstellationCase` `pyIsRemote` `pyJavaClassName` `pyLPGeolocationEnabled` `pyLPGeolocationStatus` `pyLifeCycleTabs` `pyLocaleReference` `pyLockingMode` `pyPagesAndClasses` `pyParameters` `pyPreviousValues` `pyProcessesViewMode` `pyPurpose` `pyRelatedClasses` `pyStageIDMax` `pyStages` `pyStatusGroups` `pyTemplateTrueFalse` `pyToolBarSettings` `pyWorkPartiesRule` `pyXMLSignature` `pzGeolocationWhenExists` `pzShowLifeCycleStagesOnly` `pzSpecializationsCount`

## Class

Fixture: `MONORG-Test-Work-GetInfo` (GetInfo's work class). Identifier `Class:<Class>:<Class>`: `pyRuleName` holds the class name. A class is not versioned (empty `pyRuleSetVersion`): `rulesets` only carries the ruleset. It is created before any rule that applies to it (`docs/mcp-tools.md` § create).

Kept: `pyDescription`; `pyDerivesFrom` (parent, `derives from`), with `pyPatternInheritance`; `pyClassGroupIndicator` and `pyClassGroup` for a group member; `pyClassType` (`kind`); `pyKeyDefList[].pyKeyName` (business key, shape read in `get-skill rules-rule-obj-class/examples/pyKeyDefList`, empty on the fixture); `pyUsage` if it differs from the description. No reference: the parent is often a Pega class (`Work-`, `Data-`), outside the mirror. Dropped: `pxClassSQL` (table mapping), `pyInitialVersion`, `pyAutogeneratedKey`, `pyAnyErrorsOnClassValidation`, `pyErrorMessage`, `pyMethodStatus`, `pyValueChanged`, empty lists of locks and generators.

Raw fields: `pxAPIMethodReferences` `pxClassSQL` `pxNamedPageReferences` `pyAnyErrorsOnClassValidation` `pyAutogeneratedKey` `pyBaseRule` `pyCategory` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassGroup` `pyClassGroupIndicator` `pyClassName` `pyClassType` `pyDerivesFrom` `pyDescription` `pyErrorMessage` `pyFormType` `pyInitialVersion` `pyKeyDefList` `pyLabel` `pyLockDefList` `pyMethodStatus` `pyOtherJavaGenerators` `pyPatternInheritance` `pyRuleAvailable` `pyRuleName` `pyRuleResolution` `pyUsage` `pyValidRuleSets` `pyValueChanged`

## DataPage

Fixture: `MONORG-Test-Data-People:D_PeopleList`.

Kept: `pyDescription`; `pyStructure`, `pyScope`, `pyPageType` (other than `normal`), `pyRefreshStrategy`; names of `pyParameters`; `pyDataSourceList[]` in order: `pyDeclarePagesDataSource` and the field that names the source, according to the server skill `rules-rule-declare-pages` (ReportDefinition `pyLoadReportDefinition` + `pyReportDefinitionClass`, DataTransform `pyDTName`, LoadActivity `pyLoadActivity`, Connector `pyConnectorName` + `pyConnectorClassName`, ObjOpen `pyLookupName`), `pySourceWhen` other than `Always`, `pyReqDataTransform` / `pyResDataTransform`. Reference `source` to the rule (except Connector and ObjOpen, outside `TYPES`). Dropped: `pyLoadActivity` of a ReportDefinition source (`pxCallRetrieveReportData`, internal), `pyDisabledSource`, timeouts, save settings, empty circumstancing.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxSavedInPegaVersion` `pyAccessGroup` `pyAdditionalDependencies` `pyAllowDuplicates` `pyAllowExternalExpiration` `pyAllowIdle` `pyAllowOverride` `pyCircumstanceDate` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyCircumstanceType` `pyCircumstanceVal` `pyDataPageSaveOptionList` `pyDataSourceList` `pyDeclarePagesDataSource` `pyDescription` `pyEnableLoadOnlyPage` `pyIsQueryable` `pyIsSimulated` `pyJavaStream` `pyKeepOneCopy` `pyKeyPageReference` `pyKeysForPageList` `pyLoadActivity` `pyLoadActivityParameters` `pyLoadOnlyPageEnabled` `pyLoadReportDefinition` `pyMethodStatus` `pyPageContext` `pyPageContextClass` `pyPageName` `pyPageType` `pyPagesAndClasses` `pyParameters` `pyRefreshDataPageAfterSave` `pyRefreshOncePerInteraction` `pyRefreshStrategy` `pyReportDefinitionClass` `pyRuleEnds` `pyRuleStarts` `pySaveOptionsCount` `pyScope` `pySortDateCircumWithinRSMajor` `pySourceCount` `pyStructure` `pyTimeoutDD` `pyTimeoutHH` `pyTimeoutMM` `pyTimeoutSS` `pyType` `pyUsage` `pyUseTimeout` `pyUseWhen` `pyWhen` `pyWorkKey` `pyXMLSignature` `pzIsThreadFamilyEnabled`

## DataTransform

Fixture: `MONORG-Test-Work-GetInfo:BuildHouseholdReferences`.

Kept: `pyProperties`, recursive, in order: `pyPropertyStepId`, `pyActionName` (SET, APPEND_TO, APPEND_AND_MAP_TO, FOR_EACH_PAGE_IN rendered in words; the others as is), `pyPropertiesName` (target, reference `Property`), `pyPropertiesValue` (source: `Property` if `.Name`, `DataPage` if `D_…`), `pyDisabled`; `pyPagesAndClasses` (`pages:` line, and context class of nested actions); `pyCallSuperClassModel` when true. Dropped: `pyRelationNameAppend`, `pyExpanded`, `pyUpdateSourceContext` (editor settings), `pxNamedPageReferences` (repeats `pyPagesAndClasses`), generated code, warnings.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pyCallSuperClassModel` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyDataModelFormat` `pyJavaClassName` `pyJavaStream` `pyModelName` `pyOfflineValidationMessage` `pyPagesAndClasses` `pyProperties` `pyXMLSignature` `pzIsAutoGenerated`

## DecisionTable

Fixture: `OrgEv-Int-CventAtt-Data:IgnoredRegistrationType`.

Kept: `pyDescription`; Markdown table: one column per `pyColumns[]` (`pyPropertyLabel` and `pyProperty`, value `pyDefaultOperator` + `pyCondition[i]`), one per filled `pyPropertyColumns[]` (`pyPropertyValues[i]`), then `pyResults[i]`; `pyDefaultResult` as `otherwise:` (the string `"false"` is a result there). Reference `Property`: first segment of each `pyProperty`. Dropped: `pyColumnPreferences` (widths), `pyColumnRestrictions`, empty `pyInitialPropSet`, size thresholds, empty `pyOrConditions`.

Raw fields: `pxAPIMethodReferences` `pxMoveFromSystem` `pxNamedPageReferences` `pxServerReqURI` `pyAction` `pyAdditionalDependencies` `pyAllowedResultsProperty` `pyAllowedToLoadResults` `pyAllowedValues` `pyCircumstanceDate` `pyCircumstanceDateProp` `pyCircumstanceDefinition` `pyCircumstanceProp` `pyCircumstanceTemplate` `pyCircumstanceType` `pyCircumstanceVal` `pyColumnPreferences` `pyColumns` `pyDefaultAction` `pyDefaultResult` `pyDefaultResultPropSet` `pyDelegatedRestrictions` `pyDescription` `pyDisplayMode` `pyDoHarvesting` `pyEditable` `pyInitialPropSet` `pyJavaGenerateAPIVersion` `pyJavaStream` `pyLogicErrors` `pyMemo` `pyMethodStatus` `pyPageContext` `pyPageContextClass` `pyPagesAndClasses` `pyParameters` `pyPropertyColumns` `pyPurpose` `pyRedirectRule` `pyRelativePath` `pyResults` `pyReturnColumnHasAccess` `pyReturnColumnRestrictions` `pyRuleEnds` `pyRuleStarts` `pySelected` `pySortDateCircumWithinRSMajor` `pyStatus` `pyStreamName` `pySubstituteCircumstanceVal` `pySystemName` `pyTableSizeThreshold` `pyTableSizeThreshold2` `pyTaskID` `pyTaskStatusXml` `pyToolBarSettings` `pyUsage` `pyWhenChange` `pyWillChange` `pyWindowTitle`

## Flow

Fixture: `MONORG-Test-Work-GetInfo:CollectHousehold`, `MONORG-Test-Work-GetInfo:GetInfoStart`.

Kept: `pyModelProcess.pyShapes`, walked breadth-first from `pyStartActivity` (isolated shapes last): start, end, assignment (`pyMOName`, `pyRouteTo`), utility (`pyMOName`, `pyImplementation` → reference `Activity`, via `utility`), other shapes rendered `pyFromMODefName pyMOName (pyImplementation)`; `pyModelProcess.pyConnectors` under their source shape: `pyTo`, `pyConditionType` (`always` omitted), `pyExpression`, and for an `Action` condition the `pyMOName` (reference `FlowAction`, via `assignment`); `pyLocalActions` (reference `FlowAction`, via `local action`); `pyCategory` other than `FlowStandard`. Dropped: coordinates and dimensions, `pyVisioJpeg` / `pyVisioRFB`, `pyFromTasks` / `pyEndingActivities` (repeat the connectors, regenerated on each save), `pyUseCaseLinks` (repeats the shapes), detailed routing (`pyRouterProp`, `pySkills`), `pzRuleParameters`, `pyPreviousValues`, `pyPrivilegeList`, warnings.

Raw fields: `pxAPIMethodReferences` `pxDataReferences` `pxNamedPageReferences` `pyAlphaSortLocalActions` `pyCanCreateWorkObject` `pyCanCreateWorkObjectOld` `pyCategory` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyConfirmHarness` `pyCoveredBy` `pyCoveredByCount` `pyDeferCommit` `pyDeferErrors` `pyDraftModeON` `pyEndingActivities` `pyFlowType` `pyFromTasks` `pyJavaClassName` `pyJavaGenerateVersion` `pyJavaStream` `pyLocalActions` `pyModelProcess` `pyModifiers` `pyPagesAndClasses` `pyParameters` `pyPlaceGlobalLocalsAtTop` `pyPreviousValues` `pyPrivilegeList` `pyRegenStartingFlows` `pyRelativePath` `pySLAName` `pyStartActivity` `pyStartingHarness` `pyStartingHarnessOld` `pyStartingModel` `pyStartingModelOld` `pyStatus` `pyStreamName` `pyStructureType` `pyTaskStatusXml` `pyToolBarSettings` `pyUseCaseLinks` `pyVisioJpeg` `pyVisioRFB` `pyWhensList` `pyWorkClass` `pyWorkPartiesRule` `pyXMLSignature` `pzCaseTypeExistsInCoverClass` `pzIsAutoGenerated`

## FlowAction

Fixture: `MONORG-Test-Work-GetInfo:CollectHouseholdSize`.

Kept: `pyViewReference` (reference `View`) or `pySectionReference` (reference `Section`); in execution order, according to the server skill `rules-rule-obj-flowaction`: `pyPreProcessingActivity` (absent from the fixture), `pyPreProcessingTransformRule`, `pyValidateActivity` (a Validate), `pyActionTransformRule` (post data transform), `pyLocalActionActivity` (post activity, absent from the fixture); `pyActionWhensList` (reference `When`); `pyActionPrivilegeList`; `pyUsedAs`. Dropped: button labels, layout template (`pyDesignTemplate*`), `pySourceStream` (generated JSP), `pyCachingData`, `pySections` (empty harness section in Constellation), generation settings (`pyAutoHTML`, `pyHTMLVersion`, `pyClientRuntimeVersion`).

Raw fields: `pxAPIMethodReferences` `pxFARefreshSettingsOfView` `pxNamedPageReferences` `pyAccessibilityCount` `pyAccessibilityLevel` `pyActionInstructionsCaption` `pyActionName` `pyActionPrivilegeList` `pyActionTransformRule` `pyActionWhensList` `pyAdditionalSubmitFieldsDataTransform` `pyAllowRuntimeEdit` `pyAuditActivity` `pyAuditUse` `pyAutoHTML` `pyAutoHelp` `pyBrowserSupportLevel` `pyBulkOnlyAction` `pyCachingData` `pyCancelLabel` `pyCategory` `pyCategoryDisplayName` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClientRuntimeVersion` `pyClientValidation` `pyCompact` `pyConfirmHarness` `pyContainerType` `pyCustomizeFALabels` `pyDeclareParams` `pyDesignTemplateIcon` `pyDesignTemplateInsName` `pyDesignTemplateLabel` `pyDesignTemplateName` `pyDisplayMode` `pyDisqualifyAction` `pyExpressionCalculation` `pyHTMLVersion` `pyHelpStream` `pyHelpType` `pyIsUsingDesignTemplate` `pyJSRCompliant` `pyJavaClassName` `pyJavaGenerateAPIVersion` `pyJavaStream` `pyLocalized` `pyNextAssignment` `pyNextAssignmentCover` `pyNextAssignmentFlow` `pyNextAssignmentWorkBasket` `pyNextLabel` `pyOldStreamType` `pyPagesAndClasses` `pyParameterSetFlag` `pyPostAutomationList` `pyPreAutomationList` `pyPreProcessingTransformRule` `pyPreviousLabel` `pyRelativePath` `pySavableDataPageList` `pySaveButtonVisibility` `pySaveConfiguration` `pySaveLabel` `pySectionReference` `pySectionReferenceDisplayWhen` `pySectionReferencePage` `pySectionReferenceParams` `pySectionReferencePassParamPage` `pySectionReferencePrivilegeUpdate` `pySectionReferencePrivilegeView` `pySectionReferenceRefreshWhen` `pySections` `pyShowFAButtons` `pySortDateCircumWithinRSMajor` `pySourceStream` `pyStatus` `pyStreamName` `pyStreamType` `pySubmitLabel` `pySystemAction` `pyUpdateStatus` `pyUsedAs` `pyValidateActivity` `pyViewModelActivity` `pyViewReference` `pyXMLSignature` `pyconfirmchoice`

## Property

Fixture: `MONORG-Test-Data-People:Age`, `MONORG-Test-Data-People:Title`, `MONORG-Test-Work-GetInfo:HouseholdMembers`.

Kept: `pyDescription`; `pyPropertyMode`, `pyPageClass` for a Page or PageList, `pyStringType`; `pyStreamName` (the control, `pxInteger`, `pxDropdown`); `pyPromptTableList[]` (`pyStandardValue`, `pyLocalizedValue` if different) with `pyTableOption`; `pyDataRetrievalType` other than `MANUAL`. No reference: the page class is not a rule. Dropped: `pyOldStreamName` (repeats the control), localization and declarative flags, empty `pyQualifier`.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pyAdvancedPropType` `pyCannotBeDeclarativeTarget` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyDOKeyList` `pyDOParamList` `pyDTName` `pyDTParamList` `pyDataObject` `pyDataRetrievalType` `pyDescription` `pyEditValidate` `pyGatewayClass` `pyGatewayPropertyMap` `pyHTMLPropertyParams` `pyIsGateway` `pyIsLightweight` `pyIsNonTransient` `pyIsRetrieveEachPageSeparately` `pyLocalize` `pyMaxLength` `pyOldStreamName` `pyOnInput` `pyOnObjChange` `pyPageClass` `pyPromptTableList` `pyPropertyMode` `pyPropertyName` `pyQualifier` `pyReflectStatus` `pyRuleAccessWhen` `pySkipLocalization` `pySortDateCircumWithinRSMajor` `pySpecial` `pyStreamName` `pyStringType` `pyTableAmountUnits` `pyTableOption` `pyUseForLocalization` `pzEntryCode`

## ReportDefinition

Fixture: `MONORG-Test-Data-People:DataTableEditorReport`.

Kept: `pyDescription` if it differs from the label; `pyContent.pyClassName`, `pyMaxRecords`; `pyContent.pyFields.pyListFields[]`: `pyFieldName` (reference `Property`), `pyFieldLabel`, `pySortOrder` + `pySortType` (`99999` = unsorted, omitted); groupings, aggregates, filters, joins rendered by their non-empty fields (empty in the fixture). Dropped: `ValidationMap` (base64), paging, `pyUI`, `pyReportStatsInfo`, `pySecurity`, `pyRowKeyInfo`.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxReportVersion` `pyAccessibilityCount` `pyAccessibilityLevel` `pyBrowserSupportLevel` `pyCompact` `pyContent` `pyContentSource` `pyDescription` `pyIndirectIncludes` `pyJavaClassName` `pyJavaGenerateAPIVersion` `pyPagesAndClasses` `pyParameters` `pyReportMetaData` `pyReportTitle` `pySortDateCircumWithinRSMajor` `pyStreamName` `pyTargetProperty` `pyUI` `pyUsage` `pyXMLSignature` `pzIsAutoGenerated`

## Section

Fixture: `AutreOrg-Gameboard-Data-Player:IndividualScores`.

Kept: `pyPreDataTransform.pyName`; `pySections[].pySectionBody[]`, recursive: `pyBodyType` / `pyTable.pyLayoutFormatType`, `pyInclude` (reference `Section`), `pyPageListProperty` and `pyRowPromptClass` (repeated list and class of its rows), `pyDPName` (reference `DataPage`, via `list source`); cells of `pyTable.pyRows[].pyCells[]`: `pyType`, `pyValue` (property if `.Name`, section if `SUB_SECTION`), `pyUsingPageClass`, `pyReadOnly`, `pyUserData.pyVisible` + `pyCondition`. Dropped: all rendering (widths, styles, ARIA, `pyAutomationID`, headers), list paging (`pyRDL*`), `pySourceStream`, `pzSectionParamPage`, column filter settings. The `SUB_SECTION` cell carries a copy of the included section in `pySections`: not repeated.

Raw fields: `Primary` `pxAPIMethodReferences` `pxCSSSelectors` `pxCreatedInPRPCVersion` `pxMoveFromSystem` `pxNamedPageReferences` `pyAccessibilityCount` `pyAccessibilityLevel` `pyAdvParamPageClass` `pyAdvParamPageSection` `pyAllowRuntimeEdit` `pyAutoHTML` `pyBrowserSupportLevel` `pyCategory` `pyCategoryDisplayName` `pyCircumstanceDate` `pyCircumstanceDateProp` `pyCircumstanceDefinition` `pyCircumstanceProp` `pyCircumstanceTemplate` `pyCircumstanceType` `pyCircumstanceVal` `pyCompact` `pyContainerType` `pyCorrType` `pyDefaultButton` `pyDefaultUserData` `pyDeleteMemo` `pyDescription` `pyDisplayMode` `pyEditable` `pyErrorCode` `pyHTMLVersion` `pyIndirectIncludes` `pyIsScoreCard` `pyIsUsingDesignTemplate` `pyJSRCompliant` `pyJavaClassName` `pyJavaGenerateAPIVersion` `pyJavaStream` `pyLocalized` `pyMemo` `pyMethodStatus` `pyPagesAndClasses` `pyParamDisplayType` `pyParameterSetFlag` `pyParameters` `pyPreDataTransform` `pyRMAction` `pyRegions` `pyRelativePath` `pyRuleEnds` `pyRuleStarts` `pySPRuleSetName` `pySectionType` `pySectionXML` `pySections` `pyShowAttachment` `pySortDateCircumWithinRSMajor` `pySourceStream` `pySourceStreamDispBackUp` `pySpecialityControl` `pyStatus` `pyStreamName` `pyTempNewVersion` `pyThirdPartyParams` `pyToggleTraditionalAuthoring` `pyType` `pyUsage` `pyUseAsFooter` `pyUseAsHeader` `pyUseAsLeft` `pyUseAsPageView` `pyUseAsRight` `pyWindowTitle` `pyWorkKey` `pyXMLSignature` `pzIsAutoGenerated` `pzSectionParamPageClass` `pzSectionParamPageDefaults` `pzSectionParamPageSection`

## Validate

Fixture: `AutreOrg-Gameboard-Work-Game:ValidateToScene2`.

Kept: `pyDescription`; `pyValidationValues[]` by group (`pyLabel`): each `pyValidations[]` with `pyPropertyName` (reference `Property`) or `pyValidationType`, `pyValidWhen.pyCondition[]` (rendered like a When), `pyRequired`, `pyMessageValue`; `pyAddValidates[].pyRuleName` (reference `Validate`). Data pages and properties of the conditions as references. Dropped: `pySteps`, the activity Pega generates from the form (eight plumbing steps for two checks), `pyFunctionData` and `pyExpressionGadget` (expression editor).

Raw fields: `pxAPIMethodReferences` `pxMoveFromSystem` `pxNamedPageReferences` `pyActivityName` `pyActivityPrivilegeList` `pyActivityRolesList` `pyActivityType` `pyAssociatedImage` `pyAuthenticatedOnly` `pyCircumstanceDate` `pyCircumstanceDateProp` `pyCircumstanceDefinition` `pyCircumstanceProp` `pyCircumstanceTemplate` `pyCircumstanceType` `pyCircumstanceVal` `pyDeleteMemo` `pyDescription` `pyDisplayMode` `pyEnableAddNewField` `pyInputClass` `pyInputLabel` `pyInputMayStart` `pyInputProperty` `pyInputType` `pyJavaClassName` `pyJavaFUAVersion` `pyJavaGenerateAPIVersion` `pyJavaGenerateTime` `pyJavaGenerateVersion` `pyJavaStream` `pyLocalParameters` `pyMemo` `pyMetaData` `pyMethodStatus` `pyPagesAndClasses` `pyParameters` `pyRMAction` `pyRelativePath` `pyRuleEnds` `pyRuleStarts` `pySPRuleSetName` `pySortDateCircumWithinRSMajor` `pyStatus` `pySteps` `pyStreamName` `pySystemParameters` `pyTaskStatusXml` `pyTemporaryObject` `pyUsage` `pyValidationValues` `pyWindowTitle` `pyXMLSignature` `pzImplVersion` `pzIsAutoGenerated`

## View

Fixture: `MONORG-Test-Data-People:HouseholdMembersPicker`, `MONORG-Test-Work-GetInfo:CollectHouseholdSize`, `MONORG-Test-Work-GetInfo:EnterHouseholdMembers`, `MONORG-Test-Work-GetInfo:pyEdit`.

Kept: `pyTemplateName`; the tree of `pxViewMetadata` (JSON string): region (`name`), field (`config.value` `@P .Name` → reference `Property`, `required`, `readOnly`, literal label `@L`), included view (`type: reference`: `config.name`, `config.ruleClass`, `config.context` → reference `View`), composite component (its type and scalar settings; `referenceList` `D_…` → reference `DataPage`, `pagelistValue` → `Property`), sub-components of `children` and of the `config` arrays (`columns`, `presets`, `detailsDisplay`, `rowHeader`). Dropped: `pyContent` (repeats the tree in Pega-UI-Content form), `pxContextMetadata` and `pxDependencies` (indexes derived from the tree), `pyJsonConfig` (repeats the root config), `@FL` field labels (repeat the property), `inheritedProps`, `labelOption`.

Raw fields: `pxContextMetadata` `pxDependencies` `pxViewMetadata` `pxViewType` `pyContent` `pyJsonConfig` `pyTemplateName`

## When

Fixture: `OrgEv-Int-CventAtt-Data:IsIgnoredRegistrationType`.

Kept: `pyDescription`; `pyLogic` (`true if:`); `pyCondition[]` numbered by `pyConditionLabel`: the whole expression if `pyConditionValue1Purpose` is `1FreeFormExpressionBoolean`, otherwise `pyConditionFieldName pyConditionOperation pyConditionValue1`. References (`src/projection/condition.mjs`): `DecisionTable` of a `pxEvaluateDecisionTable(…, "Name")`, `DataPage` `D_…`, `Property` `.Name` at the head of a path. Dropped: `pyConditionViewer` (editor operators and dates), `pyFunctionData`, `pyConditionValue1StringLabel`, `pyPreviousApplicationName`.

Raw fields: `pxAPIMethodReferences` `pxCurrentTab` `pxMoveFromSystem` `pxNamedPageReferences` `pyAllowedFunctions` `pyBlockName` `pyCircumstanceDate` `pyCircumstanceDateProp` `pyCircumstanceDefinition` `pyCircumstanceProp` `pyCircumstanceTemplate` `pyCircumstanceType` `pyCircumstanceVal` `pyCondition` `pyConditionCtnrClass` `pyConditionViewer` `pyDescription` `pyDisplayMode` `pyDisplayPropertyLabels` `pyEditable` `pyEnableAddNewField` `pyIsLegacyMode` `pyJavaClassName` `pyJavaFUAVersion` `pyJavaGenerateAPIVersion` `pyJavaStream` `pyLogic` `pyMemo` `pyMethodStatus` `pyPagesAndClasses` `pyParameters` `pyPreviousApplicationName` `pyRelativePath` `pyRuleEnds` `pyRuleStarts` `pyRuleView` `pySPRuleSetName` `pySelected` `pySimpleCondition` `pySkipBackwardChaining` `pySortDateCircumWithinRSMajor` `pyStatus` `pyStreamName` `pyUsage` `pyWhenChange` `pyWindowTitle` `pyXMLSignature` `pzIsAutoGenerated`

## Types added by Trello card 17

Thirteen projections, each with a fixture rule created on 2026-10-12 from one of the server's own examples (`example:stub`, or a richer example for the last three) in a test branch and read back (`docs/mcp-tools.md` § Real trial). The stubs hold the server's placeholder values, so a field is "read on the fixture" only when its name appears there; a field whose row shape is not on a fixture rule is not rendered (never guessed). They share the common fields above.

### AIAgent

Fixture: `MONORG-Test-Work:PegaCtxFxAIAgent`.

Kept: `pyDescription` when it differs from the label; `pyPurpose`; `pyAgentVersion`; `pyGenAIConfig.pyModelConfiguration` (`pyModelName`, `pyProvider`); `pyEnableExternalAccess` when true; `pyGenAIDef.pySystemPrompt`. Dropped: `pyDisplayMode`, `pyModelDeprecationInfo`. No reference yet: the field that lists the agent's tools is not on the fixture.

Raw fields: `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyAgentVersion` `pyBaseRule` `pyClassName` `pyDescription` `pyDisplayMode` `pyEnableExternalAccess` `pyGenAIConfig` `pyGenAIDef` `pyLabel` `pyPurpose` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyValueChanged` `pzActionTools` `pzAgentTools` `pzCaseTypeTools` `pzChecksum` `pzExternalAgents` `pzInsKey` `pzKnowledgeTools` `pzMCPClients` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### AITool

Fixture: `MONORG-Test-Work:PegaCtxFxAITool`.

Kept: `pyIntentDescription`; `pyAskConfirmation` when true; `pyRetentionPolicy` other than `ALWAYS_RETAIN`; `pyGenAIDef.pyExamples[].pyExample`; `pyIntentActionPage` (`pyCategory`, `pyClassName`, `pyRuleName`): the rule the tool runs, reference of the type that `pyCategory` names, via `tool action`. Dropped: `pyDisplayMode`, `pyBuddyType`, empty parameters.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyAskConfirmation` `pyBaseRule` `pyClassName` `pyDisplayMode` `pyGenAIDef` `pyIntentActionPage` `pyIntentDescription` `pyLabel` `pyPurpose` `pyRetentionPolicy` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pySortDateCircumWithinRSMajor` `pyValueChanged` `pzChecksum` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### AdminSystemSettings

Fixture: `PegaCtxFx Setting` in `MONORG-Test-Work`. Named by its two key fields joined by a space.

Kept: `pyOwner` + `pyPurpose` (`setting:`); `pyProductionLevel[]` with a non-empty `pySetting` (`pyDescription`: value). Dropped: `pySettingMetaData`, levels without a value. No reference.

Raw fields: `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassName` `pyLabel` `pyOwner` `pyProductionLevel` `pyPurpose` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pySettingMetaData` `pyValueChanged` `pyWorkClass` `pzChecksum` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### ConnectREST

Fixture: `MONORG-Test-Work:PegaCtxFxConnect`.

Kept: `pyEmbeddedURL.pyEndpointURL` and the names of `pyResourcePathParameters`; `pyResponseTimeout`; authentication when `pyUseAuthentication` is true; proxy when `pyUseProxy` is true; `pyHandlerFlow`. Per HTTP method, the named rows of `py<METHOD>RequestHeaders|RequestParameters|RequestDataList|ResponseHeaders|ResponseDataList` (`name=constant` from `pyMapFromKey`, `name→.property` from `pyMapToKey`; reference `Property`, via `response mapping`). Dropped: blank rows the server adds to each list, `pyRESTProxyConfig`, SSL and redirect settings, `pyVersionNS`.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyActionDataPageGroup` `pyAuthProfileSelectionType` `pyBaseRule` `pyClassName` `pyDELETERequestDataList` `pyDELETERequestHeaders` `pyDELETERequestParameters` `pyDELETEResponseDataList` `pyDELETEResponseHeaders` `pyEmbeddedURL` `pyEnableLaxRedirect` `pyExecutionMode` `pyFollowRedirects` `pyGETRequestHeaders` `pyGETRequestParameters` `pyGETResponseDataList` `pyGETResponseHeaders` `pyHandlerFlow` `pyHasEmbedUrl` `pyLabel` `pyMaintainSession` `pyPATCHRequestDataList` `pyPATCHRequestHeaders` `pyPATCHRequestParameters` `pyPATCHResponseDataList` `pyPATCHResponseHeaders` `pyPOSTRequestData` `pyPOSTRequestDataList` `pyPOSTRequestHeaders` `pyPOSTRequestParameters` `pyPOSTResponseDataList` `pyPOSTResponseHeaders` `pyPUTRequestDataList` `pyPUTRequestHeaders` `pyPUTRequestParameters` `pyPUTResponseDataList` `pyPUTResponseHeaders` `pyPagesAndClasses` `pyRESTProxyConfig` `pyReadsOrRoutesToExternalSystem` `pyResourceNameResolution` `pyResourceParameters` `pyResponseTimeout` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pySSLProtocolVersion` `pyServiceName` `pyStatusMsgProperty` `pyStatusValProperty` `pyUseAuthentication` `pyUseProxy` `pyValueChanged` `pyVersionNS` `pzChecksum` `pzInsKey` `pzIsAutoGenerated` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### Correspondence

Fixture: `MONORG-Test-Work:PegaCtxFxCorr Email`. Named by its key fields joined by a space (`pyStreamName` is the first one).

Kept: `pyCorrType`; `pyNextAction`; `pyUserEdit` other than `NoEdit`; `pyVerifyCorr` and `pyTopLevelCorr` when true. Dropped: the message text (`pySourceStream`), form size, `pyJava*`, `pyXMLSignature`. The fixture holds no section or field reference: none is extracted.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassName` `pyCompact` `pyCorrType` `pyEmailViewMode` `pyFormPrintMethod` `pyFormSizeHoriz` `pyFormSizeVert` `pyHTMLPrompt` `pyJavaClassName` `pyJavaStream` `pyLabel` `pyMethodStatus` `pyNextAction` `pyPagesAndClasses` `pyPromptValidate` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyShowDescription` `pyShowSectionPreview` `pySourceOnlyMode` `pySourceStream` `pyStreamName` `pyTopLevelCorr` `pyUserEdit` `pyValueChanged` `pyVerifyCorr` `pyWordTemplate` `pyXMLSignature` `pzChecksum` `pzCorrTypeClass` `pzErrorMessage` `pzHasModeLiteral` `pzIndexCount` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### CorrespondenceType

Fixture: `MONORG-Test-Work:PegaCtxFxCorrType`.

Kept: `pyCorrType`, `pyCorrClass`, `pyAddressClass`, `pyWorkClass`. No reference (data classes of Pega).

Raw fields: `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyAddressClass` `pyBaseRule` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassName` `pyCorrClass` `pyCorrType` `pyLabel` `pyMethodStatus` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyValueChanged` `pyWorkClass` `pzChecksum` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### EditValidate

Fixture: `_:PegaCtxFxEditValidate`: a rule with no class, so no `pyClassName` (the work class is `pyWorkClass`), empty class in the identifier (`EditValidate::<Name>`) and folder `_`.

Kept: `pyWorkClass`; `pyJavaCode`, the Java body the developer writes, in a code block (`pyJavaClassName` and `pyJavaStream` are generated: dropped). No reference.

Raw fields: `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyJavaClassName` `pyJavaCode` `pyJavaStream` `pyLabel` `pyMethodStatus` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyValidateName` `pyValueChanged` `pyWorkClass` `pzChecksum` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### FieldValue

Fixture: `MONORG-Test-Work:PegaCtxFxField Value1`. Named by `pyFieldName` and `pyFieldValue` joined by a space.

Kept: `pyFieldName`, `pyFieldValue`, `pyLocalizedValue` (`shown as:`). No reference.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassName` `pyDisplayMode` `pyFieldName` `pyFieldValue` `pyLabel` `pyLocalizedValue` `pyMethodStatus` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pySortDateCircumWithinRSMajor` `pyValueChanged` `pzChecksum` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch` `pzUCShortInsId`

### Notification

Fixture: `MONORG-Test-Work:PegaCtxFxNotification`.

Kept: `pyPurpose`; `pyMessage`; `pyMuteNotification` and `pyShowInUserPreference` when true; `pyChannelsList` (an object keyed by channel, best `pxChannelRank` first) with `pyEnableChannel`; the count of `pzRecipients`. `pzRecipients` is empty on the fixture: the shape of a recipient row is not read yet, so it is not rendered. Dropped: `pzMessageParameters`, `pyAdvancedParameters`, `pyDoNotShowInPreference`.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyAdvancedParameters` `pyBaseRule` `pyCategory` `pyChannelsList` `pyClassName` `pyDoNotShowInPreference` `pyLabel` `pyMessage` `pyMuteNotification` `pyPurpose` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyShowInUserPreference` `pyValueChanged` `pzChecksum` `pzIndexCount` `pzInsKey` `pzIsAutoGenerated` `pzMessageParameters` `pzRecipients` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### ServiceLevel

Fixture: `MONORG-Test-Work:PegaCtxFxSLA`.

Kept: `pyCalculateTimesFrom`; goal, deadline and late intervals (`py{Goal,Deadline,Late}Default{Days,Hours,Minutes,Seconds}`, non-zero only); `pyMaxLateEvents`; `pyNextActionSetting` other than `Immediate`; `pyUrgencySLA`; `pyEscalations` with a positive `pyEscalationUrgency`. The activity an escalation runs is not on the fixture (all urgencies are 0): not extracted yet. Dropped: `pyNextAction*` intervals, circumstancing.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyCalculateTimesFrom` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassName` `pyDeadlineDefaultDays` `pyDeadlineDefaultHours` `pyDeadlineDefaultMinutes` `pyDeadlineDefaultSeconds` `pyEscalations` `pyGoalDefaultDays` `pyGoalDefaultHours` `pyGoalDefaultMinutes` `pyGoalDefaultSeconds` `pyLabel` `pyLateDefaultDays` `pyLateDefaultHours` `pyLateDefaultMinutes` `pyLateDefaultSeconds` `pyMaxLateEvents` `pyNextActionDays` `pyNextActionHours` `pyNextActionMinutes` `pyNextActionSeconds` `pyNextActionSetting` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyServiceLevelName` `pyUrgencySLA` `pyValueChanged` `pzChecksum` `pzIndexCount` `pzInsKey` `pzIsAutoGenerated` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### ClassMetadata

Fixtures: `MONORG-Test-Work-GetInfo` (server example `with-primary-fields`, `MyCustomField` renamed to a property of the class) and `MONORG-Test-Data-People` (example `data-class`, its data pages renamed to the class's list page, lookup and savable pages removed). Named after its class, like a `Class`: `pega-ctx create --from <Name>` picks the rule of the type being created when both share the name.

Kept: `pyPrimaryFields[].pyPropertyName` (reference `Property` for a field of the application, via `primary field`); `pyListDataPage` (reference `DataPage` in the class, via `list data page`); `pyDataTypeLocalActions[]` (`pyActionLabel`, `pyActionType`). Dropped: `pyListDataPageInfo` (a copy of the data page's name), `pyImage` of the actions. Lookup and savable data pages are not on a fixture: not rendered.

Raw fields: `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyClassName` `pyDataTypeLocalActions` `pyLabel` `pyListDataPage` `pyListDataPageInfo` `pyPrimaryFields` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyValueChanged` `pzChecksum` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### AttachmentCategory

Fixture: `MONORG-Test-Work:PegaCtxFxPrivDocs` (server example `work-privilege`).

Kept: `pyEnableAttachmentLevelSecurity` when true; `pyActionPrivilegeList[]` (`pyPrivilegeName`, `create` when `pyAllowCreate` is true). `pyActionWhensList` is empty on the fixture and the other `pyAllow*` flags are not on it: not rendered. Dropped: circumstancing, `pyMethodStatus`.

Raw fields: `pxAPIMethodReferences` `pxNamedPageReferences` `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyActionPrivilegeList` `pyActionWhensList` `pyBaseRule` `pyCategoryName` `pyCircumstanceDateProp` `pyCircumstanceProp` `pyClassName` `pyEnableAttachmentLevelSecurity` `pyLabel` `pyMethodStatus` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyValueChanged` `pzChecksum` `pzIndexCount` `pzInsKey` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`

### ServiceMCP

Fixture: `MONORG-Test-Work:PegaCtxFxAgentMCP` (server example `with-custom-tools`).

Kept: `pyUsage`; `pyIsMCPServiceEnabled` (`enabled: yes|no`, always shown: a disabled service exposes nothing); `pyMCPVersion`; `pzMCPTools[]` (`pyPurpose`, the name of a `Rule-AI-Tool`, and `pyCategory`, the kind of rule it runs); the count of `pzCaseTypeTools`, empty on the fixture. No reference: a row names the tool, not its class. Dropped: `pyDescription` (equal to the label on the fixture).

Raw fields: `pxObjClass` `pxUpdateOperator` `pxWarnings` `pyBaseRule` `pyClassName` `pyDescription` `pyIsMCPServiceEnabled` `pyLabel` `pyMCPVersion` `pyRuleAvailable` `pyRuleName` `pyRuleSet` `pyRuleSetVersion` `pyServiceName` `pyUsage` `pyValueChanged` `pzCaseTypeTools` `pzChecksum` `pzInsKey` `pzMCPTools` `pzRuleSetVersionMajor` `pzRuleSetVersionMinor` `pzRuleSetVersionPatch`
