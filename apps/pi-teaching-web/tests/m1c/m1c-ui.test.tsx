import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  LearningAssetLibrarySnapshot,
  LearningFootprintSnapshot,
  LearningMaterial,
  LearningMaterialView,
  LearningSetHomeSnapshot,
} from '../../src/shared/contracts';
import { AssetsPage, materialImportErrorText } from '../../src/client/pages/AssetsPage';
import { FootprintPage } from '../../src/client/pages/FootprintPage';
import { HomePage } from '../../src/client/pages/HomePage';
import { MaterialPage } from '../../src/client/pages/MaterialPage';
import { formatBrowserRoute, parseBrowserRoute } from '../../src/client/routes';

const home: LearningSetHomeSnapshot = {
  guide: { title: '化学学习集', introduction: '从问题开始。', principles: '' },
  hasCourse: false,
  course: null,
  assets: { notes: 1, problemCards: 0, materials: 1 },
  books: [],
  recentFreeLearning: [],
  recentMeta: [],
};

const material: LearningMaterial = {
  id: 'material-001',
  path: 'materials/material-001/manifest.yaml',
  currentRevision: 1,
  revisions: [{
    revision: 1,
    title: 'Ksp 原文',
    originalFilename: 'chapter.md',
    mediaType: 'text/markdown',
    sha256: 'abc',
    importedAt: '2026-08-09T09:00:00.000Z',
    originalPath: 'materials/material-001/revisions/1/original.md',
    searchStatus: 'native-text',
    searchablePath: 'materials/material-001/revisions/1/original.md',
    locatorKind: 'lines',
    requestId: 'request-001',
  }],
};

test('round-trips Material, Meta, and footprint browser routes', () => {
  const routes = [
    { kind: 'material' as const, id: 'material-001' },
    { kind: 'meta' as const, sessionId: 'meta-session-001' },
    { kind: 'footprint' as const },
  ];
  for (const route of routes) expect(parseBrowserRoute(formatBrowserRoute(route))).toEqual(route);
});

test('offers Meta before a Roadmap and replaces it with the real course entrance afterward', () => {
  const blank = renderToStaticMarkup(
    <HomePage
      value={home}
      onNavigate={() => {}}
      onStartFree={() => {}}
      onPlan={() => {}}
      onOpenFootprint={() => {}}
    />,
  );
  expect(blank).toContain('规划长期学习');
  expect(blank).toContain('学习足迹');
  expect(blank).not.toContain('进入正式课程');

  const course = renderToStaticMarkup(
    <HomePage
      value={{
        ...home,
        hasCourse: true,
        course: {
          title: '化学反应原理路线',
          route: '/course',
          activeLesson: null,
        },
      }}
      onNavigate={() => {}}
      onStartFree={() => {}}
      onPlan={() => {}}
      onOpenFootprint={() => {}}
    />,
  );
  expect(course).toContain('进入正式课程');
  expect(course).not.toContain('规划长期学习');
});

test('shows Materials, plain-language tags and pinned sources without internal storage terms', () => {
  const assets: LearningAssetLibrarySnapshot = {
    notes: [{
      kind: 'note',
      id: 'note-001',
      title: 'Ksp 中的纯固体',
      revision: 2,
      updatedAt: '2026-08-09T10:00:00.000Z',
      tags: { core: ['沉淀溶解平衡'], related: ['纯固体'] },
      sources: [{ kind: 'material', id: 'material-001', revision: 1, locator: 'lines-1-2' }],
    }],
    problemCards: [],
  };
  const markup = renderToStaticMarkup(
    <AssetsPage
      value={assets}
      materials={[material]}
      onOpen={() => {}}
      onOpenMaterial={() => {}}
      onAsk={() => {}}
      onImport={async () => {}}
      onOpenFootprint={() => {}}
    />,
  );
  expect(markup).toContain('上传资料');
  expect(markup).toContain('Ksp 原文');
  expect(markup).toContain('正文可搜索');
  expect(markup).toContain('沉淀溶解平衡');
  expect(markup).toContain('内容来源');
  expect(markup).toContain('资料 material-001 · 第 1 版 · 第 1–2 行');
  expect(markup).not.toMatch(/sidecar|metadata|projection|revision/i);
});

test('sanitizes a failed material import instead of exposing runtime details', () => {
  const message = materialImportErrorText(
    new Error('API_ERROR: /private/tmp/material-import.jsonl'),
  );
  expect(message).toContain('资料暂时没有导入');
  expect(message).not.toMatch(/API_ERROR|private|jsonl/);
});

test('opens one exact source range and can carry it into free learning', () => {
  const value: LearningMaterialView = {
    material,
    current: material.revisions[0]!,
    suggestedLocator: 'lines-1-2',
  };
  const markup = renderToStaticMarkup(
    <MaterialPage
      value={value}
      onRead={async () => ({
        id: material.id,
        revision: 1,
        locator: 'lines-1-2',
        path: material.revisions[0]!.originalPath,
        text: '纯固体活度并入常数。',
      })}
      onAsk={() => {}}
    />,
  );
  expect(markup).toContain('资料位置');
  expect(markup).toContain('第 1–2 行');
  expect(markup).toContain('起始行');
  expect(markup).toContain('结束行');
  expect(markup).toContain('读取后可问老师');
  expect(markup).toContain('第 1 版');
  expect(markup).not.toMatch(/lines-1-2|canonical|projection|manifest|revision/i);
});

test('renders only student-facing learning-history entries in the footprint', () => {
  const value: LearningFootprintSnapshot = {
    entries: [{
      id: 'history-1',
      at: '2026-08-09T13:00:00.000Z',
      activity: 'learning-history',
      title: '沉淀溶解平衡',
      summary: '在陌生情境中重新解释了纯固体的地位。',
      route: '/learn/free-session-001',
      source: {
        kind: 'object-memory',
        objectId: 'obj-001',
        path: 'memory/objects/obj-001.md',
        evidence: [{ kind: 'free-learning', sessionId: 'free-session-001' }],
      },
    }, {
      id: 'asset-review:note:note-001:event-002',
      at: '2026-08-10T08:00:00.000Z',
      activity: 'asset-review',
      title: 'Ksp 中的纯固体',
      summary: '复习结果：顺利想起',
      route: '/assets/notes/note-001',
      source: {
        kind: 'asset-review',
        asset: { kind: 'note', id: 'note-001' },
        eventId: 'event-002',
        result: 'fluent',
      },
    }],
  };
  const markup = renderToStaticMarkup(<FootprintPage value={value} onOpen={() => {}} />);
  expect(markup).toContain('学习足迹');
  expect(markup).toContain('在陌生情境中重新解释了纯固体的地位');
  expect(markup).not.toContain('Current Judgment');
  expect(markup).not.toContain('object-memory');
  expect(markup).toContain('完成复习');
  expect(markup).toContain('复习结果：顺利想起');
  expect(markup).toContain('打开笔记');
});
