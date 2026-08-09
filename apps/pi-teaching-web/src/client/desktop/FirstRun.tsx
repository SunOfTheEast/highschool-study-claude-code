import { useState, type FormEvent } from 'react';

export type FirstRunProps = {
  busy: boolean;
  error: string | null;
  onBlank(name: string): Promise<void>;
  onExisting(): Promise<void>;
  onExample(name: string): Promise<void>;
};

export function FirstRun({ busy, error, onBlank, onExisting, onExample }: FirstRunProps) {
  const [name, setName] = useState('我的学习集');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onBlank(name.trim());
  };

  return (
    <main className="desktop-canvas desktop-page-reveal">
      <header className="desktop-masthead">
        <span className="desktop-seal seal-mark" aria-hidden="true">学</span>
        <p>StudyForge · 本地学习工作台</p>
      </header>
      <section className="desktop-first-sheet" aria-labelledby="desktop-first-title">
        <p className="desktop-eyebrow">第一次见面</p>
        <h1 id="desktop-first-title">先从哪里开始？</h1>
        <p className="desktop-lead">不用先想清楚课程结构。给这段学习起个名字，就可以直接去问老师。</p>
        <form className="desktop-blank-start" onSubmit={submit}>
          <label htmlFor="learning-set-name">学习集名称</label>
          <div>
            <input
              id="learning-set-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <button
              className="desktop-primary action-solid"
              type="submit"
              disabled={busy || !name.trim()}
            >
              从空白开始
            </button>
          </div>
          <small>只建立一个空白学习集，不会替你虚构课程或学习结论。</small>
        </form>
        <div className="desktop-quiet-entrances">
          <button type="button" onClick={() => void onExisting()} disabled={busy}>
            <span>打开已有学习集</span>
            <small>继续使用你自己的 Markdown 文件夹</small>
            <i aria-hidden="true">→</i>
          </button>
          <button type="button" onClick={() => void onExample('导数学习示例')} disabled={busy}>
            <span>使用导数示例</span>
            <small>复制一份可随意修改的个人副本</small>
            <i aria-hidden="true">→</i>
          </button>
        </div>
        {error && <p className="desktop-error" role="alert">{error}</p>}
        {busy && <p className="desktop-progress" role="status">正在铺开学习集…</p>}
      </section>
      <footer className="desktop-footnote">学习资料保存在你的 Documents 文件夹，覆盖安装不会删除。</footer>
    </main>
  );
}
