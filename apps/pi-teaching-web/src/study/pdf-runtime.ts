import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

export async function loadPdfJs(): Promise<PdfJs> {
  globalThis.DOMMatrix ??= DOMMatrix as unknown as typeof globalThis.DOMMatrix;
  globalThis.ImageData ??= ImageData as unknown as typeof globalThis.ImageData;
  globalThis.Path2D ??= Path2D as unknown as typeof globalThis.Path2D;
  return import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfJs>;
}

export async function openPdfPath(path: string) {
  const { getDocument, VerbosityLevel } = await loadPdfJs();
  return getDocument({
    url: pathToFileURL(path).href,
    verbosity: VerbosityLevel.ERRORS,
  }).promise;
}
