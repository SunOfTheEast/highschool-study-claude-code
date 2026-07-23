import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import {
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';

export type RouteChangeInput = {
  action: 'insert' | 'skip' | 'move' | 'repeat';
  blockId: string;
  reason: string;
  source: string;
  before?: string;
  after?: string;
};

export type PlanDecision = 'active' | 'complete' | 'replan';

export type PlanUpdateInput = {
  decision: PlanDecision;
  lessonIndex: string;
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
};

export type RegisteredPlan = {
  id: string;
  title: string;
  path: string;
  coachSessionId: string | null;
};

export type PreparedLessonWrite = {
  lessonId: string;
  lessonPath: string;
  lessonTitle: string;
  source: string;
};

export type RegisteredLesson = {
  id: string;
  title: string;
  path: string;
  status: 'prepared';
};

function read(root: string, path: string): { absolute: string; source: string } {
  const absolute = resolveInsideRoot(root, path);
  return { absolute, source: readFileSync(absolute, 'utf8') };
}

function write(absolute: string, source: string): void {
  writeFileSync(absolute, source.endsWith('\n') ? source : `${source}\n`);
}

function replaceFrontmatterField(
  source: string,
  path: string,
  key: string,
  value: string,
): string {
  const match = /^(---\s*\n)([\s\S]*?)(\n---\s*\n)/.exec(source);
  if (!match) throw new Error(`FRONTMATTER_REQUIRED: ${path}`);
  const line = new RegExp(`^${key}:.*$`, 'm');
  const body = line.test(match[2]!)
    ? match[2]!.replace(line, `${key}: ${value}`)
    : `${match[2]}\n${key}: ${value}`;
  return source.replace(match[0], `${match[1]}${body}${match[3]}`);
}

export function setFrontmatterField(root: string, path: string, key: string, value: string): void {
  const document = read(root, path);
  write(document.absolute, replaceFrontmatterField(document.source, path, key, value));
}

function replaceBlockStatus(
  source: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): string {
  const heading = new RegExp(`^## Block ${blockId}(?:（[^）]+）)?\\s*$`, 'm');
  const match = heading.exec(source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(match.index, end);
  const state = /### Node State\s*\n([\s\S]*?)(?=\n### |\n## |$)/.exec(block);
  const replacement = state
    ? block.replace(state[0], state[0].replace(/^- Status:.*$/m, `- Status: ${status}`))
    : block.replace(
      match[0],
      `${match[0]}\n\n### Node State\n\n- Kind: dialogue\n- Required: true\n- Status: ${status}\n- Depends on:\n- Uses:`,
    );
  return source.slice(0, match.index) + replacement + source.slice(end);
}

export function setBlockStatus(
  root: string,
  lessonPath: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): void {
  const document = read(root, lessonPath);
  write(document.absolute, replaceBlockStatus(document.source, blockId, status));
}

export function appendRouteChange(root: string, lessonPath: string, input: RouteChangeInput): void {
  const document = read(root, lessonPath);
  if (!document.source.includes(`## Block ${input.blockId}`)) {
    throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);
  }
  const ids = [...document.source.matchAll(/^### Route change route-(\d+)$/gm)]
    .map((match) => Number(match[1]));
  const id = `route-${String(Math.max(0, ...ids) + 1).padStart(3, '0')}`;
  const heading = document.source.includes('\n## Route Changes\n') ? '' : '\n## Route Changes\n';
  const placement = input.before
    ? `\n- Before: ${input.before}`
    : input.after
      ? `\n- After: ${input.after}`
      : '';
  write(
    document.absolute,
    `${document.source.trimEnd()}${heading}\n### Route change ${id}\n\n- Action: ${input.action}\n- Block: ${input.blockId}${placement}\n- Reason: ${input.reason}\n- Source: ${input.source}\n`,
  );
}

function replaceSection(source: string, heading: string, value: string): string {
  const pattern = new RegExp(`(^## ${heading}\\s*$\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  if (!pattern.test(source)) throw new Error(`SECTION_NOT_FOUND: ${heading}`);
  return source.replace(pattern, `$1\n${value.trim()}\n\n`);
}

function planTitle(body: string): string {
  const heading = /^#\s+(.+?)\s*$/m.exec(body)?.[1]?.trim() ?? '';
  const title = heading.replace(/^Plan[:：]\s*/, '');
  if (!title) throw new Error('PLAN_TITLE_REQUIRED');
  return title;
}

function appendPlanGraphLink(source: string, path: string, title: string): string {
  const heading = /^## Plan Graph[ \t]*$/m.exec(source);
  if (!heading) throw new Error('SECTION_NOT_FOUND: Plan Graph');
  const sectionStart = heading.index + heading[0].length;
  const nextHeading = /^## [^\n]+$/gm;
  nextHeading.lastIndex = sectionStart;
  const next = nextHeading.exec(source);
  const sectionEnd = next?.index ?? source.length;
  const section = source.slice(sectionStart, sectionEnd);
  const targets = [...section.matchAll(/\[[^\]]+\]\(([^)#]+\.md)\)/g)]
    .map((match) => match[1]);
  if (targets.includes(path)) return source;
  const before = source.slice(0, sectionEnd).trimEnd();
  const after = source.slice(sectionEnd);
  return `${before}\n\n- [${title}](${path})\n${after.startsWith('\n') ? after : `\n${after}`}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function registerLessonIndex(
  planSource: string,
  planPath: string,
  lessonPath: string,
  title: string,
): string {
  const heading = /^## Lesson Index[ \t]*$/m.exec(planSource);
  if (!heading) throw new Error('SECTION_NOT_FOUND: Lesson Index');
  const sectionStart = heading.index + heading[0].length;
  const nextHeading = /^## [^\n]+$/gm;
  nextHeading.lastIndex = sectionStart;
  const sectionEnd = nextHeading.exec(planSource)?.index ?? planSource.length;
  const section = planSource.slice(sectionStart, sectionEnd);
  const target = posix.relative(posix.dirname(planPath), lessonPath);
  const existing = new RegExp(
    `^([ \\t]*\\d+\\.[ \\t]+)\\[[^\\]]+\\]\\(${escapeRegExp(target)}\\).*?$`,
    'm',
  );
  if (existing.test(section)) {
    const nextSection = section.replace(existing, `$1[${title}](${target}) — prepared。`);
    return planSource.slice(0, sectionStart) + nextSection + planSource.slice(sectionEnd);
  }
  const numbers = [...section.matchAll(/^[ \t]*(\d+)\./gm)]
    .map((match) => Number(match[1]));
  const number = Math.max(0, ...numbers) + 1;
  const before = planSource.slice(0, sectionEnd).trimEnd();
  const after = planSource.slice(sectionEnd);
  return `${before}\n${number}. [${title}](${target}) — prepared。\n\n${after.trimStart()}`;
}

export function writePreparedLesson(
  root: string,
  planPath: string,
  input: PreparedLessonWrite,
): RegisteredLesson {
  const absolute = resolveInsideRoot(root, input.lessonPath);
  if (existsSync(absolute)) {
    const current = readMarkdownFile(root, input.lessonPath);
    if (current.frontmatter.status !== 'prepared') {
      throw new Error(`LESSON_REPREPARE_REQUIRES_NEW_ID: ${input.lessonId}`);
    }
  }
  const plan = read(root, planPath);
  const nextPlan = registerLessonIndex(
    plan.source,
    planPath,
    input.lessonPath,
    input.lessonTitle,
  );
  mkdirSync(dirname(absolute), { recursive: true });
  write(absolute, input.source);
  if (nextPlan !== plan.source) write(plan.absolute, nextPlan);
  return {
    id: input.lessonId,
    title: input.lessonTitle,
    path: input.lessonPath,
    status: 'prepared',
  };
}

export function registerPlan(root: string, planId: string): RegisteredPlan {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(planId)) {
    throw new Error(`INVALID_PLAN_ID: ${planId}`);
  }
  const path = `plans/${planId}.md`;
  const plan = readMarkdownFile(root, path);
  if (plan.frontmatter.kind !== 'plan') throw new Error('INVALID_PLAN_KIND');
  if (plan.id !== planId) throw new Error(`INVALID_PLAN_ID: ${plan.id}`);
  const title = planTitle(plan.body);
  const roadmap = read(root, 'ROADMAP.md');
  const next = appendPlanGraphLink(roadmap.source, path, title);
  if (next !== roadmap.source) write(roadmap.absolute, next);

  const canonicalPlan = readMarkdownFile(root, path);
  const canonicalRoadmap = readFileSync(roadmap.absolute, 'utf8');
  if (!canonicalRoadmap.includes(`](${path})`)) {
    throw new Error(`PLAN_REGISTRATION_FAILED: ${planId}`);
  }
  return {
    id: canonicalPlan.id,
    title: planTitle(canonicalPlan.body),
    path,
    coachSessionId: typeof canonicalPlan.frontmatter.coach_session === 'string'
      ? canonicalPlan.frontmatter.coach_session
      : null,
  };
}

function activeReflectionBlockId(source: string): string {
  const headings = [...source.matchAll(/^## Block ([^（\s]+)(?:（[^）]+）)?\s*$/gm)];
  const blocks = headings.map((heading, index) => {
    const body = source.slice(heading.index!, headings[index + 1]?.index ?? source.length);
    return {
      id: heading[1]!,
      kind: /^- Kind:\s*(.*?)\s*$/m.exec(body)?.[1] ?? 'unknown',
      status: /^- Status:\s*(.*?)\s*$/m.exec(body)?.[1] ?? 'unknown',
    };
  });
  const reflections = blocks.filter((block) => (
    block.kind === 'reflection' && block.status === 'active'
  ));
  if (reflections.length !== 1) {
    const active = blocks
      .filter((block) => block.status === 'active')
      .map((block) => `${block.id}:${block.kind}`)
      .join(', ') || '(none)';
    throw new Error(
      `LESSON_REFLECTION_NOT_ACTIVE: active=${active}; `
      + '期望恰好一个 Block 同时为 Kind: reflection 且 Status: active',
    );
  }
  return reflections[0]!.id;
}

export function closeLesson(
  root: string,
  lessonPath: string,
  input: { reflection: string; summary: string },
): void {
  const document = read(root, lessonPath);
  const reflectionBlockId = activeReflectionBlockId(document.source);
  let source = replaceBlockStatus(document.source, reflectionBlockId, 'completed');
  source = replaceSection(source, 'Reflection', input.reflection);
  source = replaceSection(source, 'Lesson Summary', input.summary);
  source = replaceFrontmatterField(source, lessonPath, 'status', 'closed');
  write(document.absolute, source);
}

export function updatePlan(root: string, planPath: string, input: PlanUpdateInput): void {
  const document = read(root, planPath);
  const status = input.decision === 'complete' ? 'completed' : 'active';
  let source = replaceSection(document.source, 'Lesson Index', input.lessonIndex);
  source = replaceSection(source, 'Current Position', input.currentPosition);
  source = replaceSection(source, 'Next Lesson Candidate', input.nextLessonCandidate);
  source = replaceSection(source, 'Plan Summary', input.planSummary);
  source = replaceFrontmatterField(source, planPath, 'status', status);
  write(document.absolute, source);
}
