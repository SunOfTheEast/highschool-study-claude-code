import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const activePublicDocs = [
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'docs/architecture/m0-runtime.zh-CN.md',
  'docs/guides/agent-assisted-setup.zh-CN.md',
  'docs/guides/learning-set.zh-CN.md',
];

const privateLearningSetCommand =
  'STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run start:demo';
const privateLearningSetDoctorCommand =
  'STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run doctor';

const semanticUnits = (content: string) =>
  content
    .split(/\n\s*\n/)
    .map((unit) => unit.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const expectPublicDefaultStarter = (content: string) => {
  const starterUnit = semanticUnits(content).find((unit) =>
    unit.includes('math-starter-m0'),
  );
  expect(starterUnit).toBeDefined();
  expect(starterUnit!).toMatch(/(?:public|公开)/i);
  expect(starterUnit!).toMatch(/(?:default|默认)/i);
};

const expectIndependentOptionalSlices = (content: string) => {
  const units = semanticUnits(content);
  for (const slice of ['graph/', 'cards/', 'materials/']) {
    expect(
      units.some((unit) => unit.includes(slice) && /(?:optional|可选)/i.test(unit)),
    ).toBe(true);
  }
  expect(
    units.some(
      (unit) =>
        /(?:independent|彼此独立)/i.test(unit) &&
        (['graph/', 'cards/', 'materials/'].every((slice) => unit.includes(slice)) ||
          /(?:three|三个|三者)[^\n.。]*(?:slices|切片)/i.test(unit)),
    ),
  ).toBe(true);
  expect(content).not.toMatch(
    /(?:graph\/|cards\/|materials\/)[^\n.。]*(?:required|必需|必须存在)/i,
  );
};

const expectPresentInvalidFails = (content: string) => {
  expect(content).toMatch(
    /(?:present[\s-]*invalid[^.。\n]*(?:fail|error)|(?:存在|已存在|一旦存在)[^.。\n]*(?:无效|格式错误)[^.。\n]*(?:失败|报错))/i,
  );
};

test('ships the required public product and governance documents', () => {
  for (const path of [
    'README.md',
    'README.en.md',
    'AGENTS.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'docs/architecture/m0-runtime.zh-CN.md',
    'docs/guides/agent-assisted-setup.zh-CN.md',
    'docs/guides/learning-set.zh-CN.md',
    'docs/vision/cognitive-outcome-agent.zh-CN.md',
  ]) {
    expect(read(path).trim().length).toBeGreaterThan(100);
  }
});

test('describes the current runtime and protects the beta-card license boundary', () => {
  const active = [read('README.md'), read('README.en.md'), read('AGENTS.md')].join('\n');
  expect(active).toContain('Roadmap');
  expect(active).toContain('Plan-local');
  expect(active).toContain('Material Scout');
  expect(active).toContain('Lesson Reviewer');
  expect(active).toContain('bun run doctor');
  expect(active).not.toContain('apps/pi-teaching-web');
  expect(active).not.toContain('/Users/');
  expect(read('THIRD_PARTY_NOTICES.md')).toContain('not licensed under Apache-2.0');
  expect(read('examples/derivative-m0/README.md')).toContain(
    'private beta evaluation corpus',
  );
});

test('ships a public cardless math starter under CC BY 4.0', () => {
  for (const path of [
    'examples/math-starter-m0/README.md',
    'examples/math-starter-m0/LICENSE',
    'examples/math-starter-m0/learning-set/LEARNING_GUIDE.md',
    'examples/math-starter-m0/learning-set/ROADMAP.md',
  ]) {
    expect(existsSync(join(root, path))).toBe(true);
  }

  const starterReadme = read('examples/math-starter-m0/README.md');
  expect(starterReadme).toContain('CC BY 4.0');
  expect(starterReadme).toContain('no preloaded graph, cards, or materials');
});

test('private derivative docs require explicit opt-in and preserve the license boundary', () => {
  const derivativeReadme = read('examples/derivative-m0/README.md');

  expectPublicDefaultStarter(derivativeReadme);
  expect(derivativeReadme).toContain(privateLearningSetDoctorCommand);
  expect(derivativeReadme).toContain(privateLearningSetCommand);
  expect(derivativeReadme).not.toMatch(
    /(?:默认学习集是|derivative-m0[^.\n]{0,80}(?:is|as) the default|default learning set[^.\n]{0,80}derivative-m0)/i,
  );
  expect(derivativeReadme).toContain('not licensed under Apache-2.0');
  expect(derivativeReadme).toContain('not approved for public redistribution');
});

test('every active public doc identifies the public default and complete opt-in contract', () => {
  for (const path of activePublicDocs) {
    const content = read(path);
    expectPublicDefaultStarter(content);
    expectIndependentOptionalSlices(content);
    expect(content).toContain(privateLearningSetCommand);
  }
});

test('README pair describes acceleration, course-model independence, and invalid assets', () => {
  for (const path of ['README.md', 'README.en.md']) {
    const content = read(path);
    const assetContract = semanticUnits(content).find(
      (unit) =>
        /(?:静态资产|static assets)/i.test(unit) && /(?:加速|accelerat)/i.test(unit),
    );
    expect(assetContract).toBeDefined();
    expect(assetContract!).toMatch(/(?:不是课程模型|not the course model)/i);
    expectPresentInvalidFails(content);
  }
});

test('AGENTS defines the minimum writable set and present-only strict parsing', () => {
  const agentContract = read('AGENTS.md');
  expect(agentContract).toMatch(/LEARNING_GUIDE\.md[\s\S]*ROADMAP\.md/);
  expect(agentContract).toMatch(
    /minimum Learning Set is a writable root containing exactly the two required/i,
  );
  expect(agentContract).toMatch(
    /every static asset that is present passed[\s\n]+strict parsing/i,
  );
  expect(agentContract).toMatch(/missing or empty optional slices are valid/i);
  expectPresentInvalidFails(agentContract);
});

test('architecture marks optional directories and decouples course state from Knowledge', () => {
  const architecture = read('docs/architecture/m0-runtime.zh-CN.md');
  for (const path of ['plans/<plan-id>/?', 'graph/?', 'cards/?', 'materials/?']) {
    expect(architecture).toContain(path);
  }
  expect(architecture).toMatch(
    /Course、Session 与 Lesson[^。\n]*不依赖 Knowledge 内容/,
  );
  expectPresentInvalidFails(architecture);
});

test('setup guide presents public default before separate private and custom choices', () => {
  const setup = read('docs/guides/agent-assisted-setup.zh-CN.md');
  const firstDemoCommand = setup.indexOf('bun run start:demo');
  const publicDefault = setup.indexOf('examples/math-starter-m0/learning-set');
  const privateChoice = setup.indexOf(privateLearningSetCommand);
  const customChoice = setup.indexOf('STUDY_LEARNING_SET=/absolute/path/to/learning-set');

  expect(firstDemoCommand).toBeGreaterThanOrEqual(0);
  expect(publicDefault).toBeGreaterThan(firstDemoCommand);
  expect(privateChoice).toBeGreaterThan(publicDefault);
  expect(customChoice).toBeGreaterThan(privateChoice);
  expect(setup).toMatch(/## 私有 beta 明确选择/);
  expect(setup).toMatch(/## 自定义 Learning Set/);
  expectPresentInvalidFails(setup);
});

test('Learning Set guide keeps the minimum tree minimal and defines slice outcomes', () => {
  const learningSetGuide = read('docs/guides/learning-set.zh-CN.md');
  const minimumTree = learningSetGuide.match(
    /## 最小目录\s+```text\n([\s\S]*?)```/,
  )?.[1];

  expect(minimumTree).toBeDefined();
  expect(minimumTree!).toContain('LEARNING_GUIDE.md');
  expect(minimumTree!).toContain('ROADMAP.md');
  expect(minimumTree!).not.toMatch(/plans\/|graph\/|cards\/|materials\//);
  expect(learningSetGuide).toMatch(/Plan[^。\n]*(?:之后|随后|需要时)[^。\n]*创建/i);
  expect(learningSetGuide).toMatch(/缺失时返回空切片[^。\n]*目录为空时也返回空切片/);
  expectPresentInvalidFails(learningSetGuide);
  expect(learningSetGuide).toMatch(/Knowledge[^。\n]*(?:稳定|不变)[^。\n]*空状态/);
});

const markdownFiles = [
  ...activePublicDocs,
  'docs/vision/cognitive-outcome-agent.zh-CN.md',
];

test('keeps active local Markdown links resolvable', () => {
  for (const file of markdownFiles) {
    const content = read(file).replace(/```[\s\S]*?```/g, '');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.split('#', 1)[0]!;
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      expect(existsSync(resolve(root, dirname(file), decodeURIComponent(target)))).toBe(true);
    }
  }
});
