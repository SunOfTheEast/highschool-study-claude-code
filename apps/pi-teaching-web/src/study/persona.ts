import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bundled = (id: string) => (
  fileURLToPath(import.meta.resolve(`highschool-study-markdown/personas/${id}`))
);

const selection = (source: string, label: string) => (
  new RegExp(`^- ${label}: \\x60([^\\x60]+)\\x60\\s*$`, 'm').exec(source)?.[1] ?? null
);

export function resolvePersona(
  root: string,
  sessionOverride: string | null = null,
): { id: string; content: string } {
  const localPath = join(root, 'CLAUDE.local.md');
  const sharedPath = join(root, 'CLAUDE.md');
  const local = existsSync(localPath)
    ? selection(readFileSync(localPath, 'utf8'), 'Preferred persona')
    : null;
  const shared = existsSync(sharedPath)
    ? selection(readFileSync(sharedPath, 'utf8'), 'Default presentation persona')
    : null;
  const id = sessionOverride ?? local ?? shared ?? 'neutral-tutor';
  const projectPath = join(root, '.claude', 'personas', `${id}.md`);
  const path = existsSync(projectPath) ? projectPath : bundled(id);
  return { id, content: readFileSync(path, 'utf8') };
}
