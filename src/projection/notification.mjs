// Notification: the message key, the channels (best rank first) and who receives it.
// Fields read on the fixture: pyPurpose, pyMessage, pyChannelsList{}, pzRecipients[], pyMuteNotification (docs/projection.md).
import { filled, items } from './common.mjs';

export function body(o) {
  const lines = ['', `purpose: ${o.pyPurpose}`];
  if (filled(o.pyMessage)) lines.push(`message: ${o.pyMessage}`);
  if (o.pyMuteNotification === 'true') lines.push('muted: yes');
  if (o.pyShowInUserPreference === 'true') lines.push('shown in user preferences: yes');
  const channels = Object.values(o.pyChannelsList ?? {}).sort((a, b) => Number(b.pxChannelRank) - Number(a.pxChannelRank));
  lines.push('', '## Channels', ...(channels.length ? channels.map((c) => `- ${c.pyChannelName}: ${c.pyEnableChannel === 'true' ? 'on' : 'off'}`) : ['none']));
  // pzRecipients is empty on the fixture: its row shape is unknown, so only the count is shown.
  const recipients = items(o.pzRecipients).length;
  if (recipients) lines.push(`recipients: ${recipients} (row shape not read yet: --raw)`);
  return { lines, references: [] };
}
