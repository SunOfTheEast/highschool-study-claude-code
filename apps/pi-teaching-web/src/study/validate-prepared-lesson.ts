import {
  readCard,
  readLessonAliases,
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import { dirname, isAbsolute, join, relative } from 'node:path';

export type PreparedLessonIssue = {
  code:
    | 'LESSON_SECTION_MISSING'
    | 'LESSON_ALIAS_MISSING'
    | 'LESSON_ALIAS_INVALID'
    | 'LESSON_PROBLEM_CARD_COUNT';
  message: string;
};

export class PreparedLessonValidationError extends Error {
  readonly code = 'PREPARED_LESSON_INVALID';

  constructor(readonly issues: PreparedLessonIssue[]) {
    super(`PREPARED_LESSON_INVALID: ${issues.map((issue) => issue.code).join(', ')}`);
    this.name = 'PreparedLessonValidationError';
  }
}

export type PreparedLessonBlock = {
  id: string;
  kind: string;
  required: boolean;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  dependsOn: string[];
  uses: string[];
};

export function readPreparedLessonBlocks(body: string): PreparedLessonBlock[] {
  const headings = [...body.matchAll(/^## Block ([^（\s]+)(?:（[^）]+）)?[ \t]*$/gm)];
  return headings.map((heading, index) => {
    const source = body.slice(
      heading.index! + heading[0].length,
      headings[index + 1]?.index ?? body.length,
    );
    const state = /^### Node State[ \t]*$\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/m
      .exec(source)?.[1] ?? '';
    const field = (name: string) => (
      new RegExp(`^- ${name}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(state)?.[1]?.trim() ?? ''
    );
    const status = field('Status');
    return {
      id: heading[1]!,
      kind: field('Kind'),
      required: field('Required') !== 'false',
      status: ['pending', 'active', 'completed', 'skipped'].includes(status)
        ? status as PreparedLessonBlock['status']
        : 'pending',
      dependsOn: field('Depends on')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      uses: field('Uses').split(',').map((value) => value.trim()).filter(Boolean),
    };
  });
}

function bodyFromSource(source: string): string {
  const match = /^---[ \t]*\n[\s\S]*?\n---[ \t]*\n/.exec(source);
  return match ? source.slice(match[0].length) : source;
}

function aliasResolvesToCard(root: string, lessonPath: string, target: string): boolean {
  try {
    const path = target.split('#', 1)[0]!;
    if (!path || isAbsolute(path)) return false;
    const absolute = resolveInsideRoot(root, join(dirname(lessonPath), path));
    const canonical = relative(resolveInsideRoot(root, '.'), absolute).replaceAll('\\', '/');
    return readCard(root, canonical) !== null;
  } catch {
    return false;
  }
}

function validatePreparedLessonBody(root: string, lessonPath: string, body: string): void {
  const issues: PreparedLessonIssue[] = [];
  for (const section of ['Aliases', 'Lesson Summary', 'Traces']) {
    if (!new RegExp(`^## ${section}[ \\t]*$`, 'm').test(body)) {
      issues.push({
        code: 'LESSON_SECTION_MISSING',
        message: `缺少顶层 ## ${section}`,
      });
    }
  }

  const aliases = readLessonAliases(body);
  const blocks = readPreparedLessonBlocks(body);
  for (const block of blocks) {
    if (block.kind === 'problem' && block.uses.length !== 1) {
      issues.push({
        code: 'LESSON_PROBLEM_CARD_COUNT',
        message: `Block ${block.id} 必须且只能 Uses 恰好一张题卡，当前为 ${block.uses.length} 张`,
      });
    }
  }
  const usedAliases = [...new Set(blocks.flatMap((block) => block.uses))];
  for (const alias of usedAliases) {
    const target = aliases.get(alias);
    if (target === undefined) {
      issues.push({
        code: 'LESSON_ALIAS_MISSING',
        message: `Block Uses 引用了未声明的 alias：${alias}`,
      });
      continue;
    }
    if (!aliasResolvesToCard(root, lessonPath, target)) {
      issues.push({
        code: 'LESSON_ALIAS_INVALID',
        message: `alias ${alias} 不能解析为真实题卡：${target}`,
      });
    }
  }

  if (issues.length > 0) throw new PreparedLessonValidationError(issues);
}

export function validatePreparedLessonSource(
  root: string,
  lessonPath: string,
  source: string,
): void {
  validatePreparedLessonBody(root, lessonPath, bodyFromSource(source));
}

export function validatePreparedLesson(root: string, lessonPath: string): void {
  const lesson = readMarkdownFile(root, lessonPath);
  validatePreparedLessonBody(root, lessonPath, lesson.body);
}
