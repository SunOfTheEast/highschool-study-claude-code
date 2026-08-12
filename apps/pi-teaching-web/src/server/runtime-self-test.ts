import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { createEventBus } from '@earendil-works/pi-coding-agent';
import { registerStudyForgeBunRuntime } from '../runtime/bun-runtime';
import { createRoleResourceLoader } from '../runtime/resource-loader';
import { importMaterial } from '../study/materials';
import { bootstrapPdfBookIndex, renderPdfBookPage } from '../study/pdf-book';

export type RuntimeSelfTestReceipt = {
  planSubagent: 'passed';
  subagentChildRuntime: 'passed';
  pdfImport: 'passed';
  bedrock: 'passed';
};

function onePagePdf(text: string): Uint8Array {
  const stream = `q 24 0 0 24 72 680 cm /Im0 Do Q BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\nFF0000>\nendstream',
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}

export async function runRuntimeSelfTest(resourceRoot: string): Promise<RuntimeSelfTestReceipt> {
  if (!isAbsolute(resourceRoot)) throw new Error('STUDYFORGE_SELF_TEST_RESOURCE_ROOT_INVALID');
  process.env.STUDYFORGE_RESOURCE_ROOT = resourceRoot;
  const subagentChildRuntime = process.env.PI_SUBAGENT_PROMPT_RUNTIME_EXTENSION_PATH?.trim();
  if (
    !subagentChildRuntime
    || !isAbsolute(subagentChildRuntime)
    || !existsSync(subagentChildRuntime)
  ) {
    throw new Error('STUDYFORGE_SELF_TEST_SUBAGENT_CHILD_RUNTIME_MISSING');
  }
  const root = mkdtempSync(join(tmpdir(), 'studyforge-runtime-self-test-'));
  try {
    writeFileSync(join(root, 'LEARNING_GUIDE.md'), '# Runtime self-test\n');
    mkdirSync(join(root, 'memory'), { recursive: true });
    writeFileSync(join(root, 'memory/INDEX.md'), '# Teacher Memory Index\n');

    const loader = await createRoleResourceLoader(root, {
      nodeKind: 'plan',
      nodeId: 'plan-001',
      nodePath: 'plans/plan-001/PLAN.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    }, createEventBus());
    const tools = loader.getExtensions().extensions.flatMap((extension) => (
      Array.from(extension.tools.keys())
    ));
    if (!tools.includes('subagent')) throw new Error('STUDYFORGE_SELF_TEST_SUBAGENT_MISSING');

    const pdf = await importMaterial(root, {
      requestId: 'runtime-self-test-pdf',
      title: 'Runtime self-test PDF',
      filename: 'runtime-self-test.pdf',
      mediaType: 'application/pdf',
      source: { kind: 'bytes', bytes: onePagePdf('StudyForge PDF text') },
    }, '2026-08-10T00:00:00.000Z');
    if (pdf.searchStatus !== 'unavailable' || !existsSync(join(root, pdf.originalPath))) {
      throw new Error('STUDYFORGE_SELF_TEST_PDF_IMPORT_FAILED');
    }
    const book = await bootstrapPdfBookIndex(
      root,
      pdf.id,
      pdf.revision,
      '2026-08-10T00:00:01.000Z',
    );
    if (book.pageCount !== 1) throw new Error('STUDYFORGE_SELF_TEST_PDF_READ_FAILED');
    const rendered = await renderPdfBookPage(root, pdf.id, pdf.revision, 1);
    if (rendered.bytes.length === 0 || rendered.width < 1 || rendered.height < 1) {
      throw new Error('STUDYFORGE_SELF_TEST_PDF_RENDER_FAILED');
    }

    if (registerStudyForgeBunRuntime().bedrock !== 'registered') {
      throw new Error('STUDYFORGE_SELF_TEST_BEDROCK_MISSING');
    }
    return {
      planSubagent: 'passed',
      subagentChildRuntime: 'passed',
      pdfImport: 'passed',
      bedrock: 'passed',
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
