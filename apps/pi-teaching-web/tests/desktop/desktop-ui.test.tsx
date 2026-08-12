import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiagnosticPage } from '../../src/client/desktop/DiagnosticPage';
import { FirstRun } from '../../src/client/desktop/FirstRun';
import { HelpPage } from '../../src/client/desktop/HelpPage';
import {
  defaultModelDraft,
  ModelSettings,
  type DesktopModelCatalog,
} from '../../src/client/desktop/ModelSettings';
import {
  applyReadingSize,
  readStoredReadingSize,
} from '../../src/client/readability';

const catalog: DesktopModelCatalog = {
  providers: [{
    id: 'openai-codex',
    name: 'OpenAI Codex',
    configured: true,
    authLabel: 'OAuth',
    loginMethods: [{ type: 'oauth', label: '使用 ChatGPT 登录' }],
  }],
  models: [
    {
      provider: 'openai-codex', id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol',
      thinkingLevels: ['off', 'medium', 'high'],
      input: ['text', 'image'],
    },
    {
      provider: 'openai-codex', id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra',
      thinkingLevels: ['off', 'medium', 'high'],
      input: ['text'],
    },
  ],
};

test('gives book import one dominant action and keeps the other entrances quiet', () => {
  const markup = renderToStaticMarkup(
    <FirstRun
      busy={false}
      error={null}
      onBook={async () => {}}
      onBlank={async () => {}}
      onExisting={async () => {}}
      onExample={async () => {}}
    />,
  );

  expect(markup.match(/desktop-primary/g)).toHaveLength(1);
  expect(markup).toContain('选择 PDF');
  expect(markup).toContain('从空白开始');
  expect(markup).toContain('打开已有学习集');
  expect(markup).toContain('使用导数示例');
  expect(markup).toContain('学习文件保存在本机');
  expect(markup).toContain('相关内容会交给你选择的模型服务处理');
  expect(markup).toContain('不会无条件上传整个学习集');
  expect(markup).not.toContain('Roadmap');
});

test('uses exact StudyForge defaults but never substitutes an unavailable model', () => {
  expect(defaultModelDraft(catalog, null, null)).toEqual({
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
    vision: { mode: 'auto' },
  });
  expect(defaultModelDraft({
    providers: catalog.providers,
    models: [{
      provider: 'anthropic', id: 'claude-sonnet', name: 'Claude Sonnet',
      thinkingLevels: ['off', 'high'],
      input: ['text'],
    }],
  }, null, null)).toEqual({ teacher: null, scout: null, vision: { mode: 'auto' } });
});

test('renders model choice as a ledger with independent teacher and Scout rows', () => {
  const markup = renderToStaticMarkup(
    <ModelSettings
      catalog={catalog}
      teacher={null}
      scout={null}
      authFlow={null}
      busy={false}
      error={null}
      onLogin={async () => {}}
      onRespond={async () => {}}
      onOpenUrl={async () => {}}
      onSave={async () => {}}
      onBack={null}
    />,
  );

  expect(markup).toContain('主教师');
  expect(markup).toContain('检索 Scout');
  expect(markup).toContain('资料视觉读取');
  expect(markup).toContain('自动选择低成本视觉模型');
  expect(markup).toContain('GPT OAuth 自动优先 Luna');
  expect(markup).not.toContain('自动使用支持图片的主教师');
  expect(markup).toContain('GPT-5.6 Sol');
  expect(markup).toContain('GPT-5.6 Terra');
  expect(markup).not.toContain('模型卡片');
  expect(markup).toContain('阅读字号');
  expect(markup).toContain('标准');
  expect(markup).toContain('大字');
});

test('stores reading size locally and applies it through one root data attribute', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const root = { dataset: {} as Record<string, string> };

  expect(readStoredReadingSize(storage)).toBe('standard');
  applyReadingSize('large', storage, root);
  expect(readStoredReadingSize(storage)).toBe('large');
  expect(root.dataset.readingSize).toBe('large');
});

test('puts the current teaching pair first and folds away unconfigured Providers', () => {
  const expanded: DesktopModelCatalog = {
    providers: [
      ...catalog.providers,
      {
        id: 'anthropic', name: 'Anthropic', configured: true, authLabel: 'API Key',
        loginMethods: [{ type: 'api_key', label: '配置 API Key' }],
      },
      {
        id: 'google', name: 'Google', configured: false, authLabel: null,
        loginMethods: [{ type: 'api_key', label: '配置 API Key' }],
      },
      {
        id: 'openrouter', name: 'OpenRouter', configured: false, authLabel: null,
        loginMethods: [{ type: 'api_key', label: '配置 API Key' }],
      },
      {
        id: 'xiaomi', name: 'Xiaomi', configured: false, authLabel: null,
        loginMethods: [{ type: 'api_key', label: '配置 API Key' }],
      },
    ],
    models: [
      ...catalog.models,
      { provider: 'anthropic', id: 'claude-sonnet', name: 'Claude Sonnet', thinkingLevels: ['high'], input: ['text'] },
      { provider: 'google', id: 'gemini-pro', name: 'Gemini Pro', thinkingLevels: ['high'], input: ['text', 'image'] },
      { provider: 'openrouter', id: 'route-model', name: 'Route Model', thinkingLevels: ['high'], input: ['text'] },
    ],
  };
  const markup = renderToStaticMarkup(
    <ModelSettings
      catalog={expanded}
      teacher={{ provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' }}
      scout={{ provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' }}
      authFlow={null}
      busy={false}
      error={null}
      onLogin={async () => {}}
      onRespond={async () => {}}
      onOpenUrl={async () => {}}
      onSave={async () => {}}
      onBack={() => {}}
    />,
  );

  expect(markup).toContain('当前安排');
  expect(markup).toContain('GPT-5.6 Sol · high');
  expect(markup).toContain('GPT-5.6 Terra · high');
  expect(markup).toContain('<details class="desktop-provider-more">');
  expect(markup).toContain('连接其他 Provider · 2');
  expect(markup.indexOf('Anthropic')).toBeLessThan(markup.indexOf('连接其他 Provider · 2'));
  expect(markup.indexOf('连接其他 Provider · 2')).toBeLessThan(markup.indexOf('Google'));
  expect(markup).toContain('OpenRouter');
  expect(markup).toContain('阿夏的声音');
  expect(markup).toContain('连接 MiMo API');
  expect(markup).toContain('本人授权录音');
  expect(markup).toContain('随每次合成发送给 MiMo');
  expect(markup).not.toContain('连接其他 Provider · 3');
});

test('keeps diagnosis typed and offers recovery rather than a blank classroom', () => {
  const markup = renderToStaticMarkup(
    <DiagnosticPage
      issue={{ code: 'MODEL_UNAVAILABLE', detail: 'openai-codex/gpt-5.6-sol' }}
      onRetry={() => {}}
      onSelectLearningSet={() => {}}
      onOpenModels={() => {}}
    />,
  );
  expect(markup).toContain('模型暂时不可用');
  expect(markup).toContain('重新选择模型');
  expect(markup).not.toContain('启动失败</h1>');
  expect(markup).not.toContain('MODEL_UNAVAILABLE');
  expect(markup).not.toContain('openai-codex/gpt-5.6-sol');
});

test('renders packaged help images from the offline document payload', () => {
  const markup = renderToStaticMarkup(
    <HelpPage
      documents={[{
        id: 'first-learning',
        title: '第一次学习',
        markdown: '![开始学习](data:image/png;base64,AAAA)',
      }]}
      onBack={() => {}}
    />,
  );

  expect(markup).toContain('src="data:image/png;base64,AAAA"');
});

test('explains a missing skin and only offers showing the companion after installation', () => {
  const missing = renderToStaticMarkup(
    <ModelSettings
      catalog={catalog}
      teacher={null}
      scout={null}
      authFlow={null}
      busy={false}
      error={null}
      onLogin={async () => {}}
      onRespond={async () => {}}
      onOpenUrl={async () => {}}
      onSave={async () => {}}
      onBack={() => {}}
      peerSkin={{ state: 'missing', coreInstalled: false }}
      onChoosePeerSkin={async () => null}
      onChooseLive2DCore={async () => null}
      onImportPeerSkin={async () => ({ state: 'installed', coreInstalled: true })}
      onShowCompanion={() => {}}
    />,
  );
  const installed = renderToStaticMarkup(
    <ModelSettings
      catalog={catalog}
      teacher={null}
      scout={null}
      authFlow={null}
      busy={false}
      error={null}
      onLogin={async () => {}}
      onRespond={async () => {}}
      onOpenUrl={async () => {}}
      onSave={async () => {}}
      onBack={() => {}}
      peerSkin={{ state: 'installed', coreInstalled: true }}
      onChoosePeerSkin={async () => null}
      onChooseLive2DCore={async () => null}
      onImportPeerSkin={async () => ({ state: 'installed', coreInstalled: true })}
      onShowCompanion={() => {}}
    />,
  );

  expect(missing).toContain('阿夏还没有皮套');
  expect(missing).toContain('导入皮套');
  expect(missing).not.toContain('显示桌宠');
  expect(installed).toContain('皮套已经装好');
  expect(installed).toContain('显示桌宠');
  expect(installed).toContain('更换皮套');
});
