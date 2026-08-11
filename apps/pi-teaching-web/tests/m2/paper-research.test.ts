import { expect, test } from 'bun:test';
import type { AssistantMessage, Context } from '@earendil-works/pi-ai';
import { Check } from 'typebox/value';
import {
  searchSemanticScholar,
  type SemanticScholarFetch,
} from '../../src/research/semantic-scholar';
import {
  createPaperResearchResponder,
  type PaperResearchCompletion,
} from '../../src/runtime/paper-research-runner';
import { createPaperResearchTool } from '../../src/runtime/paper-research-tools';
import {
  modelToolsForFreeLearning,
  modelToolsForNode,
} from '../../src/runtime/session-scope';

function message(text: string, stopReason: AssistantMessage['stopReason'] = 'stop'):
AssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: 'openai-codex-responses',
    provider: 'openai-codex',
    model: 'gpt-5.6-terra',
    usage: {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 15,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: Date.now(),
  };
}

test('queries one bounded Semantic Scholar relevance slice', async () => {
  let requested = '';
  const fetcher: SemanticScholarFetch = async (input) => {
    requested = String(input);
    return Response.json({
      data: Array.from({ length: 9 }, (_, index) => ({
        paperId: `paper-${index + 1}`,
        title: `Paper ${index + 1}`,
        year: 2020 + index,
        authors: [{ name: 'A' }, { name: 'B' }],
        abstract: `Finding ${index + 1}`,
        url: `https://www.semanticscholar.org/paper/paper-${index + 1}`,
      })),
    });
  };

  const papers = await searchSemanticScholar('hyperbolic cosine teaching', {
    fetch: fetcher,
    limit: 6,
  });

  expect(papers).toHaveLength(6);
  expect(papers[0]).toEqual({
    paperId: 'paper-1',
    title: 'Paper 1',
    year: 2020,
    authors: ['A', 'B'],
    abstract: 'Finding 1',
    url: 'https://www.semanticscholar.org/paper/paper-1',
  });
  expect(requested).toContain('/paper/search?');
  expect(requested).toContain('query=hyperbolic+cosine+teaching');
  expect(requested).toContain('limit=6');
  expect(requested).toContain('fields=');
});

test('degrades rate limits, malformed payloads, and empty searches to no papers', async () => {
  const cases: SemanticScholarFetch[] = [
    async () => new Response('rate limited', { status: 429 }),
    async () => Response.json({ data: 'wrong' }),
    async () => Response.json({ data: [] }),
    async () => { throw new Error('offline'); },
  ];

  for (const fetcher of cases) {
    expect(await searchSemanticScholar('query', { fetch: fetcher })).toEqual([]);
  }
});

test('binds Scout selections back to real search metadata', async () => {
  const contexts: Context[] = [];
  const complete: PaperResearchCompletion = async (context) => {
    contexts.push(context);
    return message(JSON.stringify({
      bridges: [{
        paperId: 'paper-1',
        supportedFinding: '摘要支持的发现。',
        relevance: '它能连接学生当前的问题。',
        limitation: '只有摘要。',
      }, {
        paperId: 'invented-paper',
        supportedFinding: '伪造发现。',
        relevance: '伪造连接。',
        limitation: null,
      }],
    }));
  };
  const phases: string[] = [];
  const respond = createPaperResearchResponder({
    complete,
    thinking: 'high',
    systemPrompt: 'FIXED_PAPER_SCOUT',
    search: async () => [{
      paperId: 'paper-1',
      title: 'A real paper',
      year: 2024,
      authors: ['Author'],
      abstract: 'Abstract evidence.',
      url: 'https://example.org/paper-1',
    }],
  });

  const result = await respond({
    anchor: 'e^x + e^-x',
    bridgeQuestion: '它和双曲函数有什么联系？',
    studentLevel: '高中数学，刚学导数',
  }, undefined, (phase) => phases.push(phase));

  expect(result).toEqual({
    status: 'done',
    bridges: [{
      title: 'A real paper',
      year: 2024,
      authors: ['Author'],
      url: 'https://example.org/paper-1',
      supportedFinding: '摘要支持的发现。',
      relevance: '它能连接学生当前的问题。',
      limitation: '只有摘要。',
    }],
  });
  expect(phases).toEqual(['searching', 'checking']);
  expect(contexts[0]?.systemPrompt).toBe('FIXED_PAPER_SCOUT');
  expect(contexts[0]?.tools).toBeUndefined();
  expect(JSON.stringify(contexts[0])).not.toContain('/private/');
  expect(JSON.stringify(result)).not.toContain('invented-paper');
});

test('returns an ordinary unavailable result when search or Scout cannot help', async () => {
  for (const respond of [
    createPaperResearchResponder({
      complete: async () => message('{"bridges":[]}'),
      thinking: 'off',
      systemPrompt: 'SCOUT',
      search: async () => [],
    }),
    createPaperResearchResponder({
      complete: async () => message('not-json'),
      thinking: 'off',
      systemPrompt: 'SCOUT',
      search: async () => [{
        paperId: 'paper-1', title: 'One', year: null, authors: [], abstract: null,
        url: 'https://example.org/one',
      }],
    }),
  ]) {
    expect(await respond({
      anchor: 'anchor', bridgeQuestion: 'question', studentLevel: '高中',
    })).toEqual({ status: 'unavailable', bridges: [] });
  }
});

test('keeps paper research scoped and its schema free of runtime authority', async () => {
  const tool = createPaperResearchTool(async () => ({ status: 'done', bridges: [] }));
  const input = {
    anchor: '指数函数的对称组合',
    bridgeQuestion: '它为什么自然引出双曲函数？',
    studentLevel: '高中数学',
  };

  expect(Check(tool.parameters, input)).toBeTrue();
  for (const extra of [
    { path: '/private/tmp' },
    { sessionId: 'free-1' },
    { memory: '学生画像' },
    { write: true },
  ]) {
    expect(Check(tool.parameters, { ...input, ...extra })).toBeFalse();
  }
  expect(modelToolsForFreeLearning(true, false, false)).not.toContain('paper_research');
  expect(modelToolsForFreeLearning(true, false, true)).toContain('paper_research');
  expect(modelToolsForNode('lesson', true, true)).toContain('paper_research');
  expect(modelToolsForNode('plan', true, true)).not.toContain('paper_research');
  expect(modelToolsForNode('roadmap', true, true)).not.toContain('paper_research');
});
