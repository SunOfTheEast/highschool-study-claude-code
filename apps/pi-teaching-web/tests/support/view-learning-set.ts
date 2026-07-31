import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendTrace,
  readActiveTraces,
  readLessonAliases,
  readMarkdownFile,
  renderHandoff,
} from 'highschool-study-markdown/study-domain';
import { renderProfileDocument } from '../../src/memory-review/profile-document';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from './fixture-paths';

const roots: string[] = [];

export function copyViewLearningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-view-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

export function removeViewLearningSets(): void {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
}

export function clearTracePool(root: string): void {
  rmSync(join(root, 'traces'), { recursive: true, force: true });
  mkdirSync(join(root, 'traces'), { recursive: true });
}

export function installObservedMethod(root: string): string {
  const methodName = '同构变形与换元法';
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-002',
    cardAlias: 'Q-DOMAIN-EX11',
    cardStepId: null,
    materialPath: null,
    assessment: 'partially_correct',
    support: 'tutor',
    note: '学生实际使用同构路线，仍需一次提示。',
    supersedes: 'trace-fixture-001',
    methods: { primary: methodName, secondary: [] },
  }, () => new Date('2026-07-30T07:58:00.000Z'), () => (
    '33333333-3333-4333-8333-333333333333'
  ));
  return methodName;
}

export function installInvalidatedOnlyMethod(root: string): string {
  const workspace = readPlanWorkspace(root, 'domain-integrity');
  const activeKeys = new Set(readActiveTraces(root).map((trace) => (
    `${trace.lessonId}:${trace.blockId}:${trace.cardPath ?? ''}`
  )));
  const candidate = workspace.lessons.flatMap((lesson) => {
    const source = readMarkdownFile(root, lesson.path).body;
    const aliases = readLessonAliases(source);
    return lesson.blocks.flatMap((block) => block.kind === 'problem'
      ? block.uses.flatMap((alias) => {
          const cardPath = aliases.get(alias) ?? null;
          const key = `${lesson.id}:${block.id}:${cardPath ?? ''}`;
          return cardPath && !activeKeys.has(key)
            ? [{ lesson, block, alias }]
            : [];
        })
      : []);
  })[0];
  if (!candidate) throw new Error('VIEW_FIXTURE_UNUSED_ATTEMPT_REQUIRED');
  const original = appendTrace(root, {
    lessonPath: candidate.lesson.path,
    blockId: candidate.block.id,
    cardAlias: candidate.alias,
    cardStepId: null,
    materialPath: null,
    assessment: 'incorrect',
    support: 'none',
    note: '最初错误地把这一作答绑定为递推转化。',
    supersedes: null,
    methods: { primary: '递推转化', secondary: [] },
  }, () => new Date('2026-07-30T08:00:00.000Z'), () => (
    '11111111-1111-4111-8111-111111111111'
  ));
  appendTrace(root, {
    lessonPath: candidate.lesson.path,
    blockId: candidate.block.id,
    cardAlias: candidate.alias,
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '复核后绑定到学生实际使用的同构方法。',
    supersedes: original.traceId,
    methods: { primary: '同构变形与换元法', secondary: [] },
  }, () => new Date('2026-07-30T08:01:00.000Z'), () => (
    '22222222-2222-4222-8222-222222222222'
  ));
  return '递推转化';
}

export function installViewMemoryScenario(root: string): {
  invalidatedSource: string;
  activeSource: string;
} {
  const corrected = appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-002',
    cardAlias: 'Q-DOMAIN-EX11',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '学生复核后独立补全定义域。',
    supersedes: 'trace-fixture-001',
    methods: { primary: '同构变形与换元法', secondary: [] },
  }, () => new Date('2026-07-30T09:00:00.000Z'), () => (
    '44444444-4444-4444-8444-444444444444'
  ));

  const lessonPath = join(root, 'lessons/lesson-001.md');
  const lessonSource = readFileSync(lessonPath, 'utf8');
  const lessonHandoff = renderHandoff({
    id: 'lesson-001/handoff',
    from: 'lesson:lesson-001',
    to: 'plan:domain-integrity',
    sealedAt: '2026-07-30T09:05:00.000Z',
  }, {
    learnerClaims: [{
      statement: '学生在复核后能独立补全定义域。',
      scope: '本节同构题。',
      sources: [corrected.sourceRef],
      boundary: '尚未检查跨题型迁移。',
      nextUse: '下一节更换题型继续观察。',
    }, {
      statement: '学生总会遗漏定义域。',
      scope: '本节首次作答。',
      sources: ['trace:trace-fixture-001'],
      boundary: '该来源后来已更正。',
      nextUse: '不再作为当前判断。',
    }],
    teachingClaims: [{
      statement: 'PRIVATE_LESSON_TEACHING_CLAIM',
      scope: '下一节课。',
      sources: [corrected.sourceRef],
      boundary: 'PRIVATE_LESSON_BOUNDARY',
      nextUse: 'PRIVATE_LESSON_NEXT_USE',
    }],
    openQuestions: [{
      question: '换题型后还能主动补全定义域吗？',
      sources: [corrected.sourceRef],
      nextCheck: '用另一种函数外壳检查。',
    }],
  });
  writeFileSync(
    lessonPath,
    `${lessonSource.replace(/\n## Handoff[\s\S]*$/, '').trimEnd()}\n\n${lessonHandoff}`,
  );

  const planPath = join(root, 'plans/domain-integrity.md');
  const planSource = readFileSync(planPath, 'utf8');
  const planHandoff = renderHandoff({
    id: 'domain-integrity/handoff',
    from: 'plan:domain-integrity',
    to: 'roadmap:roadmap',
    sealedAt: '2026-07-30T09:10:00.000Z',
  }, {
    learnerClaims: [{
      statement: '学生开始把定义域作为推导条件使用。',
      scope: '当前 Plan。',
      sources: ['claim:lesson-001/handoff#learner-c1'],
      boundary: '目前只有一种题型的干净记录。',
      nextUse: '继续做跨结构核验。',
    }],
    teachingClaims: [{
      statement: 'PRIVATE_PLAN_TEACHING_CLAIM',
      scope: '当前 Plan。',
      sources: [corrected.sourceRef],
      boundary: 'SYSTEM_PROMPT_SENTINEL',
      nextUse: 'SUBAGENT_RAW_SENTINEL',
    }],
    openQuestions: [{
      question: '定义域意识能否连续保持？',
      sources: ['claim:lesson-001/handoff#learner-c1'],
      nextCheck: '下一节做无提示核验。',
    }],
  });
  writeFileSync(
    planPath,
    `${planSource
      .replace('status: active', 'status: completed')
      .replace(/\n## Handoff[\s\S]*$/, '')
      .trimEnd()}\n\n${planHandoff}`,
  );

  const studentPath = join(root, 'memory/student-profile.md');
  const student = readFileSync(studentPath, 'utf8');
  writeFileSync(studentPath, renderProfileDocument(student, 'student', [{
    id: 'S1',
    content: '先独立尝试，再讨论关键卡点。',
    scope: '导数训练课。',
    sources: ['claim:domain-integrity/handoff#learner-c1'],
    rationale: '本周期多次出现。',
    counterEvidence: '新概念课尚未核验。',
  }]));
  const teachingPath = join(root, 'memory/teaching-profile.md');
  const teaching = readFileSync(teachingPath, 'utf8');
  writeFileSync(teachingPath, renderProfileDocument(teaching, 'teaching', [{
    id: 'T1',
    content: '首次作答前不主动给决定性变形。',
    scope: '考察与训练课。',
    sources: ['claim:domain-integrity/handoff#teaching-t1'],
    rationale: '学生已明确确认。',
    counterEvidence: '讲授型新课可以例外。',
  }]));
  const roadmapPath = join(root, 'ROADMAP.md');
  writeFileSync(
    roadmapPath,
    `${readFileSync(roadmapPath, 'utf8').trimEnd()}

## Handoff Checkpoints

### Checkpoint checkpoint-001

- Sealed at: 2026-07-30T09:15:00.000Z

#### Learner C1

- Statement: "学生已进入跨结构核验阶段。"
- Scope: "当前 Roadmap。"
- Sources:
  - claim:domain-integrity/handoff#learner-c1
- Boundary: "新题型仍待观察。"
- Next use: "下一 Plan 继续检查迁移。"
`,
  );

  return {
    invalidatedSource: 'trace:trace-fixture-001',
    activeSource: corrected.sourceRef,
  };
}
