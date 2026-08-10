import { expect, test } from 'bun:test';
import {
  automaticPeerSpeech,
  detailedFormulaSpeech,
} from '../../src/shared/peer-speech';

test('turns prose and safe inline math into compact speech without reading display TeX', () => {
  const spoken = automaticPeerSpeech(`
## 先看结论

- 比较 **反应商** $Q_p$ 与 $K_p$；详情见 [这份笔记](https://example.test/private)。
- 所有分压都变成原来的 $\\alpha$ 倍。

\\[
Q'_p=\\alpha^{-2}Q_p>K_p
\\]

| 条件 | 结果 |
| --- | --- |
| 恒容 | 不移动 |
`);

  expect(spoken).toContain('先看结论');
  expect(spoken).toContain('比较反应商 Q 下标 p 与 K 下标 p');
  expect(spoken).toContain('所有分压都变成原来的阿尔法倍');
  expect(spoken).toContain('恒容');
  expect(spoken).toContain('不移动');
  expect(spoken).not.toContain('example.test');
  expect(spoken).not.toContain("Q'_p");
  expect(spoken).not.toContain('\\alpha');
  expect(spoken).not.toMatch(/[$|*_#`]/);
});

test('reads the bounded high-school formula structures deterministically', () => {
  expect(detailedFormulaSpeech("Q'_p=\\alpha^{-2}Q_p>K_p")).toBe(
    'Q 撇 下标 p 等于 阿尔法 的负二次方 Q 下标 p 大于 K 下标 p',
  );
  expect(detailedFormulaSpeech('\\frac{1}{2e}')).toBe('2 e 分之 1');
  expect(detailedFormulaSpeech('p_{NH_3}\\leq K_p')).toBe(
    'p 下标 N H 下标 3 小于等于 K 下标 p',
  );
  expect(detailedFormulaSpeech('\\sqrt{x^2+1}')).toBe('根号 x 的平方 加 1');
});

test('fails closed instead of speaking malformed or unsupported TeX', () => {
  expect(detailedFormulaSpeech('\\frac{1}{')).toBeNull();
  expect(detailedFormulaSpeech('\\begin{matrix}1&2\\end{matrix}')).toBeNull();
  expect(automaticPeerSpeech('只有公式：\\[\\begin{matrix}1&2\\end{matrix}\\]')).toBe('只有公式：');
});
