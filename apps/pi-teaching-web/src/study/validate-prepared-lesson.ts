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
    | 'LESSON_REFLECTION_COUNT';
  message: string;
};

export class PreparedLessonValidationError extends Error {
  readonly code = 'PREPARED_LESSON_INVALID';

  constructor(readonly issues: PreparedLessonIssue[]) {
    super(`PREPARED_LESSON_INVALID: ${issues.map((issue) => issue.code).join(', ')}`);
    this.name = 'PreparedLessonValidationError';
  }
}

type RawBlock = {
  id: string;
  kind: string;
  uses: string[];
};

function rawBlocks(body: string): RawBlock[] {
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
    return {
      id: heading[1]!,
      kind: field('Kind'),
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
  for (const section of ['Aliases', 'Reflection', 'Lesson Summary', 'Traces']) {
    if (!new RegExp(`^## ${section}[ \\t]*$`, 'm').test(body)) {
      issues.push({
        code: 'LESSON_SECTION_MISSING',
        message: `缺少顶层 ## ${section}`,
      });
    }
  }

  const aliases = readLessonAliases(body);
  const blocks = rawBlocks(body);
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

  const reflections = blocks.filter((block) => block.kind === 'reflection');
  if (reflections.length !== 1) {
    issues.push({
      code: 'LESSON_REFLECTION_COUNT',
      message: `需要恰好一个显式 Kind: reflection Block，当前为 ${reflections.length} 个`,
    });
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
