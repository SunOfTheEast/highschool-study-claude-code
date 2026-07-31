import { expect, test } from 'bun:test';
import { layoutMethodTree } from '../../src/client/method-layout';
import { knowledgeProjectionFixture } from '../support/view-fixtures';

test('places children to the right of their parent in deterministic order', () => {
  const positioned = layoutMethodTree(knowledgeProjectionFixture().nodes);
  const byId = new Map(positioned.map((node) => [node.id, node]));
  for (const node of positioned) {
    if (!node.parentId) continue;
    expect(node.x).toBeGreaterThan(byId.get(node.parentId)!.x);
  }
  expect(layoutMethodTree(knowledgeProjectionFixture().nodes)).toEqual(positioned);
});
