import type { LessonHandoutConversationItem } from '../shared/contracts';
import {
  formatLessonHandoutPath,
  parseHandoutBlockSegment,
} from '../shared/handout-route';

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function details(value: unknown): Record<string, unknown> | null {
  const outer = object(value);
  return object(outer?.details) ?? outer;
}

function safeHandoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^\/course\/plan\/([^/]+)\/lesson\/([^/]+)\/handout\/([^/]+)$/.exec(value);
  if (!match) return null;
  try {
    const planId = decodeURIComponent(match[1]!);
    const lessonId = decodeURIComponent(match[2]!);
    const blockIds = parseHandoutBlockSegment(match[3]!);
    return blockIds && formatLessonHandoutPath(planId, lessonId, blockIds) === value
      ? value
      : null;
  } catch {
    return null;
  }
}

export function lessonHandoutStart(
  id: string,
  at: string,
): LessonHandoutConversationItem {
  return {
    id,
    kind: 'lesson-handout',
    status: 'running',
    title: null,
    url: null,
    at,
  };
}

export function lessonHandoutEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
): LessonHandoutConversationItem {
  const value = details(result);
  const title = typeof value?.title === 'string' && value.title.trim().length > 0
    ? value.title.trim()
    : null;
  const url = safeHandoutUrl(value?.url);
  const valid = !isError && value?.kind === 'lesson-handout' && title !== null && url !== null;
  return {
    id,
    kind: 'lesson-handout',
    status: valid ? 'done' : 'error',
    title: valid ? title : null,
    url: valid ? url : null,
    at,
  };
}
