import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import type { MaterialBookIndex, MaterialBookOutlineNode } from '../../src/shared/contracts';
import { loadAppConfig } from '../../src/desktop/app-config';
import { MaterialVisionService } from '../../src/desktop/material-vision';
import { createDesktopModelService } from '../../src/desktop/model-service';
import { projectConversationEntries } from '../../src/projection/conversation';
import { createPiSessionFactory } from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import { listLearningNotes } from '../../src/study/learning-assets';
import { readMaterialBookIndex } from '../../src/study/material-book-index';
import {
  locateMaterialOutlineNode,
  readMaterialPage,
  scanMaterialVisualOutline,
  type MaterialVisionReader,
} from '../../src/study/material-page-reader';
import { importMaterial } from '../../src/study/materials';
import { bootstrapPdfBookIndex, renderPdfBookPage } from '../../src/study/pdf-book';
import { readSourceTree } from '../../src/study/source-tree';

const minimumPdfBytes = 32 * 1024 * 1024;

export function selectOffsetValidationNode(
  index: Pick<MaterialBookIndex, 'outline' | 'pageCount' | 'printedPageOffsetHint'>,
): MaterialBookOutlineNode | null {
  if (index.printedPageOffsetHint === null) return null;
  let selected: MaterialBookOutlineNode | null = null;
  let selectedPrintedPage = Number.POSITIVE_INFINITY;
  for (const node of index.outline) {
    if (node.source !== 'visual-toc') continue;
    const printedPage = Number(node.printedPage);
    const physicalPage = printedPage + index.printedPageOffsetHint;
    if (
      !Number.isSafeInteger(printedPage)
      || printedPage < 1
      || physicalPage < 1
      || physicalPage > index.pageCount
    ) continue;
    if (
      printedPage < selectedPrintedPage
      || (printedPage === selectedPrintedPage && node.level > (selected?.level ?? 0))
    ) {
      selected = node;
      selectedPrintedPage = printedPage;
    }
  }
  return selected;
}

export type SourceFirstValidationArguments = {
  pdf: string;
  output: string;
  appHome: string;
  title: string;
  page: number;
  toc: { startPage: number; endPage: number };
};

type Step = {
  name: string;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  outcome: 'passed' | 'failed';
  detail?: string;
};

function flags(argv: string[]): Map<string, string> {
  if (argv.length % 2 !== 0) throw new Error('SOURCE_FIRST_VALIDATION_ARGUMENTS_INVALID');
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]!;
    const value = argv[index + 1]!;
    if (!name.startsWith('--') || value.startsWith('--')) {
      throw new Error('SOURCE_FIRST_VALIDATION_ARGUMENTS_INVALID');
    }
    const key = name.slice(2);
    if (result.has(key)) throw new Error(`SOURCE_FIRST_VALIDATION_ARGUMENT_DUPLICATE: ${key}`);
    result.set(key, value);
  }
  return result;
}

function absoluteDirectory(value: string | undefined, code: string): string {
  if (!value || !isAbsolute(value)) throw new Error(code);
  const path = resolve(value);
  if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) {
    throw new Error(code);
  }
  return path;
}

function positive(value: string | undefined, code: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(code);
  return number;
}

export function parseSourceFirstValidationArguments(
  argv: string[],
): SourceFirstValidationArguments {
  const [command, ...rest] = argv;
  if (command !== 'run') throw new Error('SOURCE_FIRST_VALIDATION_COMMAND_INVALID');
  const parsed = flags(rest);
  const allowed = new Set(['pdf', 'output', 'app-home', 'page', 'toc-start', 'toc-end']);
  for (const key of parsed.keys()) {
    if (!allowed.has(key)) throw new Error(`SOURCE_FIRST_VALIDATION_ARGUMENT_UNSUPPORTED: ${key}`);
  }
  const rawPdf = parsed.get('pdf');
  if (!rawPdf || !isAbsolute(rawPdf)) throw new Error('SOURCE_FIRST_VALIDATION_PDF_INVALID');
  const pdf = resolve(rawPdf);
  if (
    extname(pdf).toLowerCase() !== '.pdf'
    || !existsSync(pdf)
    || lstatSync(pdf).isSymbolicLink()
    || !lstatSync(pdf).isFile()
  ) throw new Error('SOURCE_FIRST_VALIDATION_PDF_INVALID');
  if (statSync(pdf).size <= minimumPdfBytes) {
    throw new Error('SOURCE_FIRST_VALIDATION_PDF_TOO_SMALL');
  }
  const page = positive(parsed.get('page'), 'SOURCE_FIRST_VALIDATION_PAGE_INVALID');
  const startPage = positive(parsed.get('toc-start'), 'SOURCE_FIRST_VALIDATION_TOC_RANGE_INVALID');
  const endPage = positive(parsed.get('toc-end'), 'SOURCE_FIRST_VALIDATION_TOC_RANGE_INVALID');
  if (startPage > endPage || endPage - startPage + 1 > 12) {
    throw new Error('SOURCE_FIRST_VALIDATION_TOC_RANGE_INVALID');
  }
  return {
    pdf,
    output: absoluteDirectory(
      parsed.get('output'),
      'SOURCE_FIRST_VALIDATION_OUTPUT_INVALID',
    ),
    appHome: absoluteDirectory(
      parsed.get('app-home'),
      'SOURCE_FIRST_VALIDATION_APP_HOME_INVALID',
    ),
    title: basename(pdf, extname(pdf)),
    page,
    toc: { startPage, endPage },
  };
}

function factDigest(root: string): string {
  const paths = ['ROADMAP.md', 'plans', 'memory', 'activity/asset-reviews'];
  const hash = createHash('sha256');
  const visit = (path: string) => {
    if (!existsSync(path)) return;
    const metadata = lstatSync(path);
    if (metadata.isDirectory()) {
      for (const entry of readdirSync(path).sort()) visit(join(path, entry));
      return;
    }
    hash.update(path.slice(root.length));
    hash.update(readFileSync(path));
  };
  for (const path of paths) visit(join(root, path));
  return hash.digest('hex');
}

function containsAsset(nodes: ReturnType<typeof readSourceTree>, id: string): boolean {
  return nodes.books.some((book) => (
    book.chapters.some((node) => node.assets.some((asset) => asset.id === id))
    || book.unresolved.assets.some((asset) => asset.id === id)
  ));
}

async function measured<T>(steps: Step[], name: string, action: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  const started = performance.now();
  try {
    const result = await action();
    steps.push({
      name,
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - started),
      outcome: 'passed',
    });
    return result;
  } catch (error) {
    steps.push({
      name,
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - started),
      outcome: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function privateModelFiles(appHome: string, privateRoot: string) {
  const source = join(appHome, 'agent');
  const target = join(privateRoot, 'agent');
  mkdirSync(target, { recursive: true, mode: 0o700 });
  const authPath = join(source, 'auth.json');
  if (!existsSync(authPath)) throw new Error('SOURCE_FIRST_VALIDATION_AUTH_NOT_FOUND');
  copyFileSync(authPath, join(target, 'auth.json'));
  const modelsPath = join(source, 'models.json');
  if (existsSync(modelsPath)) copyFileSync(modelsPath, join(target, 'models.json'));
  return {
    agentDir: target,
    authPath: join(target, 'auth.json'),
    modelsPath: join(target, 'models.json'),
    sessionsDir: join(target, 'sessions'),
  };
}

export async function runSourceFirstValidation(
  arguments_: SourceFirstValidationArguments,
): Promise<Record<string, unknown>> {
  if (existsSync(arguments_.output)) {
    throw new Error('SOURCE_FIRST_VALIDATION_OUTPUT_EXISTS');
  }
  mkdirSync(arguments_.output, { recursive: true, mode: 0o700 });
  const learningSet = join(arguments_.output, 'learning-set');
  const resources = resolve(import.meta.dir, '../../resources');
  cpSync(join(resources, 'templates', 'blank-learning-set'), learningSet, { recursive: true });
  const privateRoot = mkdtempSync(join(tmpdir(), 'studyforge-source-first-private-'));
  const steps: Step[] = [];
  const reportPath = join(arguments_.output, 'source-first-real-model.json');
  let registry: WorkspaceRegistry | null = null;
  const report: Record<string, unknown> = {
    version: 1,
    status: 'running',
    createdAt: new Date().toISOString(),
    input: {
      title: arguments_.title,
      bytes: statSync(arguments_.pdf).size,
      sampledPage: arguments_.page,
      tocRange: arguments_.toc,
    },
    steps,
  };
  try {
    const config = loadAppConfig(join(arguments_.appHome, 'app.json'));
    if (!config.teacher || !config.scout) {
      throw new Error('SOURCE_FIRST_VALIDATION_MODELS_NOT_CONFIGURED');
    }
    const modelFiles = privateModelFiles(arguments_.appHome, privateRoot);
    const models = await createDesktopModelService({
      authPath: modelFiles.authPath,
      modelsPath: modelFiles.modelsPath,
    });
    const vision = new MaterialVisionService(models.runtime);
    report.models = {
      teacher: `${config.teacher.provider}/${config.teacher.model}`,
      teacherThinking: config.teacher.thinking,
      scout: `${config.scout.provider}/${config.scout.model}`,
      vision: config.vision.mode === 'auto'
        ? 'teacher-auto'
        : `${config.vision.selection.provider}/${config.vision.selection.model}`,
    };

    const factsBefore = factDigest(learningSet);
    const imported = await measured(steps, 'path-import-return', () => importMaterial(
      learningSet,
      {
        requestId: `source-first-real-${crypto.randomUUID()}`,
        title: arguments_.title,
        filename: basename(arguments_.pdf),
        mediaType: 'application/pdf',
        source: { kind: 'path', absolutePath: arguments_.pdf },
      },
      new Date().toISOString(),
    ));
    const index = await measured(steps, 'book-index-bootstrap', () => bootstrapPdfBookIndex(
      learningSet,
      imported.id,
      imported.revision,
      new Date().toISOString(),
    ));
    if (arguments_.page > index.pageCount || arguments_.toc.endPage > index.pageCount) {
      throw new Error('SOURCE_FIRST_VALIDATION_PAGE_OUT_OF_RANGE');
    }
    const rendered = await measured(steps, 'first-original-page-render', () => renderPdfBookPage(
      learningSet,
      imported.id,
      imported.revision,
      arguments_.page,
    ));
    writeFileSync(join(arguments_.output, `page-${arguments_.page}.png`), rendered.bytes);
    const visualReader: MaterialVisionReader = {
      read: (input) => vision.read({
          teacher: config.teacher!,
          vision: config.vision,
          ...input,
        }),
    };
    const toc = await measured(steps, 'visual-table-of-contents', () => scanMaterialVisualOutline(
      learningSet,
      imported.id,
      imported.revision,
      arguments_.toc,
      visualReader,
      new Date().toISOString(),
    ));
    const page = await measured(steps, 'scanned-page-extraction', () => readMaterialPage(
      learningSet,
      imported.id,
      imported.revision,
      arguments_.page,
      { mode: 'visual', vision: visualReader, updatedAt: new Date().toISOString() },
    ));
    if (toc.printedPageOffsetHint === null) {
      throw new Error('SOURCE_FIRST_VALIDATION_OFFSET_HINT_NOT_PROPOSED');
    }
    const outlineCandidate = selectOffsetValidationNode(toc);
    if (!outlineCandidate) throw new Error('SOURCE_FIRST_VALIDATION_OFFSET_NODE_NOT_FOUND');
    const expectedPhysicalPage = Number(outlineCandidate.printedPage) + toc.printedPageOffsetHint;
    const located = await measured(steps, 'printed-page-offset-location', () => (
      locateMaterialOutlineNode(
        learningSet,
        imported.id,
        imported.revision,
        outlineCandidate.id,
        async (physicalPage) => (await readMaterialPage(
          learningSet,
          imported.id,
          imported.revision,
          physicalPage,
          { mode: 'auto', vision: visualReader, updatedAt: new Date().toISOString() },
        )).text,
        new Date().toISOString(),
      )
    ));
    if (located.node.startPage !== expectedPhysicalPage) {
      throw new Error('SOURCE_FIRST_VALIDATION_OFFSET_NOT_RESOLVED');
    }
    const cached = await measured(steps, 'fresh-reader-cache-reuse', () => readMaterialPage(
      learningSet,
      imported.id,
      imported.revision,
      arguments_.page,
      { mode: 'auto', updatedAt: new Date().toISOString() },
    ));
    if (!cached.cached || cached.text !== page.text) {
      throw new Error('SOURCE_FIRST_VALIDATION_CACHE_NOT_REUSED');
    }
    if (factDigest(learningSet) !== factsBefore) {
      throw new Error('SOURCE_FIRST_VALIDATION_PASSIVE_FACTS_CHANGED');
    }

    process.env.STUDYFORGE_RESOURCE_ROOT = resources;
    const factory = await createPiSessionFactory(learningSet, {
      appHome: privateRoot,
      agentDir: modelFiles.agentDir,
      authPath: modelFiles.authPath,
      modelsPath: modelFiles.modelsPath,
      sessionsDir: modelFiles.sessionsDir,
      teacher: config.teacher,
      scout: config.scout,
    });
    registry = new WorkspaceRegistry(learningSet, factory);
    const locator = `page-${String(arguments_.page).padStart(4, '0')}`;
    const session = await measured(steps, 'free-learning-session-start', () => (
      registry!.createFreeLearning([{
        kind: 'material',
        id: imported.id,
        revision: imported.revision,
        locator,
      }])
    ));
    await measured(steps, 'teacher-source-explanation', () => registry!.send(
      session.sessionKey,
      '只根据我选中的这一页，先说明这一页正在建立什么方法，再挑一个图解释它为什么能把两个函数联系起来。不要枚举整本书，也不要替我建立课程。',
    ));
    await measured(steps, 'note-draft', () => registry!.send(
      session.sessionKey,
      '把刚才真正讲清楚的部分整理成一份简短 Note 草稿，保留这页原书来源。先把草稿给我看，不要直接保存。',
    ));
    await measured(steps, 'saved-asset-round-trip', () => registry!.send(
      session.sessionKey,
      '可以，保存吧。',
    ));

    const notes = listLearningNotes(learningSet);
    const saved = notes.find((note) => note.sources.some((source) => (
      source.kind === 'material'
      && source.id === imported.id
      && source.revision === imported.revision
      && source.locator === locator
    )));
    if (!saved) throw new Error('SOURCE_FIRST_VALIDATION_NOTE_NOT_SAVED');
    const savedText = saved.blocks.map((block) => (
      block.kind === 'markdown' ? block.body : `${block.prompt}\n${block.answer}`
    )).join('\n');
    if (/source-[0-9]+|material-[0-9]+|pages?-[0-9]{4}/i.test(savedText)) {
      throw new Error('SOURCE_FIRST_VALIDATION_INTERNAL_CODE_SAVED');
    }
    const sourceTree = readSourceTree(learningSet);
    if (!containsAsset(sourceTree, saved.id)) {
      throw new Error('SOURCE_FIRST_VALIDATION_SOURCE_TREE_MISSING');
    }
    const sourceChapter = sourceTree.books.flatMap((book) => book.chapters)
      .find((chapter) => chapter.assets.some((asset) => asset.id === saved.id));
    if (!sourceChapter) throw new Error('SOURCE_FIRST_VALIDATION_SOURCE_CHAPTER_MISSING');
    const visible = projectConversationEntries(
      session.sessionKey,
      await registry.readHistory(session.sessionKey),
    );
    const assistant = visible.filter((item) => item.kind === 'assistant');
    if (assistant.some((item) => (
      /material-[0-9]+|note-[0-9]+|problem-[0-9]+|pages?-[0-9]{4}|API_ERROR/i.test(item.text)
    ))) {
      throw new Error('SOURCE_FIRST_VALIDATION_INTERNAL_CODE_VISIBLE');
    }

    const persisted = readMaterialBookIndex(learningSet, imported.id, imported.revision);
    report.status = 'passed';
    report.result = {
      material: { revision: imported.revision, pageCount: index.pageCount },
      rendered: { width: rendered.width, height: rendered.height },
      scannedPage: {
        method: page.method,
        model: page.model,
        textCharacters: page.text.length,
        cachedOnFreshRead: cached.cached,
      },
      visualToc: {
        candidates: toc.outline.filter((node) => node.source === 'visual-toc').length,
        printedPageOffsetHint: toc.printedPageOffsetHint,
        printedLabels: toc.outline
          .filter((node) => node.source === 'visual-toc')
          .flatMap((node) => node.printedPage ? [node.printedPage] : [])
          .slice(0, 12),
      },
      printedPageOffset: {
        title: located.node.title,
        printedPage: located.node.printedPage,
        physicalPage: located.node.startPage,
        candidatePages: located.candidatePages,
      },
      persistedPageState: persisted?.pages[arguments_.page - 1]?.state ?? null,
      note: { id: saved.id, revision: saved.revision, sourceLocator: locator },
      sourceTreeRoundTrip: { chapter: sourceChapter.title },
      assistantTurns: assistant.length,
      assistantText: assistant.map((item) => item.text),
      savedNote: { title: saved.title, text: savedText },
      passiveFactsUnchangedBeforeSession: true,
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    report.status = 'failed';
    report.error = error instanceof Error ? error.message : String(error);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    throw error;
  } finally {
    registry?.dispose();
    rmSync(privateRoot, { recursive: true, force: true });
  }
}

export async function runSourceFirstValidationCli(argv: string[]): Promise<void> {
  const report = await runSourceFirstValidation(parseSourceFirstValidationArguments(argv));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.main) {
  try {
    await runSourceFirstValidationCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
