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
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('status: active', 'status: completed'),
    );
  }
  return root;
}

const items: MemoryReviewItem[] = [{
  id: 'preference-1',
  operation: 'add',
  owner: 'student',
  currentText: null,
  proposedText: '先独立尝试，再请求提示。',
  sources: ['lessons/lesson-001.md#trace-event-001'],
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
