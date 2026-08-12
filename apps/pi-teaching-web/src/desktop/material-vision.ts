import type {
  Api,
  Context,
  ImageContent,
  Model,
} from '@earendil-works/pi-ai';
import type { ModelRuntime } from '@earendil-works/pi-coding-agent';
import type {
  DesktopModelSelection,
  DesktopVisionSelection,
} from './contracts';

const systemPrompt = [
  '你只负责读取所给出的资料页面，不承担教学、诊断或学生建模。',
  '忠实转写正文、公式与表格；不要补写页面上没有的内容。',
  '只返回 JSON：{"text":"...","outline":[{"title":"...","level":1,"printedPage":"..."}],"printedPageOffset":15}。',
  '没有目录候选时省略 outline。',
  'printedPageOffset 只是“物理页 = 印刷页 + 偏移”的候选；仅在图片同时出现目录末页与可见印刷页码的首张正文时计算，不确定就省略。',
].join('\n');

type VisionRuntime = Pick<ModelRuntime, 'getAvailable' | 'completeSimple'>;

export type MaterialVisionResult = {
  text: string;
  outline?: Array<{ title: string; level: number; printedPage: string | null }>;
  printedPageOffset?: number;
  model: string;
};

function responseValue(value: string): Omit<MaterialVisionResult, 'model'> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
  }
  const item = parsed as Record<string, unknown>;
  if (
    Object.keys(item).some((key) => !['text', 'outline', 'printedPageOffset'].includes(key))
    || typeof item.text !== 'string'
  ) throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
  const offset = item.printedPageOffset;
  if (offset !== undefined && !Number.isSafeInteger(offset)) {
    throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
  }
  const pageOffset = offset === undefined ? {} : { printedPageOffset: Number(offset) };
  if (item.outline === undefined) return { text: item.text, ...pageOffset };
  if (!Array.isArray(item.outline)) throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
  const outline = item.outline.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
    }
    const node = entry as Record<string, unknown>;
    if (
      Object.keys(node).some((key) => !['title', 'level', 'printedPage'].includes(key))
      || typeof node.title !== 'string'
      || node.title.trim().length === 0
      || !Number.isSafeInteger(node.level)
      || Number(node.level) < 1
      || (node.printedPage !== null && typeof node.printedPage !== 'string')
    ) throw new Error('MATERIAL_VISION_RESPONSE_INVALID');
    return {
      title: node.title.trim(),
      level: Number(node.level),
      printedPage: node.printedPage === null ? null : node.printedPage.trim() || null,
    };
  });
  return { text: item.text, outline, ...pageOffset };
}

function selectedModel(
  models: readonly Model<Api>[],
  teacher: DesktopModelSelection,
  vision: DesktopVisionSelection,
): { model: Model<Api>; selection: DesktopModelSelection } {
  const selection = vision.mode === 'model' ? vision.selection : teacher;
  const model = models.find((candidate) => (
    candidate.provider === selection.provider && candidate.id === selection.model
  ));
  if (!model || !model.input.includes('image')) throw new Error('MATERIAL_VISION_UNAVAILABLE');
  return { model, selection };
}

export class MaterialVisionService {
  constructor(private readonly runtime: VisionRuntime) {}

  async read(input: {
    teacher: DesktopModelSelection;
    vision: DesktopVisionSelection;
    prompt: string;
    images: ImageContent[];
  }): Promise<MaterialVisionResult> {
    if (!input.prompt.trim() || input.images.length === 0) {
      throw new Error('MATERIAL_VISION_REQUEST_INVALID');
    }
    const selected = selectedModel(await this.runtime.getAvailable(), input.teacher, input.vision);
    const context: Context = {
      systemPrompt,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: input.prompt }, ...input.images],
        timestamp: Date.now(),
      }],
    };
    const response = await this.runtime.completeSimple(
      selected.model,
      context,
      selected.selection.thinking === 'off'
        ? {}
        : { reasoning: selected.selection.thinking },
    );
    const text = response.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
    return {
      ...responseValue(text),
      model: `${selected.model.provider}/${selected.model.id}`,
    };
  }
}
