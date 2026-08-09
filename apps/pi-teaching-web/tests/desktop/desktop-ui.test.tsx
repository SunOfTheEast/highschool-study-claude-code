import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiagnosticPage } from '../../src/client/desktop/DiagnosticPage';
import { FirstRun } from '../../src/client/desktop/FirstRun';
import {
  defaultModelDraft,
  ModelSettings,
  type DesktopModelCatalog,
} from '../../src/client/desktop/ModelSettings';

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
    },
    {
      provider: 'openai-codex', id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra',
      thinkingLevels: ['off', 'medium', 'high'],
    },
  ],
};

test('gives blank start one dominant action and keeps the other entrances quiet', () => {
  const markup = renderToStaticMarkup(
    <FirstRun
      busy={false}
      error={null}
      onBlank={async () => {}}
      onExisting={async () => {}}
      onExample={async () => {}}
    />,
  );

  expect(markup.match(/desktop-primary/g)).toHaveLength(1);
  expect(markup).toContain('从空白开始');
  expect(markup).toContain('打开已有学习集');
  expect(markup).toContain('使用导数示例');
  expect(markup).not.toContain('Roadmap');
});

test('uses exact StudyForge defaults but never substitutes an unavailable model', () => {
  expect(defaultModelDraft(catalog, null, null)).toEqual({
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
  });
  expect(defaultModelDraft({
    providers: catalog.providers,
    models: [{
      provider: 'anthropic', id: 'claude-sonnet', name: 'Claude Sonnet',
      thinkingLevels: ['off', 'high'],
    }],
  }, null, null)).toEqual({ teacher: null, scout: null });
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
  expect(markup).toContain('GPT-5.6 Sol');
  expect(markup).toContain('GPT-5.6 Terra');
  expect(markup).not.toContain('模型卡片');
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
});
