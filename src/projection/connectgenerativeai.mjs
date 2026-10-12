// ConnectGenerativeAI: the model, the prompts it sends and where the answer goes.
// Fields read on the fixture: pyGenAIConfig.pyModelConfiguration.{pyModelName,pyProvider}, pyGenAIDef.{pyUseCase,
// pyUserPrompt,pySystemPrompt}, pyCustomizeSystemPrompt, pyExpectedResponseEntity, pyResponseFields[].pyFieldName
// (docs/projection.md).
import { filled, items, references } from './common.mjs';

export function body(o) {
  const refs = references();
  const lines = [''];
  const model = o.pyGenAIConfig?.pyModelConfiguration;
  if (filled(model?.pyModelName)) lines.push(`model: ${model.pyModelName}${filled(model.pyProvider) ? ` (${model.pyProvider})` : ''}`);
  const def = o.pyGenAIDef ?? {};
  if (filled(def.pyUseCase)) lines.push(`use case: ${def.pyUseCase}`);
  // Both prompts are field values (pyGenerativeAIPrompt, pyGenerativeAISystemPrompt), named here.
  if (filled(def.pyUserPrompt)) lines.push(`user prompt: ${def.pyUserPrompt}`);
  if (filled(def.pySystemPrompt)) lines.push(`system prompt: ${def.pySystemPrompt}${o.pyCustomizeSystemPrompt === 'true' ? ' (customized)' : ''}`);
  const fields = items(o.pyResponseFields).map((f) => f.pyFieldName).filter(filled);
  if (filled(o.pyExpectedResponseEntity) || fields.length) lines.push(`response: ${o.pyExpectedResponseEntity ?? ''}${fields.length ? ` → ${fields.join(', ')}` : ''}`);
  for (const f of fields) refs.property(o.pyClassName, f, 'response field');
  return { lines, references: refs.all() };
}
