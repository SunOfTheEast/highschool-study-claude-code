import { useState, type CSSProperties } from 'react';
import type {
  PersonaPresentation,
  PresentationPreferences,
} from '../../shared/contracts';

export function PersonaDrawer({
  value,
  preferences,
  onClose,
  onSelect,
  onPreferences,
}: {
  value: PersonaPresentation;
  preferences: PresentationPreferences;
  onClose(): void;
  onSelect(id: string): Promise<void>;
  onPreferences(value: PresentationPreferences): void;
}) {
  const [selecting, setSelecting] = useState('');
  const [error, setError] = useState('');

  const select = async (id: string) => {
    if (id === value.id) return;
    setSelecting(id);
    setError('');
    try {
      await onSelect(id);
      onClose();
    } catch {
      setError('切换没有完成，请稍后再试。');
    } finally {
      setSelecting('');
    }
  };

  return (
    <div className="persona-drawer-overlay" role="presentation">
      <button
        type="button"
        className="persona-drawer-scrim"
        aria-label="关闭陪伴风格"
        onClick={onClose}
      />
      <section
        className="persona-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-drawer-title"
      >
        <header>
          <div>
            <span>只改变表达，不改变学习事实</span>
            <h2 id="persona-drawer-title">陪伴风格</h2>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <div className="persona-choices">
          {value.choices.map((choice) => {
            const current = choice.id === value.id;
            return (
              <button
                type="button"
                key={choice.id}
                className="persona-choice"
                data-current={current ? 'true' : 'false'}
                disabled={Boolean(selecting)}
                style={{ '--choice-accent': choice.accent } as CSSProperties}
                onClick={() => void select(choice.id)}
              >
                <span className="persona-choice-mark">
                  {choice.portraitUrl
                    ? <img src={choice.portraitUrl} alt="" />
                    : choice.glyph}
                </span>
                <span className="persona-choice-copy">
                  <b>{choice.name}</b>
                  <small>{choice.description}</small>
                  <code>{choice.accent}</code>
                </span>
                <i>{selecting === choice.id ? '切换中…' : current ? '当前' : '选择'}</i>
              </button>
            );
          })}
        </div>
        {error && <p className="persona-drawer-error" role="alert">{error}</p>}

        <section className="presentation-preferences">
          <header>
            <span>页面呈现</span>
            <p>这些选项只保存在当前浏览器。</p>
          </header>
          <label>
            <span><b>柔和动效</b><small>保留轻微的页面与消息过渡</small></span>
            <input
              type="checkbox"
              checked={preferences.motion === 'gentle'}
              onChange={(event) => onPreferences({
                ...preferences,
                motion: event.target.checked ? 'gentle' : 'reduced',
              })}
            />
          </label>
          <label>
            <span><b>完成反馈</b><small>节点完成时给出短暂而克制的提示</small></span>
            <input
              type="checkbox"
              checked={preferences.completionFeedback}
              onChange={(event) => onPreferences({
                ...preferences,
                completionFeedback: event.target.checked,
              })}
            />
          </label>
        </section>
      </section>
    </div>
  );
}
