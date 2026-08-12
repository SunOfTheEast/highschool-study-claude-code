import { expect, test } from 'bun:test';
import type {
  LearningAssetLibrarySnapshot,
  LearningMaterial,
} from '../../src/shared/contracts';
import { filterAssetLibrary } from '../../src/client/asset-library-filter';

const material: LearningMaterial = {
  id: 'material-001', path: 'materials/material-001/manifest.yaml', currentRevision: 1,
  revisions: [{
    revision: 1, title: '化学反应原理第三章', originalFilename: '选修四.pdf',
    mediaType: 'application/pdf', sha256: 'abc', importedAt: '2026-08-12T00:00:00.000Z',
    originalPath: 'materials/material-001/revisions/1/original.pdf', searchStatus: 'pdf-text',
    searchablePath: 'materials/material-001/revisions/1/text.md', locatorKind: 'page',
    requestId: 'request-001',
  }],
};

const library: LearningAssetLibrarySnapshot = {
  notes: [{
    kind: 'note', id: 'note-001', title: 'Ksp 的边界', revision: 1,
    updatedAt: '2026-08-12T00:00:00.000Z', searchText: '纯固体活度并入常数',
    tags: { core: ['沉淀溶解平衡'], related: ['离子积'] },
    sources: [{ kind: 'material', id: 'material-001', revision: 1, locator: 'page-0003' }],
  }],
  problemCards: [{
    kind: 'problem-card', id: 'problem-001', title: '恒成立变式', revision: 1,
    updatedAt: null, searchText: '绝对值 三次函数 参数主元',
    tags: { core: ['恒成立'], related: ['参数分离'] }, sources: [],
  }],
};

test('filters locally by visible body, source name, filename, and exact tag', () => {
  expect(filterAssetLibrary(library, [material], { query: '纯固体', tag: null }).notes)
    .toHaveLength(1);
  expect(filterAssetLibrary(library, [material], { query: '选修四', tag: null }).notes)
    .toHaveLength(1);
  expect(filterAssetLibrary(library, [material], { query: '参数主元', tag: null }).problemCards)
    .toHaveLength(1);
  const tagged = filterAssetLibrary(library, [material], { query: '', tag: '沉淀溶解平衡' });
  expect(tagged.notes).toHaveLength(1);
  expect(tagged.problemCards).toHaveLength(0);
});

test('keeps material filtering in the same student-facing search', () => {
  expect(filterAssetLibrary(library, [material], { query: '第三章', tag: null }).materials)
    .toEqual([material]);
  expect(filterAssetLibrary(library, [material], { query: '不存在', tag: null }))
    .toEqual({ notes: [], problemCards: [], materials: [] });
});
