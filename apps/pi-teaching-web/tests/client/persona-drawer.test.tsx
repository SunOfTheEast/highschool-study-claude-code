import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonaPresentation } from '../../src/shared/contracts';
import { PersonaDrawer } from '../../src/client/components/PersonaDrawer';

const persona: PersonaPresentation = {
  id: 'calm-senpai',
  choices: [{
    id: 'calm-senpai',
    name: '冷静学姐',
    description: '沉静、精确，先听完再给短提示。',
    glyph: '静',
    accent: '#76647a',
    portraitUrl: null,
  }, {
    id: 'custom-guide',
    name: '自定义学伴',
    description: '公开的学生预览。',
    glyph: '伴',
    accent: '#48636f',
    portraitUrl: '/api/personas/custom-guide/portrait',
  }],
};

test('shows public companion previews, current state and display preferences', () => {
  const html = renderToStaticMarkup(
    <PersonaDrawer
      value={persona}
      preferences={{ motion: 'gentle', completionFeedback: true }}
      onClose={() => {}}
      onSelect={async () => {}}
      onPreferences={() => {}}
    />,
  );

  expect(html).toContain('陪伴风格');
  expect(html).toContain('冷静学姐');
  expect(html).toContain('沉静、精确');
  expect(html).toContain('自定义学伴');
  expect(html).toContain('/api/personas/custom-guide/portrait');
  expect(html).toContain('#48636f');
  expect(html).toContain('当前');
  expect(html).toContain('柔和动效');
  expect(html).toContain('完成反馈');
  expect(html).not.toContain('INTERNAL');
  expect(html).not.toContain('Teacher Control');
});
