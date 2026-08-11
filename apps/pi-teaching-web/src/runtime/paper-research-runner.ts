import type {
  AssistantMessage,
  Context,
  ModelsSimpleStreamOptions,
} from '@earendil-works/pi-ai';
import type { DesktopThinkingLevel } from '../desktop/contracts';
import {
  searchSemanticScholar,
  type SemanticScholarPaper,
} from '../research/semantic-scholar';

export type PaperResearchRequest = {
  anchor: string;
  bridgeQuestion: string;
  studentLevel: string;
};

export type PaperBridge = {
  title: string;
  year: number | null;
  authors: string[];
  url: string;
  supportedFinding: string | null;
  relevance: string;
  limitation: string | null;
};

export type PaperResearchResponse =
  | { status: 'done'; bridges: PaperBridge[] }
  | { status: 'unavailable'; bridges: [] };

export type PaperResearchPhase = 'searching' | 'checking';
export type PaperResearchProgress = (phase: PaperResearchPhase) => void;
export type PaperResearchResponder = (
  request: PaperResearchRequest,
  signal?: AbortSignal,
  progress?: PaperResearchProgress,
) => Promise<PaperResearchResponse>;

export type PaperResearchCompletion = (
  context: Context,
  options?: ModelsSimpleStreamOptions,
) => Promise<AssistantMessage>;

type ScoutSelection = {
  paperId: string;
  supportedFinding: string | null;
  relevance: string;
  limitation: string | null;
};

function finalText(message: AssistantMessage): string | null {
  if (message.stopReason === 'error' || message.stopReason === 'aborted') return null;
  const value = message.content
    .flatMap((block) => block.type === 'text' ? [block.text] : [])
    .join('\n')
    .trim();
  return value || null;
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function selections(message: AssistantMessage): ScoutSelection[] {
  const source = finalText(message);
  if (!source) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const bridges = (parsed as Record<string, unknown>).bridges;
  if (!Array.isArray(bridges)) return [];
  return bridges.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const paperId = optionalText(item.paperId, 200);
    const relevance = optionalText(item.relevance, 1_200);
    if (!paperId || !relevance) return [];
    return [{
      paperId,
      supportedFinding: optionalText(item.supportedFinding, 1_500),
      relevance,
      limitation: optionalText(item.limitation, 800),
    }];
  }).slice(0, 3);
}

export function createPaperResearchResponder(options: {
  complete: PaperResearchCompletion;
  thinking: DesktopThinkingLevel;
  systemPrompt: string;
  search?: (query: string, options?: { signal?: AbortSignal }) => Promise<SemanticScholarPaper[]>;
}): PaperResearchResponder {
  return async (request, signal, progress) => {
    progress?.('searching');
    const query = `${request.anchor} ${request.bridgeQuestion}`.trim();
    const papers = await (options.search ?? searchSemanticScholar)(
      query,
      signal ? { signal } : undefined,
    );
    if (papers.length === 0) return { status: 'unavailable', bridges: [] };
    progress?.('checking');
    try {
      const completionOptions: ModelsSimpleStreamOptions = {
        ...(options.thinking === 'off' ? {} : { reasoning: options.thinking }),
        ...(signal ? { signal } : {}),
      };
      const message = await options.complete({
        systemPrompt: options.systemPrompt,
        messages: [{
          role: 'user',
          content: JSON.stringify({
            request,
            papers: papers.map((paper) => ({
              paperId: paper.paperId,
              title: paper.title,
              year: paper.year,
              authors: paper.authors,
              abstract: paper.abstract,
            })),
          }),
          timestamp: Date.now(),
        }],
      }, completionOptions);
      const byId = new Map(papers.map((paper) => [paper.paperId, paper]));
      const seen = new Set<string>();
      const bridges = selections(message).flatMap((selection) => {
        if (seen.has(selection.paperId)) return [];
        const paper = byId.get(selection.paperId);
        if (!paper) return [];
        seen.add(selection.paperId);
        return [{
          title: paper.title,
          year: paper.year,
          authors: [...paper.authors],
          url: paper.url,
          supportedFinding: paper.abstract ? selection.supportedFinding : null,
          relevance: selection.relevance,
          limitation: selection.limitation,
        }];
      });
      return bridges.length > 0
        ? { status: 'done', bridges }
        : { status: 'unavailable', bridges: [] };
    } catch {
      return { status: 'unavailable', bridges: [] };
    }
  };
}
