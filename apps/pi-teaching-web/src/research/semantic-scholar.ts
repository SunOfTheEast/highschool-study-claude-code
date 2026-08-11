export type SemanticScholarPaper = {
  paperId: string;
  title: string;
  year: number | null;
  authors: string[];
  abstract: string | null;
  url: string;
};

export type SemanticScholarFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SemanticScholarSearchOptions = {
  fetch?: SemanticScholarFetch;
  limit?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const endpoint = 'https://api.semanticscholar.org/graph/v1/paper/search';
const fields = 'paperId,title,year,authors,abstract,url,openAccessPdf';

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function safeUrl(value: unknown, paperId: string): string {
  const candidate = text(value, 2_000);
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:') return parsed.toString();
    } catch {
      // Fall through to the canonical public paper page.
    }
  }
  return `https://www.semanticscholar.org/paper/${encodeURIComponent(paperId)}`;
}

function parsePaper(value: unknown): SemanticScholarPaper | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const paperId = text(source.paperId, 200);
  const title = text(source.title, 1_000);
  if (!paperId || !title) return null;
  const authors = Array.isArray(source.authors)
    ? source.authors.flatMap((author) => {
      if (!author || typeof author !== 'object' || Array.isArray(author)) return [];
      const name = text((author as Record<string, unknown>).name, 200);
      return name ? [name] : [];
    }).slice(0, 8)
    : [];
  return {
    paperId,
    title,
    year: typeof source.year === 'number' && Number.isInteger(source.year)
      ? source.year
      : null,
    authors,
    abstract: text(source.abstract, 6_000),
    url: safeUrl(source.url, paperId),
  };
}

export async function searchSemanticScholar(
  query: string,
  options: SemanticScholarSearchOptions = {},
): Promise<SemanticScholarPaper[]> {
  const normalized = query.trim();
  if (!normalized) return [];
  const limit = Math.min(6, Math.max(1, Math.floor(options.limit ?? 6)));
  const url = new URL(endpoint);
  url.searchParams.set('query', normalized);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('fields', fields);
  const timeout = AbortSignal.timeout(Math.max(250, options.timeoutMs ?? 8_000));
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  try {
    const response = await (options.fetch ?? fetch)(url, {
      headers: { accept: 'application/json' },
      signal,
    });
    if (!response.ok) return [];
    const payload = await response.json() as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const data = (payload as Record<string, unknown>).data;
    if (!Array.isArray(data)) return [];
    return data.flatMap((paper) => {
      const parsed = parsePaper(paper);
      return parsed ? [parsed] : [];
    }).slice(0, limit);
  } catch {
    return [];
  }
}
