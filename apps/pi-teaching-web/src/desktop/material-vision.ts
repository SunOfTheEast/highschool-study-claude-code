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
import { loadMaterialVisionPrompt } from './material-vision-prompt';

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

function exactImageModel(
  models: readonly Model<Api>[],
  selection: DesktopModelSelection,
): Model<Api> | null {
  const model = models.find((candidate) => (
    candidate.provider === selection.provider && candidate.id === selection.model
  ));
  return model?.input.includes('image') ? model : null;
}

function selectedModel(
  models: readonly Model<Api>[],
  teacher: DesktopModelSelection,
  vision: DesktopVisionSelection,
): { model: Model<Api>; selection: DesktopModelSelection } {
  if (vision.mode === 'model') {
    const model = exactImageModel(models, vision.selection);
    if (!model) throw new Error('MATERIAL_VISION_UNAVAILABLE');
    return { model, selection: vision.selection };
  }

  if (teacher.provider === 'openai-codex') {
    const lunaSelection: DesktopModelSelection = {
      provider: 'openai-codex',
      model: 'gpt-5.6-luna',
      thinking: 'low',
    };
    const luna = exactImageModel(models, lunaSelection);
    if (luna) return { model: luna, selection: lunaSelection };
  }

  const model = exactImageModel(models, teacher);
  if (!model) throw new Error('MATERIAL_VISION_UNAVAILABLE');
  return { model, selection: teacher };
}

export class MaterialVisionService {
  constructor(
    private readonly runtime: VisionRuntime,
    private readonly systemPrompt = loadMaterialVisionPrompt(),
  ) {}

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
      systemPrompt: this.systemPrompt,
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
