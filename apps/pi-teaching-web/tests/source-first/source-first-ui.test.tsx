import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  LearningAssetLibrarySnapshot,
  LearningMaterial,
  LearningMaterialView,
  LearningSetHomeSnapshot,
  MaterialBookIndex,
  SourceTreeSnapshot,
} from '../../src/shared/contracts';
import { FirstRun } from '../../src/client/desktop/FirstRun';
import { HomePage } from '../../src/client/pages/HomePage';
import {
  BookOverviewPage,
  BookReaderPage,
} from '../../src/client/pages/MaterialPage';
import { SourceTreePage } from '../../src/client/pages/SourceTreePage';
import { formatBrowserRoute, parseBrowserRoute } from '../../src/client/routes';

const revision = {
  revision: 1,
  title: '化学反应原理',
  originalFilename: 'chemistry.pdf',
  mediaType: 'application/pdf',
  sha256: 'abc',
  importedAt: '2026-08-12T10:00:00.000Z',
  originalPath: 'materials/material-001/revisions/1/original.pdf',
  searchStatus: 'image-readable' as const,
  searchablePath: null,
  locatorKind: 'page' as const,
  requestId: 'request-001',
};

const material: LearningMaterial = {
  id: 'material-001',
  path: 'materials/material-001/manifest.yaml',
  currentRevision: 1,
  revisions: [revision],
};

const view: LearningMaterialView = {
  material,
  current: revision,
  suggestedLocator: 'page-0007',
};

const index: MaterialBookIndex = {
  schema: 'studyforge.material-book-index.v1',
  materialId: 'material-001',
  revision: 1,
  pageCount: 12,
  state: 'ready',
  printedPageOffsetHint: null,
  pages: Array.from({ length: 12 }, (_, offset) => ({
    physicalPage: offset + 1,
    pdfLabel: String(offset + 1),
    state: offset === 6 ? 'native-text' as const : 'pending' as const,
    textPath: offset === 6 ? 'materials/material-001/projections/1/pages/page-0007.txt' : null,
    method: offset === 6 ? 'native' as const : null,
    model: null,
    updatedAt: offset === 6 ? '2026-08-12T10:10:00.000Z' : null,
    error: null,
  })),
  outline: [{
    id: 'chapter-3', title: '第三章 水溶液中的离子反应与平衡', level: 1,
    source: 'pdf-bookmark', printedPage: '7', startPage: 7, endPage: 12,
    provenancePages: [],
  }],
  updatedAt: '2026-08-12T10:10:00.000Z',
};

const assets: LearningAssetLibrarySnapshot = {
  notes: [{
    kind: 'note', id: 'note-001', title: 'Ksp 与固体活度', revision: 1,
    updatedAt: '2026-08-12T10:12:00.000Z', tags: null,
    sources: [{ kind: 'material', id: 'material-001', revision: 1, locator: 'page-0007' }],
  }],
  problemCards: [],
};

const sourceTree: SourceTreeSnapshot = {
  books: [{
    materialId: 'material-001', revision: 1, title: '化学反应原理',
    mediaType: 'application/pdf', current: true,
    pageCount: 12,
    chapters: [{
      id: 'chapter-3', title: '第三章 水溶液中的离子反应与平衡', level: 1,
      startPage: 7, endPage: 12,
      assets: [{
        ...assets.notes[0]!, sourceRevision: 1, locator: 'page-0007',
        sourceLabel: '化学反应原理 · 第 7 页',
        sourceRoute: '/assets/books/material-001/read/1/page-0007',
      }],
    }],
    unresolved: { title: '尚未定位到目录', assets: [] },
  }],
  outside: [],
};

test('makes a local PDF the sole dominant first-run action', () => {
  const markup = renderToStaticMarkup(
    <FirstRun
      busy={false}
      error={null}
      onBook={async () => {}}
      onBlank={async () => {}}
      onExisting={async () => {}}
      onExample={async () => {}}
    />,
  );

  expect(markup.match(/desktop-primary/g)).toHaveLength(1);
  expect(markup).toContain('先把你正在学的书放进来');
  expect(markup).toContain('选择 PDF');
  expect(markup).toContain('从空白开始');
  expect(markup).toContain('只发送当前选中的必要页面');
});

test('projects a real book on Home without inventing reading progress', () => {
  const value: LearningSetHomeSnapshot = {
    guide: { title: '化学学习集', introduction: '', principles: '' },
    hasCourse: false,
    course: null,
    assets: { notes: 1, problemCards: 0, materials: 1 },
    books: [{
      id: 'material-001', revision: 1, title: '化学反应原理', pageCount: 12,
      outlineCount: 1, processedPages: 1, route: '/assets/books/material-001',
    }],
    recentFreeLearning: [],
    recentMeta: [],
  };
  const markup = renderToStaticMarkup(
    <HomePage value={value} onNavigate={() => {}} onStartFree={() => {}} />,
  );

  expect(markup).toContain('打开这本书');
  expect(markup).toContain('化学反应原理');
  expect(markup).toContain('正文按需读取');
  expect(markup).toContain('也可以直接问老师');
  expect(markup).not.toMatch(/已读|完成\s*\d+%|学习进度/);
});

test('round-trips book overview, exact reader, and source-tree routes', () => {
  const routes = [
    { kind: 'book' as const, id: 'material-001' },
    {
      kind: 'book-reader' as const,
      id: 'material-001', revision: 1, locator: 'pages-0007-0008',
    },
    { kind: 'assets' as const, view: 'sources' as const },
  ];
  for (const route of routes) {
    const path = formatBrowserRoute(route);
    const url = new URL(path, 'http://localhost');
    expect(parseBrowserRoute(url.pathname, url.search)).toEqual(route);
  }
});

test('renders book identity, honest indexing state, outline, and grown assets', () => {
  const markup = renderToStaticMarkup(
    <BookOverviewPage
      value={view}
      index={index}
      sourceBook={sourceTree.books[0]!}
      onOpenPage={() => {}}
      onLocateOutline={async () => {}}
      onScanOutline={async () => {}}
    />,
  );

  expect(markup).toContain('化学反应原理');
  expect(markup).toContain('12 个物理页');
  expect(markup).toContain('正文按需读取');
  expect(markup).toContain('第三章 水溶液中的离子反应与平衡');
  expect(markup).toContain('Ksp 与固体活度');
  expect(markup).not.toContain('学习进度');
});

test('keeps the original page central and pins the exact current range for learning', () => {
  const markup = renderToStaticMarkup(
    <BookReaderPage
      value={view}
      index={index}
      sourceBook={sourceTree.books[0]!}
      locator="pages-0007-0008"
      pageImageUrl="blob:page-7"
      pageText="纯固体的状态包含在平衡常数中。"
      reading={false}
      error={null}
      onOpenLocator={() => {}}
      onReadPage={async () => {}}
      onReadVisually={async () => {}}
      onAsk={() => {}}
      onOpenAsset={() => {}}
    />,
  );

  expect(markup).toContain('reader-workspace');
  expect(markup).toContain('src="blob:page-7"');
  expect(markup).toContain('第 7–8 页');
  expect(markup).toContain('和老师学这里');
  expect(markup).toContain('只带入当前页段');
  expect(markup).toContain('Ksp 与固体活度');
  expect(markup).not.toContain('page-0007');
});

test('shows the source tree beside the existing semantic route without duplicating assets', () => {
  const markup = renderToStaticMarkup(
    <SourceTreePage
      value={sourceTree}
      onOpenBook={() => {}}
      onOpenAsset={() => {}}
      onOpenSemantic={() => {}}
      onShowTypes={() => {}}
      onImportBook={async () => {}}
    />,
  );

  expect(markup).toContain('沿书学习');
  expect(markup).toContain('按类型查看');
  expect(markup).toContain('化学反应原理');
  expect(markup).toContain('第三章 水溶液中的离子反应与平衡');
  expect(markup.match(/Ksp 与固体活度/g)).toHaveLength(1);
  expect(markup).toContain('语义关系回答“还和什么有关”');
});
