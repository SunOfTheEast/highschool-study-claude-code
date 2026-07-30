import { afterEach, expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderHandoff } from 'highschool-study-markdown/study-domain';
import type { MemoryReviewItem } from '../../src/memory-review/contracts';
import { MemoryReviewStore } from '../../src/memory-review/store';
import { createMemoryReviewProposeTool } from '../../src/memory-review/tool';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(completed: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-review-tool-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  if (completed) {
    const path = join(root, 'plans/domain-integrity.md');
    const handoff = renderHandoff({
      id: 'domain-integrity/handoff',
      from: 'plan:domain-integrity',
      to: 'roadmap:roadmap',
      sealedAt: '2026-08-06T10:00:00.000Z',
    }, {
      learnerClaims: [{
        statement: '学生更适合先独立尝试。',
        scope: '本 Plan 的训练课。',
        sources: ['trace:trace-fixture-002'],
        boundary: '新概念课尚未核验。',
        nextUse: '作为学生偏好候选。',
      }],
      teachingClaims: [],
      openQuestions: [],
    });
    writeFileSync(
      path,
      `${readFileSync(path, 'utf8')
        .replace('status: active', 'status: completed')
        .replace(/\n## Handoff[\s\S]*$/, '')
        .trimEnd()}\n\n${handoff}`,
    );
  }
  return root;
}

const items: MemoryReviewItem[] = [{
  id: 'preference-1',
  operation: 'add',
  owner: 'student',
  currentId: null,
  currentText: null,
  proposedText: '先独立尝试，再请求提示。',
  sources: ['claim:domain-integrity/handoff#learner-c1'],
  rationale: '在多节课中重复出现。',
  counterEvidence: '目前没有相反记录。',
  scope: '独立练习题。',
}];

async function execute(tool: ReturnType<typeof createMemoryReviewProposeTool>) {
  return tool.execute(
    'call-1',
    { items },
    new AbortController().signal,
    undefined,
    {} as never,
  );
}

test('rejects proposals until the Session-owned Plan is completed', async () => {
  const root = fixture(false);
  const tool = createMemoryReviewProposeTool(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    new MemoryReviewStore(SessionManager.inMemory(root)),
  );

  await expect(execute(tool)).rejects.toThrow('MEMORY_REVIEW_PLAN_NOT_COMPLETED');
});

test('stores valid candidates and returns only a minimal receipt', async () => {
  const root = fixture(true);
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const tool = createMemoryReviewProposeTool(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    store,
    () => 'review-1',
  );

  const result = await execute(tool);
  expect(store.latest()).toMatchObject({
    id: 'review-1',
    planId: 'domain-integrity',
    status: 'proposed',
    items,
  });
  const content = result.content[0];
  if (content?.type !== 'text') throw new Error('Expected a text receipt');
  expect(JSON.parse(content.text)).toEqual({
    ok: true,
    reviewId: 'review-1',
    itemCount: 1,
  });
  expect(JSON.stringify(result)).not.toContain(items[0]!.proposedText!);
});
