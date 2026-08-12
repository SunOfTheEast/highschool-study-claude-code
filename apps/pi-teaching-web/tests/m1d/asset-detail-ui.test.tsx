import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  LearningMaterial,
  LearningMaterialView,
  LearningNote,
  ProblemActivitySnapshot,
  StudentProblemCard,
} from '../../src/shared/contracts';
import { formatMaterialLocator } from '../../src/client/material-locator';
import {
  buildMaterialLocator,
  MaterialPage,
  parseMaterialLocatorInput,
} from '../../src/client/pages/MaterialPage';
import { NoteDraftPreview, NotePage } from '../../src/client/pages/NotePage';
import { ProblemCardPage } from '../../src/client/pages/ProblemCardPage';

const formation = {
  sessionId: 'free-session-001',
  kind: 'free-learning' as const,
  title: 'Ksp 为什么只写离子浓度？',
  route: '/learn/free-session-001',
};

test('shows a Note formation separately from its pinned source and offers one ask action', () => {
  const note: LearningNote = {
    kind: 'note', id: 'note-001', path: 'notes/note-001.note.yaml', revision: 2,
    title: 'Ksp 的表达边界', createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T11:00:00.000Z', createdSessionId: 'free-session-001',
    sources: [{ kind: 'material', id: 'material-001', revision: 1, locator: 'page-0062' }],
    blocks: [{ kind: 'markdown', body: '纯固体活度并入常数。' }],
  };
  const markup = renderToStaticMarkup(
    <NotePage
      value={{
        ...note,
        formation,
        semanticTags: {
          subject: { kind: 'note', id: 'note-001' },
          revision: 1,
          core: ['沉淀溶解平衡'],
          related: ['纯固体'],
          updatedAt: '2026-08-09T11:00:00.000Z',
        },
        contentHistory: [{
          revision: 1,
          title: 'Ksp 的第一版解释',
          updatedAt: '2026-08-09T10:00:00.000Z',
          blocks: [{ kind: 'markdown', body: '旧正文。' }],
        }],
      }}
      onSave={async () => {}}
      onAskTeacher={() => {}}
      onReload={() => {}}
      onTag={() => {}}
      neighbors={[{
        key: 'problem-card:problem-002',
        asset: { kind: 'problem-card', id: 'problem-002' },
        label: '另一道 Ksp 题',
        detail: '共享 沉淀溶解平衡 标签',
        sharedCoreTags: ['沉淀溶解平衡'],
        sharedTags: ['沉淀溶解平衡'],
        relationLabel: '核心标签相同',
      }]}
      onOpenNeighbor={() => {}}
    />,
  );
  expect(markup).toContain('形成于');
  expect(markup).toContain('Ksp 为什么只写离子浓度？');
  expect(markup).toContain('内容来源');
  expect(markup).toContain('资料 material-001 · 第 1 版 · 第 62 页');
  expect(markup).toContain('带着这份笔记问老师');
  expect(markup).toContain('内容历史 · 1');
  expect(markup).toContain('Ksp 的第一版解释');
  expect(markup).toContain('和这份内容有共同标签');
  expect(markup).toContain('另一道 Ksp 题');
  expect(markup).toContain('共享 沉淀溶解平衡 标签');
  expect(markup).toContain('核心 · 沉淀溶解平衡');
  expect(markup).toContain('data-tag-role="core"');
  expect(markup).not.toMatch(/相似|推荐|先修|因果|掌握/);
});

test('previews the current unsaved Note draft without creating a version', () => {
  const markup = renderToStaticMarkup(<NoteDraftPreview
    title="未保存的新标题"
    blocks={[
      { kind: 'markdown', body: '**草稿正文**' },
      { kind: 'recall', prompt: '为什么？', answer: '因为平衡常数只由温度决定。' },
    ]}
  />);
  expect(markup).toContain('未保存的新标题');
  expect(markup).toContain('<strong>草稿正文</strong>');
  expect(markup).toContain('为什么？');
  expect(markup).not.toMatch(/第\s*\d+\s*版/);
});

function problem(latestAttempt: boolean): StudentProblemCard & {
  activity: ProblemActivitySnapshot;
  formation: typeof formation;
  contentHistory: Array<{
    revision: number;
    title: string;
    updatedAt: string | null;
    stem: string;
    studentNote: string;
  }>;
} {
  return {
    kind: 'problem-card', id: 'problem-001', revision: 1, title: '同离子效应',
    stem: '加入 NaCl 后 Ksp 是否改变？', studentNote: '', standardAnswer: null,
    sources: [], formation,
    contentHistory: [{
      revision: 1,
      title: '旧题干',
      updatedAt: '2026-08-09T09:00:00.000Z',
      stem: '旧题干正文。',
      studentNote: '旧的学生笔记。',
    }],
    activity: {
      cardId: 'problem-001', events: [], answerRevealedForLatestAttempt: false,
      latestAttempt: latestAttempt ? {
        kind: 'attempt', id: 'attempt-001', requestId: 'request-001',
        at: '2026-08-09T10:00:00.000Z', cardId: 'problem-001', cardRevision: 1,
        answerViewedBefore: false, response: { kind: 'answer', text: '不变。' },
      } : null,
    },
  };
}

test('changes only the problem ask copy after an attempt and keeps the answer gate', () => {
  const props = {
    onAttempt: async () => {},
    onReveal: async () => {},
    onSaveNote: async () => {},
    onAskTeacher: async () => {},
  };
  const before = renderToStaticMarkup(<ProblemCardPage value={problem(false)} {...props} />);
  expect(before).toContain('带着这道题问老师');
  expect(before).toContain('提交作答');
  expect(before).toContain('不会，直接看答案');
  expect(before).not.toContain('标准答案');
  expect(before).toContain('内容历史 · 1');
  expect(before).toContain('旧的学生笔记');

  const after = renderToStaticMarkup(<ProblemCardPage value={problem(true)} {...props} />);
  expect(after).toContain('带着这次作答问老师');
  expect(after).toContain('查看标准答案');
  expect(after).not.toContain('带着这道题问老师');
});

test('formats stable Material locators for humans while retaining canonical binding internally', () => {
  expect(formatMaterialLocator('page-0062')).toEqual({ human: '第 62 页', canonical: 'page-0062' });
  expect(formatMaterialLocator('lines-1-80')).toEqual({ human: '第 1–80 行', canonical: 'lines-1-80' });
  expect(formatMaterialLocator(null)).toEqual({ human: '完整资料', canonical: 'whole' });
});

test('translates human page and line controls into canonical locators', () => {
  expect(parseMaterialLocatorInput('page', 'page-0062')).toEqual({ page: 62, start: 1, end: 80 });
  expect(parseMaterialLocatorInput('lines', 'lines-81-120')).toEqual({ page: 1, start: 81, end: 120 });
  expect(buildMaterialLocator('page', { page: 62, start: 1, end: 80 })).toBe('page-0062');
  expect(buildMaterialLocator('page', { page: 10_000, start: 1, end: 80 })).toBeNull();
  expect(buildMaterialLocator('lines', { page: 1, start: 81, end: 120 })).toBe('lines-81-120');
  expect(buildMaterialLocator(null, { page: 1, start: 1, end: 80 })).toBeNull();
});

test('starts a Material page from its suggested locator without exposing canonical syntax', () => {
  const material: LearningMaterial = {
    id: 'material-001', path: 'materials/material-001/manifest.yaml', currentRevision: 1,
    revisions: [{
      revision: 1, title: '化学反应原理教材', originalFilename: 'textbook.pdf',
      mediaType: 'application/pdf', sha256: 'abc', importedAt: '2026-08-09T10:00:00.000Z',
      originalPath: 'materials/material-001/revisions/1/original.pdf',
      searchStatus: 'pdf-text', searchablePath: 'materials/material-001/projections/1/pages.md',
      locatorKind: 'page', requestId: 'request-001',
    }],
  };
  const value: LearningMaterialView = {
    material,
    current: material.revisions[0]!,
    suggestedLocator: 'page-0062',
  };
  const markup = renderToStaticMarkup(
    <MaterialPage value={value} onRead={async () => ({
      id: 'material-001', revision: 1, locator: 'page-0062', path: 'page-0062', text: '正文',
    })} onAsk={() => {}} />,
  );
  expect(markup).toContain('建议位置 · 第 62 页');
  expect(markup).toContain('页码');
  expect(markup).toContain('value="62"');
  expect(markup).toContain('上一页');
  expect(markup).toContain('下一页');
  expect(markup).not.toMatch(/page-0062|Canonical locator|高级定位/);
});
