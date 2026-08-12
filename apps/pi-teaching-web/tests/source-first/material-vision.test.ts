import { expect, test } from 'bun:test';
import type { Context, ImageContent, Model } from '@earendil-works/pi-ai';
import { resolve } from 'node:path';
import { MaterialVisionService } from '../../src/desktop/material-vision';
import { loadMaterialVisionPrompt } from '../../src/desktop/material-vision-prompt';

function model(
  id: string,
  input: Array<'text' | 'image'>,
  provider = 'test',
): Model<any> {
  return {
    provider, id, name: id, api: 'openai-responses', baseUrl: 'https://example.test',
    reasoning: true, input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 100_000, maxTokens: 4_000,
  };
}

function runtime(models: Model<any>[]) {
  const calls: Array<{ model: Model<any>; context: Context; options: unknown }> = [];
  return {
    calls,
    getAvailable: async () => models,
    completeSimple: async (selected: Model<any>, context: Context, options: unknown) => {
      calls.push({ model: selected, context, options });
      return {
        role: 'assistant' as const,
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            text: '沉淀溶解平衡',
            outline: [{ title: '第一章', level: 1, printedPage: '1' }],
          }),
        }],
        api: selected.api,
        provider: selected.provider,
        model: selected.id,
        usage: {
          input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop' as const,
        timestamp: Date.now(),
      };
    },
  };
}

const image: ImageContent = { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' };

test('loads the packaged visual reader role instead of embedding a teacher prompt', () => {
  const prompt = loadMaterialVisionPrompt(resolve(import.meta.dir, '../../resources'));

  expect(prompt).toContain('只负责读取');
  expect(prompt).toContain('不承担教学');
  expect(prompt).toContain('不确定就保留未知');
  expect(prompt).toContain('只返回 JSON');
});

test('auto uses the teacher only when it accepts images and sends isolated context', async () => {
  const fake = runtime([model('teacher', ['text', 'image']), model('other', ['text', 'image'])]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'test', model: 'teacher', thinking: 'high' },
    vision: { mode: 'auto' },
    prompt: '读取这一页',
    images: [image],
  });

  expect(result).toEqual({
    text: '沉淀溶解平衡',
    outline: [{ title: '第一章', level: 1, printedPage: '1' }],
    model: 'test/teacher',
  });
  expect(fake.calls).toHaveLength(1);
  expect(fake.calls[0]?.context.messages).toEqual([{
    role: 'user',
    content: [{ type: 'text', text: '读取这一页' }, image],
    timestamp: expect.any(Number),
  }]);
  expect(fake.calls[0]?.context.tools).toBeUndefined();
  expect(fake.calls[0]?.context.systemPrompt).toBe(
    loadMaterialVisionPrompt(resolve(import.meta.dir, '../../resources')),
  );
  expect(JSON.stringify(fake.calls[0]?.context)).not.toContain('学生记忆');
});

test('GPT OAuth auto routes visual reading to Luna with low reasoning', async () => {
  const fake = runtime([
    model('gpt-5.6-sol', ['text', 'image'], 'openai-codex'),
    model('gpt-5.6-luna', ['text', 'image'], 'openai-codex'),
  ]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    vision: { mode: 'auto' }, prompt: '读取目录', images: [image],
  });

  expect(result.model).toBe('openai-codex/gpt-5.6-luna');
  expect(fake.calls[0]?.options).toMatchObject({ reasoning: 'low' });
});

test('auto never steals a non-OpenAI teacher route just because Luna exists', async () => {
  const fake = runtime([
    model('qwen-vl', ['text', 'image'], 'qwen'),
    model('gpt-5.6-luna', ['text', 'image'], 'openai-codex'),
  ]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'qwen', model: 'qwen-vl', thinking: 'medium' },
    vision: { mode: 'auto' }, prompt: '读取目录', images: [image],
  });

  expect(result.model).toBe('qwen/qwen-vl');
  expect(fake.calls[0]?.options).toMatchObject({ reasoning: 'medium' });
});

test('GPT OAuth auto falls back to the image-capable teacher when Luna is unavailable', async () => {
  const fake = runtime([model('gpt-5.6-sol', ['text', 'image'], 'openai-codex')]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    vision: { mode: 'auto' }, prompt: '读取目录', images: [image],
  });

  expect(result.model).toBe('openai-codex/gpt-5.6-sol');
  expect(fake.calls[0]?.options).toMatchObject({ reasoning: 'high' });
});

test('an explicit image model overrides the teacher and text-only auto fails closed', async () => {
  const fake = runtime([model('teacher', ['text']), model('vision', ['text', 'image'])]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'test', model: 'teacher', thinking: 'high' },
    vision: {
      mode: 'model',
      selection: { provider: 'test', model: 'vision', thinking: 'medium' },
    },
    prompt: '读取目录', images: [image],
  });
  expect(result.model).toBe('test/vision');
  expect(fake.calls[0]?.options).toMatchObject({ reasoning: 'medium' });
  await expect(service.read({
    teacher: { provider: 'test', model: 'teacher', thinking: 'high' },
    vision: { mode: 'auto' }, prompt: '读取', images: [image],
  })).rejects.toThrow('MATERIAL_VISION_UNAVAILABLE');
});

test('rejects a non-JSON response instead of treating it as extracted text', async () => {
  const fake = runtime([model('teacher', ['text', 'image'])]);
  fake.completeSimple = async () => ({ content: [{ type: 'text', text: '大概是第一章' }] }) as never;
  const service = new MaterialVisionService(fake as never);
  await expect(service.read({
    teacher: { provider: 'test', model: 'teacher', thinking: 'high' },
    vision: { mode: 'auto' }, prompt: '读取', images: [image],
  })).rejects.toThrow('MATERIAL_VISION_RESPONSE_INVALID');
});

test('normalizes an empty printed page from visual reading to unknown', async () => {
  const fake = runtime([model('teacher', ['text', 'image'])]);
  fake.completeSimple = async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        text: '目录',
        outline: [{ title: '第一章', level: 1, printedPage: '   ' }],
      }),
    }],
  }) as never;
  const service = new MaterialVisionService(fake as never);
  expect(await service.read({
    teacher: { provider: 'test', model: 'teacher', thinking: 'high' },
    vision: { mode: 'auto' }, prompt: '读取', images: [image],
  })).toMatchObject({
    outline: [{ title: '第一章', level: 1, printedPage: null }],
  });
});

test('accepts a model-proposed printed-to-physical page offset as a hint', async () => {
  const fake = runtime([model('teacher', ['text', 'image'])]);
  fake.completeSimple = async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({ text: '目录', outline: [], printedPageOffset: 15 }),
    }],
  }) as never;
  const service = new MaterialVisionService(fake as never);
  expect(await service.read({
    teacher: { provider: 'test', model: 'teacher', thinking: 'high' },
    vision: { mode: 'auto' }, prompt: '读取完整目录', images: [image],
  })).toMatchObject({ printedPageOffset: 15 });
});
