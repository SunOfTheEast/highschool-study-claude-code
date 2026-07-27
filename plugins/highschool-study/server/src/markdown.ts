import { readFileSync } from 'node:fs';
import { basename, extname, relative } from 'node:path';
import { parse } from 'yaml';
import { StudyError } from './errors';
import { resolveInsideRoot } from './learning-set';
import { validatePlanDocument } from './plan-document';

export type MarkdownDocument = {
  path: string;
  id: string;
  frontmatter: Record<string, unknown>;
  body: string;
  headings: Map<string, string>;
};

function parseFrontmatter(source: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  const frontmatterSource = match?.[1];
  if (frontmatterSource === undefined || !match) return { frontmatter: {}, body: source };

  const parsed: unknown = parse(frontmatterSource);
  return {
    frontmatter: parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {},
    body: source.slice(match[0].length),
  };
}

function decodeEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const codePoint = Number.parseInt(entity.slice(2), 16);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : `&${entity};`;
  }
  if (entity.startsWith('#')) {
    const codePoint = Number.parseInt(entity.slice(1), 10);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : `&${entity};`;
  }
  return named[entity] ?? `&${entity};`;
}

function renderedHeadingText(markdown: string): string {
  let text = markdown;
  text = text.replace(/(`+)([\s\S]*?)\1/g, (_match, _ticks: string, content: string) => {
    const normalized = content.replace(/[\t\r\n ]+/g, ' ');
    return normalized.startsWith(' ') && normalized.endsWith(' ') && normalized.trim()
      ? normalized.slice(1, -1)
      : normalized;
  });
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\s*\[[^\]]*\]/g, '$1');
  text = text.replace(/\[([^\]]+)\]\s*\[[^\]]*\]/g, '$1');
  text = text.replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, '$1');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (_match, entity: string) => decodeEntity(entity));
  text = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');

  let previous: string;
  do {
    previous = text;
    text = text
      .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
      .replace(/([*_])(?=\S)([\s\S]*?\S)\1/g, '$2');
  } while (text !== previous);
  return text;
}

function githubAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '')
    .replace(/ /g, '-');
}

function collectHeadings(body: string): Map<string, string> {
  const headings = new Map<string, string>();
  const occurrences = new Map<string, number>();
  const lines = body.split(/\r?\n/);
  let fence: { marker: '`' | '~'; length: number } | null = null;

  const addHeading = (headingMarkdown: string): void => {
    const heading = renderedHeadingText(headingMarkdown);
    const baseAnchor = githubAnchor(heading);
    if (!baseAnchor) return;

    let anchor = baseAnchor;
    while (occurrences.has(anchor)) {
      const duplicateCount = (occurrences.get(baseAnchor) ?? 0) + 1;
      occurrences.set(baseAnchor, duplicateCount);
      anchor = `${baseAnchor}-${duplicateCount}`;
    }
    occurrences.set(anchor, 0);
    headings.set(anchor, heading);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence !== null) {
      if (fenceMatch?.[1]?.startsWith(fence.marker)
        && fenceMatch[1].length >= fence.length
        && /^[ \t]*$/.test(fenceMatch[2] ?? '')) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch?.[1]) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length };
      continue;
    }

    const atx = /^ {0,3}#{1,6}(?:[ \t]+(.+?)|[ \t]*)$/.exec(line);
    if (atx?.[1]) {
      addHeading(atx[1].replace(/[ \t]+#+[ \t]*$/, ''));
      continue;
    }

    const setextUnderline = lines[index + 1];
    if (setextUnderline !== undefined
      && /^ {0,3}(?:=+|-+)[ \t]*$/.test(setextUnderline)
      && /^ {0,3}\S/.test(line)) {
      addHeading(line.replace(/^ {0,3}/, '').trimEnd());
      index += 1;
    }
  }
  return headings;
}

export function readMarkdownFile(root: string, relativePath: string): MarkdownDocument {
  const absolutePath = resolveInsideRoot(root, relativePath);
  const source = readFileSync(absolutePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(source);
  const id = typeof frontmatter.id === 'string' ? frontmatter.id : '';
  const canonicalRoot = resolveInsideRoot(root, '.');
  const normalizedPath = relative(canonicalRoot, absolutePath).replaceAll('\\', '/');
  const isPlanOrLesson = /^(?:plans|lessons)\//.test(normalizedPath);
  const fileStem = basename(absolutePath, extname(absolutePath));
  if (isPlanOrLesson && id !== fileStem) throw new StudyError('INVALID_DOCUMENT_ID');
  if (/^plans\/[^/]+\.md$/.test(normalizedPath)) {
    validatePlanDocument(normalizedPath, frontmatter, body);
  }

  return {
    path: absolutePath,
    id,
    frontmatter,
    body,
    headings: collectHeadings(body),
  };
}
