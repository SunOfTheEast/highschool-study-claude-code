import CSSMatrix from '@thednp/dommatrix';

type PdfJs = typeof import('pdfjs-dist');

export async function loadPdfJs(): Promise<PdfJs> {
  globalThis.DOMMatrix ??= CSSMatrix as unknown as typeof globalThis.DOMMatrix;
  await import('pdfjs-dist/build/pdf.worker.mjs');
  return import('pdfjs-dist/build/pdf.mjs') as Promise<PdfJs>;
}
