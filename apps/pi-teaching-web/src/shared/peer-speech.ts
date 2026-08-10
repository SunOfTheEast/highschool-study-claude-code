const commands: Readonly<Record<string, string>> = {
  alpha: '阿尔法',
  beta: '贝塔',
  gamma: '伽马',
  delta: '德尔塔',
  theta: '西塔',
  lambda: '拉姆达',
  mu: '缪',
  pi: '派',
  rho: '柔',
  sigma: '西格玛',
  omega: '欧米伽',
  infty: '无穷',
  ln: '自然对数',
  log: '对数',
  sin: '正弦',
  cos: '余弦',
  tan: '正切',
  max: '最大值',
  min: '最小值',
  lim: '极限',
  cdot: '乘',
  times: '乘',
  div: '除以',
  pm: '正负',
  le: '小于等于',
  leq: '小于等于',
  ge: '大于等于',
  geq: '大于等于',
  neq: '不等于',
  approx: '约等于',
  to: '趋向',
  rightarrow: '趋向',
  leftarrow: '反向趋向',
  iff: '当且仅当',
  in: '属于',
  notin: '不属于',
  sum: '求和',
  prod: '连乘',
};

class TexSpeaker {
  private cursor = 0;
  private failed = false;

  constructor(private readonly source: string) {}

  speak(): string | null {
    const words = this.sequence(null);
    this.skipSpace();
    if (this.failed || this.cursor !== this.source.length) return null;
    const result = words.join(' ').replace(/\s+/g, ' ').trim();
    return result || null;
  }

  private sequence(stop: string | null): string[] {
    const words: string[] = [];
    while (this.cursor < this.source.length) {
      this.skipSpace();
      if (this.cursor >= this.source.length) break;
      const character = this.source[this.cursor]!;
      if (stop && character === stop) {
        this.cursor += 1;
        return words;
      }
      if (!stop && character === '}') {
        this.failed = true;
        return words;
      }
      const atom = this.atom();
      if (this.failed) return words;
      words.push(...atom);
    }
    if (stop) this.failed = true;
    return words;
  }

  private atom(): string[] {
    const character = this.source[this.cursor]!;
    if (character === '\\') return this.command();
    if (character === '{') {
      this.cursor += 1;
      return this.sequence('}');
    }
    if (character === '_' || character === '^') {
      this.cursor += 1;
      const value = this.script();
      return character === '_' ? ['下标', ...value] : [power(value.join(' '))];
    }
    if (character === "'") {
      this.cursor += 1;
      return ['撇'];
    }
    if (/\d/.test(character)) {
      const start = this.cursor;
      while (/\d|\./.test(this.source[this.cursor] ?? '')) this.cursor += 1;
      return [this.source.slice(start, this.cursor)];
    }
    if (/[A-Za-z]/.test(character)) {
      this.cursor += 1;
      return [character];
    }
    const symbol = symbols[character];
    if (symbol) {
      this.cursor += 1;
      return symbol ? [symbol] : [];
    }
    this.failed = true;
    return [];
  }

  private command(): string[] {
    this.cursor += 1;
    const start = this.cursor;
    while (/[A-Za-z]/.test(this.source[this.cursor] ?? '')) this.cursor += 1;
    const name = this.source.slice(start, this.cursor);
    if (!name) {
      const escaped = this.source[this.cursor];
      if (escaped && '{}_#$%&'.includes(escaped)) {
        this.cursor += 1;
        return [escaped];
      }
      this.failed = true;
      return [];
    }
    if (name === 'left' || name === 'right') return [];
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const numerator = this.requiredGroup();
      const denominator = this.requiredGroup();
      if (this.failed) return [];
      return [...denominator, '分之', ...numerator];
    }
    if (name === 'sqrt') {
      const value = this.requiredGroup();
      return this.failed ? [] : ['根号', ...value];
    }
    if (name === 'mathrm' || name === 'mathbf' || name === 'text' || name === 'operatorname') {
      return this.requiredGroup();
    }
    const word = commands[name];
    if (!word) {
      this.failed = true;
      return [];
    }
    return [word];
  }

  private requiredGroup(): string[] {
    this.skipSpace();
    if (this.source[this.cursor] !== '{') {
      this.failed = true;
      return [];
    }
    this.cursor += 1;
    return this.sequence('}');
  }

  private script(): string[] {
    this.skipSpace();
    if (this.source[this.cursor] === '{') {
      this.cursor += 1;
      return this.sequence('}');
    }
    return this.atom();
  }

  private skipSpace(): void {
    while (/\s/.test(this.source[this.cursor] ?? '')) this.cursor += 1;
  }
}

const symbols: Readonly<Record<string, string>> = {
  '=': '等于',
  '>': '大于',
  '<': '小于',
  '+': '加',
  '-': '负',
  '*': '乘',
  '/': '除以',
  '(': '左括号',
  ')': '右括号',
  '[': '左方括号',
  ']': '右方括号',
  ',': '逗号',
  ':': '比',
  '|': '绝对值符号',
};

function power(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact === '2') return '的平方';
  if (compact === '3') return '的立方';
  if (compact === '负 1') return '的负一次方';
  if (compact === '负 2') return '的负二次方';
  if (compact === '负 3') return '的负三次方';
  return `的 ${compact} 次方`;
}

export function detailedFormulaSpeech(tex: string): string | null {
  const value = tex.trim()
    .replace(/^\$\$?|\$\$?$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim();
  if (!value || value.length > 2_000) return null;
  return new TexSpeaker(value).speak();
}

function mathAwareText(markdown: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < markdown.length) {
    const rest = markdown.slice(cursor);
    if (rest.startsWith('\\[')) {
      const end = markdown.indexOf('\\]', cursor + 2);
      cursor = end < 0 ? markdown.length : end + 2;
      continue;
    }
    if (rest.startsWith('$$')) {
      const end = markdown.indexOf('$$', cursor + 2);
      cursor = end < 0 ? markdown.length : end + 2;
      continue;
    }
    if (rest.startsWith('\\(')) {
      const end = markdown.indexOf('\\)', cursor + 2);
      if (end < 0) {
        cursor = markdown.length;
        continue;
      }
      const speech = detailedFormulaSpeech(markdown.slice(cursor + 2, end));
      if (speech) result += ` ${speech} `;
      cursor = end + 2;
      continue;
    }
    if (markdown[cursor] === '$' && markdown[cursor - 1] !== '\\') {
      const end = markdown.indexOf('$', cursor + 1);
      if (end < 0) {
        cursor += 1;
        continue;
      }
      const speech = detailedFormulaSpeech(markdown.slice(cursor + 1, end));
      if (speech) result += ` ${speech} `;
      cursor = end + 1;
      continue;
    }
    result += markdown[cursor];
    cursor += 1;
  }
  return result;
}

function joinChinese(value: string): string {
  let result = value;
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(/([\p{Script=Han}，。；：！？])\s+([\p{Script=Han}，。；：！？])/gu, '$1$2');
  }
  return result;
}

export function automaticPeerSpeech(markdown: string): string {
  const withoutCode = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ');
  const spoken = mathAwareText(withoutCode)
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s*/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\|/g, '，')
    .replace(/\\([#$%&_{}])/g, '$1')
    .replace(/[ \t]*\n+[ \t]*/g, '。')
    .replace(/。{2,}/g, '。')
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。；：！？])/g, '$1')
    .trim();
  return joinChinese(spoken);
}
