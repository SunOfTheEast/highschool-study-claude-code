export type MathToken = {
  marker: string;
  value: string;
  display: boolean;
};

export type PreparedMathMarkdown = {
  markdown: string;
  tokens: readonly MathToken[];
};

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

const displayTokenType = 'studyforgeDisplayMath';
const phrasingContainerTypes = new Set(['heading', 'tableCell']);

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function runLength(source: string, index: number, value: string): number {
  let length = 0;
  while (source[index + length] === value) length += 1;
  return length;
}

function inlineCodeEnd(source: string, index: number, length: number): number {
  let cursor = index + length;
  while (cursor < source.length) {
    if (source[cursor] !== '`') {
      cursor += 1;
      continue;
    }
    const candidateLength = runLength(source, cursor, '`');
    if (candidateLength === length) return cursor + length;
    cursor += candidateLength;
  }
  return source.length;
}

function fencedCodeEnd(source: string, index: number): number | null {
  if (index > 0 && source[index - 1] !== '\n') return null;
  const openingLineEnd = source.indexOf('\n', index);
  const openingEnd = openingLineEnd === -1 ? source.length : openingLineEnd;
  const opening = /^( {0,3})(`{3,}|~{3,})/.exec(source.slice(index, openingEnd));
  if (!opening) return null;

  const marker = opening[2]!;
  let cursor = openingLineEnd === -1 ? source.length : openingLineEnd + 1;
  while (cursor < source.length) {
    const closingLineEnd = source.indexOf('\n', cursor);
    const closingEnd = closingLineEnd === -1 ? source.length : closingLineEnd;
    const line = source.slice(cursor, closingEnd);
    const indentation = /^ {0,3}/.exec(line)?.[0].length ?? 0;
    const candidate = line.slice(indentation);
    const candidateLength = runLength(candidate, 0, marker[0]!);
    if (
      candidateLength >= marker.length
      && candidate.slice(candidateLength).trim().length === 0
    ) {
      return closingLineEnd === -1 ? source.length : closingLineEnd + 1;
    }
    cursor = closingLineEnd === -1 ? source.length : closingLineEnd + 1;
  }
  return source.length;
}

function dollarMathEnd(source: string, index: number, delimiter: '$' | '$$'): number | null {
  let cursor = index + delimiter.length;
  while (cursor < source.length) {
    const candidate = source.indexOf(delimiter, cursor);
    if (candidate === -1) return null;
    if (isEscaped(source, candidate)) {
      cursor = candidate + delimiter.length;
      continue;
    }
    if (
      delimiter === '$'
      && (source[candidate - 1] === '$' || source[candidate + 1] === '$')
    ) {
      cursor = candidate + 1;
      continue;
    }
    return candidate + delimiter.length;
  }
  return null;
}

function texMathEnd(source: string, index: number, closing: '\\)' | '\\]'): number | null {
  let cursor = index + 2;
  while (cursor < source.length) {
    const candidate = source.indexOf(closing, cursor);
    if (candidate === -1) return null;
    if (!isEscaped(source, candidate)) return candidate;
    cursor = candidate + closing.length;
  }
  return null;
}

function displayContent(content: string): string {
  return content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
}

function tokenMarker(source: string, index: number): string {
  let marker = `STUDYFORGEMATHTOKEN${index}X`;
  while (source.includes(marker)) marker += 'X';
  return marker;
}

function appendToken(
  source: string,
  tokens: MathToken[],
  value: string,
  display: boolean,
): string {
  const marker = tokenMarker(source, tokens.length);
  tokens.push({ marker, value, display });
  return marker;
}

/**
 * Protect TeX delimiters from the Markdown parser without deciding their block
 * ownership in the raw string. A remark transform restores the tokens after
 * Markdown has already established list and blockquote boundaries.
 */
export function prepareMathMarkdown(markdown: string): PreparedMathMarkdown {
  let result = '';
  let cursor = 0;
  const tokens: MathToken[] = [];

  while (cursor < markdown.length) {
    const fenceEnd = fencedCodeEnd(markdown, cursor);
    if (fenceEnd !== null) {
      result += markdown.slice(cursor, fenceEnd);
      cursor = fenceEnd;
      continue;
    }

    if (markdown[cursor] === '`') {
      const length = runLength(markdown, cursor, '`');
      const end = inlineCodeEnd(markdown, cursor, length);
      result += markdown.slice(cursor, end);
      cursor = end;
      continue;
    }

    if (markdown[cursor] === '$' && !isEscaped(markdown, cursor)) {
      const delimiter = markdown[cursor + 1] === '$' ? '$$' : '$';
      const end = dollarMathEnd(markdown, cursor, delimiter);
      if (end !== null) {
        if (delimiter === '$$') {
          result += appendToken(
            markdown,
            tokens,
            displayContent(markdown.slice(cursor + 2, end - 2)),
            true,
          );
        } else {
          result += markdown.slice(cursor, end);
        }
        cursor = end;
        continue;
      }
    }

    const opener = markdown.slice(cursor, cursor + 2);
    if ((opener === '\\(' || opener === '\\[') && !isEscaped(markdown, cursor)) {
      const closing = opener === '\\(' ? '\\)' : '\\]';
      const end = texMathEnd(markdown, cursor, closing);
      if (end !== null) {
        const display = opener === '\\[';
        const value = markdown.slice(cursor + 2, end);
        result += appendToken(
          markdown,
          tokens,
          display ? displayContent(value) : value,
          display,
        );
        cursor = end + 2;
        continue;
      }
    }

    result += markdown[cursor];
    cursor += 1;
  }

  return { markdown: result, tokens };
}

function inlineMathNode(value: string): MarkdownNode {
  return {
    type: 'inlineMath',
    value,
    data: {
      hName: 'code',
      hProperties: { className: ['language-math', 'math-inline'] },
      hChildren: [{ type: 'text', value }],
    },
  };
}

function displayMathNode(value: string): MarkdownNode {
  return {
    type: 'math',
    meta: null,
    value,
    data: {
      hName: 'pre',
      hChildren: [{
        type: 'element',
        tagName: 'code',
        properties: { className: ['language-math', 'math-display'] },
        children: [{ type: 'text', value }],
      }],
    },
  };
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitTextNode(
  node: MarkdownNode,
  tokens: ReadonlyMap<string, MathToken>,
  markerPattern: RegExp,
  allowDisplay: boolean,
): MarkdownNode[] {
  const value = node.value ?? '';
  const result: MarkdownNode[] = [];
  let cursor = 0;

  markerPattern.lastIndex = 0;
  for (const match of value.matchAll(markerPattern)) {
    const marker = match[0];
    const index = match.index;
    const token = tokens.get(marker);
    if (!token) continue;
    if (index > cursor) result.push({ type: 'text', value: value.slice(cursor, index) });
    if (token.display && allowDisplay) {
      result.push({ type: displayTokenType, value: token.value });
    } else {
      const formula = token.display ? `\\displaystyle ${token.value}` : token.value;
      result.push(inlineMathNode(formula));
    }
    cursor = index + marker.length;
  }

  if (cursor === 0) return [node];
  if (cursor < value.length) result.push({ type: 'text', value: value.slice(cursor) });
  return result;
}

function expandPhrasingNode(
  node: MarkdownNode,
  tokens: ReadonlyMap<string, MathToken>,
  markerPattern: RegExp,
  allowDisplay: boolean,
): MarkdownNode[] {
  if (node.type === 'text') {
    return splitTextNode(node, tokens, markerPattern, allowDisplay);
  }
  if (node.children) {
    node.children = node.children.flatMap((child) => (
      expandPhrasingNode(child, tokens, markerPattern, false)
    ));
  }
  return [node];
}

function hasParagraphContent(children: readonly MarkdownNode[]): boolean {
  return children.some((child) => child.type !== 'text' || child.value?.trim());
}

function splitParagraph(
  paragraph: MarkdownNode,
  tokens: ReadonlyMap<string, MathToken>,
  markerPattern: RegExp,
): MarkdownNode[] {
  const expanded = (paragraph.children ?? []).flatMap((child) => (
    expandPhrasingNode(child, tokens, markerPattern, true)
  ));
  const result: MarkdownNode[] = [];
  let phrasing: MarkdownNode[] = [];

  const flush = () => {
    if (hasParagraphContent(phrasing)) {
      result.push({ ...paragraph, children: phrasing });
    }
    phrasing = [];
  };

  for (const child of expanded) {
    if (child.type !== displayTokenType) {
      phrasing.push(child);
      continue;
    }
    flush();
    result.push(displayMathNode(child.value ?? ''));
  }
  flush();
  return result;
}

function transformMathTokens(
  node: MarkdownNode,
  tokens: ReadonlyMap<string, MathToken>,
  markerPattern: RegExp,
): void {
  if (!node.children) return;
  if (phrasingContainerTypes.has(node.type)) {
    node.children = node.children.flatMap((child) => (
      expandPhrasingNode(child, tokens, markerPattern, false)
    ));
    return;
  }
  const children: MarkdownNode[] = [];

  for (const child of node.children) {
    if (child.type === 'paragraph') {
      children.push(...splitParagraph(child, tokens, markerPattern));
      continue;
    }
    transformMathTokens(child, tokens, markerPattern);
    children.push(child);
  }
  node.children = children;
}

/** Restore protected formulas after Markdown has formed its block containers. */
export function remarkPreparedMath(tokens: readonly MathToken[]) {
  return () => (tree: MarkdownNode) => {
    if (tokens.length === 0) return;
    const byMarker = new Map(tokens.map((token) => [token.marker, token]));
    const markerPattern = new RegExp(tokens.map((token) => regexEscape(token.marker)).join('|'), 'g');
    transformMathTokens(tree, byMarker, markerPattern);
  };
}
