import { Canvas, createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

type NapiCanvasAndContext = {
  canvas: Canvas | null;
  context: unknown | null;
};

class NapiCanvasFactory {
  create(width: number, height: number): NapiCanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error('PDF_CANVAS_SIZE_INVALID');
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(target: NapiCanvasAndContext, width: number, height: number): void {
    if (!target.canvas) throw new Error('PDF_CANVAS_MISSING');
    target.canvas.width = width;
    target.canvas.height = height;
  }

  destroy(target: NapiCanvasAndContext): void {
    if (target.canvas) {
      target.canvas.width = 0;
      target.canvas.height = 0;
    }
    target.canvas = null;
    target.context = null;
  }
}

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
    CanvasFactory: NapiCanvasFactory,
    verbosity: VerbosityLevel.ERRORS,
  }).promise;
}
