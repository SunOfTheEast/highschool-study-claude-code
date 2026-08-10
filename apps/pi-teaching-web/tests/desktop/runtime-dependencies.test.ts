import { expect, test } from 'bun:test';
import { registerStudyForgeBunRuntime } from '../../src/runtime/bun-runtime';
import { loadPdfJs } from '../../src/study/pdf-runtime';

test('registers the statically bundled Bedrock implementation for Bun entrypoints', () => {
  expect(registerStudyForgeBunRuntime()).toEqual({ bedrock: 'registered' });
});

test('loads PDF.js with a pure JavaScript DOMMatrix and worker implementation', async () => {
  const pdf = await loadPdfJs();
  const runtime = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  expect(typeof pdf.getDocument).toBe('function');
  expect(typeof runtime.DOMMatrix).toBe('function');
  expect(runtime.pdfjsWorker?.WorkerMessageHandler).toBeDefined();
});
