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

function displayPrefix(output: string): string {
  if (output.length === 0 || output.endsWith('\n\n')) return '';
  return output.endsWith('\n') ? '\n' : '\n\n';
}

function displaySuffix(source: string, index: number): string {
  if (index >= source.length || source.startsWith('\n\n', index)) return '';
  return source[index] === '\n' ? '\n' : '\n\n';
}

function displayMath(
  output: string,
  source: string,
  content: string,
  nextIndex: number,
): string {
  const normalized = content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  return `${output}${displayPrefix(output)}$$\n${normalized}\n$$${displaySuffix(source, nextIndex)}`;
}

export function normalizeMathDelimiters(markdown: string): string {
  let result = '';
  let cursor = 0;

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
          result = displayMath(
            result,
            markdown,
            markdown.slice(cursor + 2, end - 2),
            end,
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
        const nextIndex = end + 2;
        if (opener === '\\[') {
          result = displayMath(
            result,
            markdown,
            markdown.slice(cursor + 2, end),
            nextIndex,
          );
        } else {
          result += `$${markdown.slice(cursor + 2, end)}$`;
        }
        cursor = nextIndex;
        continue;
      }
    }

    result += markdown[cursor];
    cursor += 1;
  }

  return result;
}
