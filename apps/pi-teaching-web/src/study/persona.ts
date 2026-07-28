import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
import type { PersonaChoice } from '../shared/contracts';

const bundled = (id: string) => (
  fileURLToPath(import.meta.resolve(`highschool-study-markdown/personas/${id}`))
);

const builtInIds = ['neutral-tutor', 'calm-senpai', 'energetic-classmate'] as const;
const defaultDescription = '保持清晰、自然的学习陪伴。';
const defaultAccent = '#3f5b54';
const portraitExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const selection = (source: string, label: string) => (
  new RegExp(`^- ${label}: \\x60([^\\x60]+)\\x60\\s*$`, 'm').exec(source)?.[1] ?? null
);

const publicValue = (source: string, label: string) => (
  new RegExp(`^- ${label}:\\s*(.+?)\\s*$`, 'm').exec(source)?.[1]?.trim() ?? null
);

const unquote = (value: string | null) => (
  value?.replace(/^`([^`]*)`$/, '$1').trim() || null
);

type DiscoveredPersona = {
  choice: PersonaChoice;
  portraitPath: string | null;
};

function discoverPersona(
  root: string,
  path: string,
  expectedId: string,
  local: boolean,
): DiscoveredPersona {
  const source = readFileSync(path, 'utf8');
  const id = unquote(publicValue(source, 'ID')) ?? expectedId;
  if (local && id !== expectedId) throw new Error('PERSONA_FILE_ID_MISMATCH');
  const name = unquote(publicValue(source, 'Display name')) ?? id;
  const description = unquote(publicValue(source, 'Student preview')) ?? defaultDescription;
  const glyph = unquote(publicValue(source, 'Glyph')) ?? [...name][0] ?? '伴';
  const accent = unquote(publicValue(source, 'Accent')) ?? defaultAccent;
  const portrait = unquote(publicValue(source, 'Portrait'));
  let portraitPath: string | null = null;
  if (portrait) {
    try {
      const resolved = resolveInsideRoot(root, portrait);
      if (!portraitExtensions.has(extname(resolved).toLowerCase())) {
        throw new Error('PERSONA_PORTRAIT_INVALID');
      }
      portraitPath = existsSync(resolved) ? resolved : null;
    } catch {
      throw new Error('PERSONA_PORTRAIT_INVALID');
    }
  }
  return {
    choice: {
      id,
      name,
      description,
      glyph,
      accent,
      portraitUrl: portraitPath ? `/api/personas/${encodeURIComponent(id)}/portrait` : null,
    },
    portraitPath,
  };
}

function discoveredPersonas(root: string): Map<string, DiscoveredPersona> {
  const personas = new Map<string, DiscoveredPersona>();
  for (const id of builtInIds) {
    personas.set(id, discoverPersona(root, bundled(id), id, false));
  }
  const localDirectory = join(root, '.claude', 'personas');
  if (existsSync(localDirectory)) {
    for (const name of readdirSync(localDirectory).filter((value) => value.endsWith('.md')).sort()) {
      const id = parse(name).name;
      personas.set(id, discoverPersona(root, join(localDirectory, name), id, true));
    }
  }
  return personas;
}

export function personaChoices(root: string): PersonaChoice[] {
  return [...discoveredPersonas(root).values()]
    .map(({ choice }) => choice)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function personaPortraitPath(root: string, id: string): string | null {
  return discoveredPersonas(root).get(id)?.portraitPath ?? null;
}

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
