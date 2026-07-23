import {
  readCard,
  readLessonAliases,
  readMarkdownFile,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';

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

export function validatePreparedLesson(root: string, lessonPath: string): void {
  const lesson = readMarkdownFile(root, lessonPath);
  const body = lesson.body;
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
    const resolved = sourceResolve(root, { fromPath: lessonPath, target });
    if (!resolved.valid || resolved.path === null || readCard(root, resolved.path) === null) {
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
