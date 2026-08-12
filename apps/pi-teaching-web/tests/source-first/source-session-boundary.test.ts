import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { loadStaticFreeLearningResources } from '../../src/runtime/resource-loader';
import type { StudySession, StudySessionFactory } from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import {
  createMaterialBookIndex,
  writeMaterialBookIndex,
  writeMaterialBookPageProjection,
} from '../../src/study/material-book-index';
import { renderSelectedAssetContext } from '../../src/study/learning-assets';
import { importMaterial } from '../../src/study/materials';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-source-session-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

async function seedBook(root: string, processedPages: number[] = []) {
  const imported = await importMaterial(root, {
    requestId: 'source-session-book',
    title: '化学反应原理',
    filename: 'chemistry.pdf',
    mediaType: 'application/pdf',
    source: { kind: 'bytes', bytes: new TextEncoder().encode('%PDF-1.7\nsource test') },
  }, '2026-08-12T10:00:00.000Z');
  let index = createMaterialBookIndex({
    materialId: imported.id,
    revision: imported.revision,
    pageCount: 100,
    pageLabels: null,
    outline: [
      {
        id: 'chapter-4',
        title: '第四章 沉淀溶解平衡',
        level: 1,
        source: 'pdf-bookmark',
        printedPage: '35',
        startPage: 40,
        endPage: 50,
        provenancePages: [],
      },
      {
        id: 'chapter-5',
        title: '第五章 电化学',
        level: 1,
        source: 'pdf-bookmark',
        printedPage: '55',
        startPage: 60,
        endPage: 70,
        provenancePages: [],
      },
    ],
    updatedAt: '2026-08-12T10:01:00.000Z',
  });
  writeMaterialBookIndex(root, index);

  for (const page of processedPages) {
    const textPath = `materials/${imported.id}/projections/${imported.revision}/pages/page-${
      String(page).padStart(4, '0')
    }.txt`;
    index = {
      ...index,
      pages: index.pages.map((entry) => entry.physicalPage === page ? {
        ...entry,
        state: 'native-text' as const,
        textPath,
        method: 'native' as const,
        updatedAt: '2026-08-12T10:02:00.000Z',
      } : entry),
      updatedAt: '2026-08-12T10:02:00.000Z',
    };
    writeMaterialBookPageProjection(root, index, {
      physicalPage: page,
      text: page === 60 ? 'UNRELATED_ELECTROCHEMISTRY' : `SELECTED_PAGE_${page}`,
    });
  }
  return { imported, index };
}

function fakeSession(id: string): StudySession {
  const entries: SessionEntry[] = [];
  const listeners = new Set<(event: AgentSessionEvent) => void>();
  return {
    sessionId: id,
    sessionFile: `/sessions/${id}.jsonl`,
    messages: [],
    entries,
    isStreaming: false,
    prompt: async () => {},
    abort: async () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendCustomMessage: async () => {},
    appendCustomEntry: () => {},
    dispose: () => listeners.clear(),
  };
}

test('carries only the exact processed source range into Free Learning', async () => {
  const root = copyFixture();
  const { imported } = await seedBook(root, [42, 43, 44, 60]);
  const selected = [{
    kind: 'material' as const,
    id: imported.id,
    revision: imported.revision,
    locator: 'pages-0042-0044',
  }];
  const filesBefore = Array.from(new Bun.Glob('**/*').scanSync(root)).sort();

  const resources = loadStaticFreeLearningResources(root, {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: '2026-08-12T10:03:00.000Z',
    selectedAssets: selected,
  });
  const context = resources.agentsFiles.find((entry) => (
    entry.path === '/virtual/studyforge-m1b-selected-assets.md'
  ))?.content ?? '';

  expect(context).toContain('source-1');
  expect(context).toContain('《化学反应原理》 · 第四章 沉淀溶解平衡 · 第 42–44 页');
  expect(context).toContain('locator: pages-0042-0044');
  expect(context).toContain('SELECTED_PAGE_42');
  expect(context).toContain('SELECTED_PAGE_43');
  expect(context).toContain('SELECTED_PAGE_44');
  expect(context).not.toContain('UNRELATED_ELECTROCHEMISTRY');
  expect(context).not.toContain('第五章 电化学');
  expect(context).not.toContain('book-index.yaml');
  expect(context).not.toContain('/projections/');
  expect(context).not.toContain('%PDF-1.7');
  expect(context).not.toContain('# Teacher Memory Index');
  expect(Array.from(new Bun.Glob('**/*').scanSync(root)).sort()).toEqual(filesBefore);
  expect(existsSync(join(root, 'ROADMAP.md'))).toBe(false);
  expect(existsSync(join(root, 'plans'))).toBe(false);
});

test('accepts an indexed pending page range without pretending it was read', async () => {
  const root = copyFixture();
  const { imported } = await seedBook(root);
  const selected = [{
    kind: 'material' as const,
    id: imported.id,
    revision: imported.revision,
    locator: 'pages-0042-0044',
  }];

  expect(renderSelectedAssetContext(root, selected)).toContain('text: null');

  const inputs: Parameters<StudySessionFactory>[0][] = [];
  const registry = new WorkspaceRegistry(root, async (input) => {
    inputs.push(input);
    return fakeSession('source-session-001');
  }, undefined, undefined, async () => null, async () => []);
  await registry.createFreeLearning(selected);

  expect(inputs[0]).toEqual(expect.objectContaining({
    sessionKind: 'free-learning',
    selectedAssets: selected,
  }));
});
