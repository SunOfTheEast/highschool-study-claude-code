import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { planLearningNoteSave } from '../../src/study/learning-assets';
import { readKnowledge } from '../../src/study/knowledge';
import {
  importMaterial,
  listMaterials,
  readMaterial,
  readMaterialLocator,
} from '../../src/study/materials';

const roots: string[] = [];

function blankRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-materials-'));
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), '# Test\n');
  mkdirSync(join(root, 'memory'), { recursive: true });
  writeFileSync(join(root, 'memory/INDEX.md'), '# Teacher Memory Index\n');
  roots.push(root);
  return root;
}

function pdfWithText(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n`;
  source += '0000000000 65535 f \n';
  source += offsets.slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('imports immutable text revisions without manufacturing learning facts', async () => {
  const root = blankRoot();
  const first = await importMaterial(root, {
    requestId: 'request-001',
    title: '化学反应原理摘录',
    filename: 'chapter.txt',
    mediaType: 'text/plain',
    bytes: new TextEncoder().encode('第一行\nKsp 只写离子浓度。\n第三行'),
  }, '2026-08-09T09:00:00.000Z');

  expect(first).toMatchObject({ id: 'material-001', revision: 1, searchStatus: 'native-text' });
  expect(readMaterialLocator(root, {
    id: first.id,
    revision: 1,
    locator: 'lines-2-2',
  }).text).toBe('Ksp 只写离子浓度。');
  expect(await importMaterial(root, {
    requestId: 'request-001',
    title: '重复请求不新建',
    filename: 'chapter.txt',
    mediaType: 'text/plain',
    bytes: new TextEncoder().encode('第一行\nKsp 只写离子浓度。\n第三行'),
  }, '2026-08-09T09:10:00.000Z')).toEqual(first);

  const second = await importMaterial(root, {
    requestId: 'request-002',
    target: { id: first.id, expectedRevision: 1 },
    title: '化学反应原理摘录（修订）',
    filename: 'chapter.txt',
    mediaType: 'text/plain',
    bytes: new TextEncoder().encode('新版正文'),
  }, '2026-08-09T10:00:00.000Z');
  expect(second.revision).toBe(2);
  expect(readMaterial(root, first.id).revisions.map((item) => item.revision)).toEqual([1, 2]);
  expect(readFileSync(join(root, 'materials/material-001/revisions/1/original.txt'), 'utf8'))
    .toContain('Ksp');

  expect(existsSync(join(root, 'ROADMAP.md'))).toBeFalse();
  expect(existsSync(join(root, 'notes'))).toBeFalse();
  expect(existsSync(join(root, 'cards'))).toBeFalse();
  expect(existsSync(join(root, 'semantics'))).toBeFalse();
  expect(readdirSync(join(root, 'memory'))).toEqual(['INDEX.md']);
});

test('extracts PDF pages mechanically and keeps an unreadable original recoverable', async () => {
  const root = blankRoot();
  const pdf = await importMaterial(root, {
    requestId: 'request-pdf',
    title: 'Ksp PDF',
    filename: 'ksp.pdf',
    mediaType: 'application/pdf',
    bytes: pdfWithText('Ksp solid activity'),
  }, '2026-08-09T09:00:00.000Z');
  expect(pdf.searchStatus).toBe('pdf-text');
  expect(readMaterialLocator(root, {
    id: pdf.id,
    revision: 1,
    locator: 'page-0001',
  }).text).toContain('Ksp solid activity');

  const broken = await importMaterial(root, {
    requestId: 'request-broken-pdf',
    title: '暂不可搜索的 PDF',
    filename: 'broken.pdf',
    mediaType: 'application/pdf',
    bytes: new TextEncoder().encode('not a pdf'),
  }, '2026-08-09T09:10:00.000Z');
  expect(broken.searchStatus).toBe('unavailable');
  expect(existsSync(join(root, 'materials/material-002/revisions/1/original.pdf'))).toBeTrue();
  expect(() => readMaterialLocator(root, {
    id: broken.id,
    revision: 1,
    locator: 'page-0001',
  })).toThrow('MATERIAL_LOCATOR_UNAVAILABLE');
});

test('validates pinned Material sources and projects each managed or legacy item once', async () => {
  const root = blankRoot();
  const material = await importMaterial(root, {
    requestId: 'request-source',
    title: '平衡常数材料',
    filename: 'equilibrium.md',
    mediaType: 'text/markdown',
    bytes: new TextEncoder().encode('# 平衡常数\n\n纯固体活度进入常数。'),
  }, '2026-08-09T09:00:00.000Z');
  mkdirSync(join(root, 'materials/legacy'), { recursive: true });
  writeFileSync(join(root, 'materials/legacy/old.txt'), '旧散装资料');

  const note = planLearningNoteSave(root, 'session-001', {
    title: '纯固体活度',
    blocks: [{ kind: 'markdown', body: '形成的解释。' }],
    sources: [{ kind: 'material', id: material.id, revision: 1, locator: 'lines-1-3' }],
    tags: { core: ['平衡常数'], related: ['固体活度'] },
  }, '2026-08-09T10:00:00.000Z');
  commitDocumentCandidates(root, note.candidates);
  expect(() => planLearningNoteSave(root, 'session-001', {
    title: '错误页码',
    blocks: [{ kind: 'markdown', body: '不应保存。' }],
    sources: [{ kind: 'material', id: material.id, revision: 1, locator: 'lines-99-99' }],
    tags: { core: ['平衡常数'], related: [] },
  }, '2026-08-09T10:10:00.000Z')).toThrow('MATERIAL_LOCATOR_NOT_FOUND');

  expect(listMaterials(root)).toHaveLength(1);
  const projected = readKnowledge(root).materials;
  expect(projected).toHaveLength(2);
  expect(projected.map((item) => item.title)).toContain('平衡常数材料');
  expect(projected.map((item) => item.path)).toContain('materials/legacy/old.txt');
  expect(projected.some((item) => item.path.endsWith('manifest.yaml'))).toBeFalse();
  expect(projected.some((item) => item.path.includes('/projections/'))).toBeFalse();
});
