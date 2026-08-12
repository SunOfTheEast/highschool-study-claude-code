import { expect, test } from 'bun:test';
import type { Context, ImageContent, Model } from '@earendil-works/pi-ai';
import { MaterialVisionService } from '../../src/desktop/material-vision';

function model(id: string, input: Array<'text' | 'image'>): Model<any> {
  return {
    provider: 'test', id, name: id, api: 'openai-responses', baseUrl: 'https://example.test',
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
  expect(fake.calls[0]?.context.systemPrompt).toContain('资料页面');
  expect(JSON.stringify(fake.calls[0]?.context)).not.toContain('学生记忆');
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
