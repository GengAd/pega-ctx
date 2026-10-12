// AIAgent: purpose, model and system prompt.
// Fields read on the fixture: pyPurpose, pyAgentVersion, pyGenAIConfig.pyModelConfiguration, pyGenAIDef.pySystemPrompt.
import { filled } from './common.mjs';

export function body(o) {
  const lines = [];
  if (filled(o.pyDescription) && o.pyDescription !== o.pyLabel) lines.push('', o.pyDescription);
  lines.push('', `purpose: ${o.pyPurpose}`);
  if (filled(o.pyAgentVersion)) lines.push(`version: ${o.pyAgentVersion}`);
  const model = o.pyGenAIConfig?.pyModelConfiguration;
  if (filled(model?.pyModelName)) lines.push(`model: ${model.pyModelName}${filled(model.pyProvider) ? ` (${model.pyProvider})` : ''}`);
  if (o.pyEnableExternalAccess === 'true') lines.push('external access: yes');
  if (filled(o.pyGenAIDef?.pySystemPrompt)) lines.push('', '## System prompt', o.pyGenAIDef.pySystemPrompt);
  return { lines, references: [] };
}
