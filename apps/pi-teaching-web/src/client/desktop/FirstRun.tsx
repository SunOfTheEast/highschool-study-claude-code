export type FirstRunProps = {
  busy: boolean;
  error: string | null;
  onBook(): Promise<void>;
  onBlank(name: string): Promise<void>;
  onExisting(): Promise<void>;
  onExample(name: string): Promise<void>;
};

export function FirstRun({ busy, error, onBook, onBlank, onExisting, onExample }: FirstRunProps) {
  return (
    <main className="desktop-canvas desktop-page-reveal desktop-book-first">
      <header className="desktop-masthead">
        <span className="desktop-seal seal-mark" aria-hidden="true">学</span>
        <p>StudyForge · 本地学习工作台</p>
      </header>
      <section className="desktop-first-sheet" aria-labelledby="desktop-first-title">
        <div className="desktop-book-first-copy">
          <p className="desktop-eyebrow">第一次见面</p>
          <h1 id="desktop-first-title">先把你正在学的书放进来。</h1>
          <p className="desktop-lead">
            不必先想清楚课程，也不必先知道自己哪里不会。老师会沿着原书的次序，陪你从眼前这一章开始。
          </p>
          <div className="desktop-book-import">
            <div>
              <strong>从一本书开始</strong>
              <small>PDF 教材、教辅或讲义 · 文件保存在本机</small>
            </div>
            <button
              className="desktop-primary action-solid"
              type="button"
              disabled={busy}
              onClick={() => void onBook()}
            >
              <span className="desktop-import-seal" aria-hidden="true">书</span>
              选择 PDF
            </button>
          </div>
          <nav className="desktop-first-secondary" aria-label="其他开始方式">
            <span>暂时没有书？</span>
            <button type="button" onClick={() => void onBlank('我的学习集')} disabled={busy}>
              从空白开始
            </button>
            <span>·</span>
            <button type="button" onClick={() => void onExisting()} disabled={busy}>
              打开已有学习集
            </button>
            <span>·</span>
            <button type="button" onClick={() => void onExample('导数学习示例')} disabled={busy}>
              使用导数示例
            </button>
          </nav>
        </div>
        <div className="desktop-book-stage" aria-hidden="true">
          <div className="desktop-book-cover">
            <small>你的教材或讲义</small>
            <strong>从真实章节开始</strong>
            <i>StudyForge</i>
          </div>
          <p>目录与正文会在你真正阅读时逐步整理，不会让你先等完整本书。</p>
        </div>
        {error && <p className="desktop-error" role="alert">{error}</p>}
        {busy && <p className="desktop-progress" role="status">正在铺开书桌…</p>}
      </section>
      <footer className="desktop-footnote">
        学习文件保存在本机；需要模型读取时，只发送当前选中的必要页面及相关内容，相关内容会交给你选择的模型服务处理；不会无条件上传整个学习集，也不会上传整本书。
      </footer>
    </main>
  );
}
