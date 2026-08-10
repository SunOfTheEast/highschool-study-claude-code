export type DesktopIssue = { code: string; detail: string };

const issueCopy: Record<string, { title: string; body: string }> = {
  MODEL_UNAVAILABLE: {
    title: '模型暂时不可用',
    body: '原来的模型选择现在无法使用。StudyForge 不会偷偷换成另一位老师。',
  },
  PROVIDER_AUTH_REQUIRED: {
    title: '还没有连接模型服务',
    body: '登录对应的 Provider 后，再确认主教师与检索 Scout。',
  },
  LEARNING_SET_INVALID: {
    title: '这个学习集暂时打不开',
    body: '文件夹缺少当前版本需要的最小结构，StudyForge 没有自动改写它。',
  },
  RUNTIME_FAILURE: {
    title: '本地教师没有正常醒来',
    body: '学习文件没有因此结课或改变状态。可以先重试本地服务。',
  },
};

export function DiagnosticPage({
  issue,
  onRetry,
  onSelectLearningSet,
  onOpenModels,
}: {
  issue: DesktopIssue;
  onRetry(): void;
  onSelectLearningSet(): void;
  onOpenModels(): void;
}) {
  const copy = issueCopy[issue.code] ?? issueCopy.RUNTIME_FAILURE!;
  return (
    <main className="desktop-canvas desktop-page-reveal">
      <section className="desktop-diagnostic-sheet">
        <p className="desktop-eyebrow">本地状态单</p>
        <h1>{copy.title}</h1>
        <p className="desktop-lead">{copy.body}</p>
        <div className="desktop-diagnostic-actions">
          <button className="desktop-primary action-solid" type="button" onClick={onRetry}>重新启动本地教师</button>
          <button className="action-outline" type="button" onClick={onOpenModels}>重新选择模型</button>
          <button className="action-text" type="button" onClick={onSelectLearningSet}>选择另一个学习集</button>
        </div>
      </section>
    </main>
  );
}
