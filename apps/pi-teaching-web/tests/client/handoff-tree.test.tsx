import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HandoffEvidenceNode } from '../../src/shared/contracts';
import { HandoffTree } from '../../src/client/components/HandoffTree';

test('renders recursive evidence states without exposing private teaching text or card paths', () => {
  const value: HandoffEvidenceNode = {
    source: 'claim:roadmap/handoff#learner-c1',
    label: '长期形成了先比较再决定的习惯。',
    state: 'invalidated',
    children: [{
      source: 'claim:plan-a/handoff#teaching-t1',
      label: 'PRIVATE_TEACHING_CLAIM_TEXT',
      state: 'invalidated',
      children: [{
        source: 'card:cards/derivative/secret.card.yaml',
        label: 'cards/derivative/secret.card.yaml',
        state: 'active',
        children: [],
      }, {
        source: 'trace:missing',
        label: '课堂记录不存在',
        state: 'missing',
        children: [],
      }],
    }],
  };

  const html = renderToStaticMarkup(<HandoffTree value={value} />);

  expect(html).toContain('长期形成了先比较再决定的习惯');
  expect(html).toContain('底层记录后来被更正');
  expect(html).toContain('来源暂时不可读');
  expect(html).toContain('教学安排依据');
  expect(html).toContain('关联题卡');
  expect(html).not.toContain('PRIVATE_TEACHING_CLAIM_TEXT');
  expect(html).not.toContain('cards/derivative/secret.card.yaml');
});
