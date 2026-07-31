import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceLineage } from '../../src/client/components/EvidenceLineage';
import { memoryProjectionFixture } from '../support/view-fixtures';

test('keeps invalidated and missing sources visible with text labels', () => {
  const lineage = memoryProjectionFixture().lineage!;
  const html = renderToStaticMarkup(
    <EvidenceLineage
      value={lineage}
      selectedSource={lineage.source}
      onSelect={() => {}}
    />,
  );
  expect(html).toContain('来源后来被修正');
  expect(html).toContain('来源暂时不可读');
  expect(html).toContain('aria-current="true"');
});
