// AttachmentCategory: who may do what with the attachments of the category.
// Fields read on the fixture: pyEnableAttachmentLevelSecurity, pyActionPrivilegeList[].{pyPrivilegeName,pyAllowCreate}
// (docs/projection.md). pyActionWhensList is empty on the fixture: not rendered.
import { filled, items } from './common.mjs';

export function body(o) {
  const lines = [];
  if (o.pyEnableAttachmentLevelSecurity === 'true') lines.push('', 'attachment-level security: yes');
  const privileges = items(o.pyActionPrivilegeList).filter((p) => filled(p.pyPrivilegeName));
  if (privileges.length) {
    lines.push('', '## Privileges');
    for (const p of privileges) lines.push(`- ${p.pyPrivilegeName}${p.pyAllowCreate === 'true' ? ': create' : ''}`);
  }
  return { lines, references: [] };
}
