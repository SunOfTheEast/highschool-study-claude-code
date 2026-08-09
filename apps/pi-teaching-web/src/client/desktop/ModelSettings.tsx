import { useMemo, useState, type FormEvent } from 'react';
import type { AuthEvent, AuthPrompt, AuthType } from '@earendil-works/pi-ai';
import type {
  DesktopModelSelection,
  DesktopThinkingLevel,
} from '../../desktop/contracts';

export type DesktopModelCatalog = {
  providers: Array<{
    id: string;
    name: string;
    configured: boolean;
    authLabel: string | null;
    loginMethods: Array<{ type: AuthType; label: string }>;
  }>;
  models: Array<{
    provider: string;
    id: string;
    name: string;
    thinkingLevels: readonly DesktopThinkingLevel[];
  }>;
};

type WithoutSignal<T> = T extends unknown ? Omit<T, 'signal'> : never;

export type ModelAuthFlow = {
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  events: AuthEvent[];
  prompt: WithoutSignal<AuthPrompt> | null;
  error: string | null;
};

type ModelDraft = {
  teacher: DesktopModelSelection | null;
  scout: DesktopModelSelection | null;
};

function availableSelection(
  catalog: DesktopModelCatalog,
  value: DesktopModelSelection | null,
): DesktopModelSelection | null {
  if (!value) return null;
  const model = catalog.models.find((candidate) => (
    candidate.provider === value.provider && candidate.id === value.model
  ));
  return model?.thinkingLevels.includes(value.thinking) ? value : null;
}

function exactDefault(
  catalog: DesktopModelCatalog,
  id: 'gpt-5.6-sol' | 'gpt-5.6-terra',
): DesktopModelSelection | null {
  const model = catalog.models.find((candidate) => (
    candidate.provider === 'openai-codex'
    && candidate.id === id
    && candidate.thinkingLevels.includes('high')
  ));
  return model ? { provider: model.provider, model: model.id, thinking: 'high' } : null;
}

export function defaultModelDraft(
  catalog: DesktopModelCatalog,
  teacher: DesktopModelSelection | null,
  scout: DesktopModelSelection | null,
): ModelDraft {
  return {
    teacher: availableSelection(catalog, teacher) ?? exactDefault(catalog, 'gpt-5.6-sol'),
    scout: availableSelection(catalog, scout) ?? exactDefault(catalog, 'gpt-5.6-terra'),
  };
}

function ModelRow({
  id,
  title,
  detail,
  catalog,
  value,
  onChange,
}: {
  id: string;
  title: string;
  detail: string;
  catalog: DesktopModelCatalog;
  value: DesktopModelSelection | null;
  onChange(value: DesktopModelSelection | null): void;
}) {
  const selected = value
    ? catalog.models.find((model) => model.provider === value.provider && model.id === value.model)
    : null;
  const modelValue = value ? `${value.provider}/${value.model}` : '';
  return (
    <fieldset className="desktop-model-row">
      <legend>{title}</legend>
      <p>{detail}</p>
      <label htmlFor={`${id}-model`}>{title}模型</label>
      <select
        id={`${id}-model`}
        aria-label={id === 'scout' ? '检索 Scout 模型' : '主教师模型'}
        value={modelValue}
        onChange={(event) => {
          const model = catalog.models.find((candidate) => (
            `${candidate.provider}/${candidate.id}` === event.target.value
          ));
          if (!model) {
            onChange(null);
            return;
          }
          const thinking = model.thinkingLevels.includes('high')
            ? 'high'
            : model.thinkingLevels[0];
          onChange(thinking ? { provider: model.provider, model: model.id, thinking } : null);
        }}
      >
        <option value="">请选择</option>
        {catalog.models.map((model) => (
          <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`}>
            {model.name} · {model.provider}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-thinking`}>思考强度</label>
      <select
        id={`${id}-thinking`}
        value={value?.thinking ?? ''}
        disabled={!selected}
        onChange={(event) => {
          if (!value) return;
          onChange({ ...value, thinking: event.target.value as DesktopThinkingLevel });
        }}
      >
        {!selected && <option value="">先选模型</option>}
        {selected?.thinkingLevels.map((level) => <option key={level} value={level}>{level}</option>)}
      </select>
    </fieldset>
  );
}

function AuthFlowPanel({
  flow,
  onRespond,
  onOpenUrl,
}: {
  flow: ModelAuthFlow;
  onRespond(value: string): Promise<void>;
  onOpenUrl(url: string): Promise<void>;
}) {
  const [value, setValue] = useState('');
  const links = flow.events.flatMap((event) => (
    event.type === 'auth_url'
      ? [{ label: '在浏览器中继续登录', url: event.url }]
      : event.type === 'device_code'
        ? [{ label: `打开登录页（代码 ${event.userCode}）`, url: event.verificationUri }]
        : event.type === 'info'
          ? (event.links ?? []).map((link) => ({ label: link.label ?? '打开链接', url: link.url }))
          : []
  ));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value) void onRespond(value).then(() => setValue(''));
  };
  return (
    <section className="desktop-auth-flow" aria-live="polite">
      <h2>连接 Provider</h2>
      {flow.events.map((event, index) => (
        event.type === 'progress' || event.type === 'info'
          ? <p key={`${event.type}-${index}`}>{event.message}</p>
          : null
      ))}
      {links.map((link) => (
        <button className="action-outline" key={link.url} type="button" onClick={() => void onOpenUrl(link.url)}>
          {link.label}
        </button>
      ))}
      {flow.prompt && (
        <form onSubmit={submit}>
          <label htmlFor="desktop-auth-response">{flow.prompt.message}</label>
          {flow.prompt.type === 'select' ? (
            <select id="desktop-auth-response" value={value} onChange={(event) => setValue(event.target.value)}>
              <option value="">请选择</option>
              {flow.prompt.options.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input
              id="desktop-auth-response"
              type={flow.prompt.type === 'secret' ? 'password' : 'text'}
              value={value}
              placeholder={flow.prompt.placeholder}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
            />
          )}
          <button className="action-solid" type="submit" disabled={!value}>继续</button>
        </form>
      )}
      {flow.status === 'running' && <p className="desktop-progress">正在等待 Provider…</p>}
      {flow.status === 'completed' && <p className="desktop-success">已经连接，可以选择模型了。</p>}
      {flow.error && <p className="desktop-error">{flow.error}</p>}
    </section>
  );
}

export function ModelSettings({
  catalog,
  teacher,
  scout,
  authFlow,
  busy,
  error,
  onLogin,
  onRespond,
  onOpenUrl,
  onSave,
  onBack,
}: {
  catalog: DesktopModelCatalog;
  teacher: DesktopModelSelection | null;
  scout: DesktopModelSelection | null;
  authFlow: ModelAuthFlow | null;
  busy: boolean;
  error: string | null;
  onLogin(provider: string, type: AuthType): Promise<void>;
  onRespond(value: string): Promise<void>;
  onOpenUrl(url: string): Promise<void>;
  onSave(teacher: DesktopModelSelection, scout: DesktopModelSelection): Promise<void>;
  onBack: (() => void) | null;
}) {
  const initial = useMemo(() => defaultModelDraft(catalog, teacher, scout), [catalog, teacher, scout]);
  const [draft, setDraft] = useState(initial);
  return (
    <main className="desktop-canvas desktop-page-reveal">
      <header className="desktop-subpage-header">
        {onBack ? <button className="action-text" type="button" onClick={onBack}>← 回到学习</button> : <span />}
        <span>模型与 Provider</span>
      </header>
      <section className="desktop-model-sheet">
        <p className="desktop-eyebrow">教师安排</p>
        <h1>安排两位老师</h1>
        <p className="desktop-lead">主教师负责方向与课堂；Scout 只在需要材料时检索。两者可以使用不同 Provider。</p>
        <div className="desktop-provider-ledger">
          {catalog.providers.map((provider) => (
            <div key={provider.id}>
              <span><strong>{provider.name}</strong><small>{provider.id}</small></span>
              {provider.configured
                ? <em>{provider.authLabel ?? '已连接'}</em>
                : provider.loginMethods.map((method) => (
                  <button key={method.type} className="action-outline" type="button" onClick={() => void onLogin(provider.id, method.type)}>
                    {method.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
        {authFlow && <AuthFlowPanel flow={authFlow} onRespond={onRespond} onOpenUrl={onOpenUrl} />}
        <div className="desktop-model-ledger">
          <ModelRow
            id="teacher"
            title="主教师"
            detail="长期方向、备课、课堂与教学判断"
            catalog={catalog}
            value={draft.teacher}
            onChange={(value) => setDraft((current) => ({ ...current, teacher: value }))}
          />
          <ModelRow
            id="scout"
            title="检索 Scout"
            detail="按教师 brief 召回足够合适的材料"
            catalog={catalog}
            value={draft.scout}
            onChange={(value) => setDraft((current) => ({ ...current, scout: value }))}
          />
        </div>
        {error && <p className="desktop-error" role="alert">{error}</p>}
        <button
          className="desktop-primary action-solid desktop-model-submit"
          type="button"
          disabled={busy || !draft.teacher || !draft.scout}
          onClick={() => {
            if (draft.teacher && draft.scout) void onSave(draft.teacher, draft.scout);
          }}
        >
          完成设置并开始学习
        </button>
      </section>
    </main>
  );
}
