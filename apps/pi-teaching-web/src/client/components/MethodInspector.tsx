import type { PublicMethodDetail } from '../../shared/view-contracts';

export function MethodInspector({
  value,
  onSelectCard,
  onSelectMaterial,
  onCourse,
  onMemory,
}: {
  value: PublicMethodDetail | null;
  onSelectCard(cardPath: string, methodName: string): void;
  onSelectMaterial(path: string): void;
  onCourse(route: string): void;
  onMemory(source: string): void;
}) {
  return (
    <aside className="method-inspector" aria-label="方法详情">
      <small>方法详情</small>
      {!value ? (
        <p>选择一个方法，查看它在题卡、材料和课堂中的位置。</p>
      ) : (
        <>
          <h2>{value.name}</h2>
          {value.parent && <p>上位方法：{value.parent.name}</p>}
          {value.children.length > 0 && (
            <p>下位方法：{value.children.map((child) => child.name).join('、')}</p>
          )}
          <p>{value.boundary}</p>
          <section>
            <h3>关联题卡</h3>
            {value.cards.length === 0 ? <p>目前没有挂接题卡。</p> : (
              <ul>
                {value.cards.map((card) => (
                  <li key={card.cardPath}>
                    <button
                      type="button"
                      onClick={() => onSelectCard(card.cardPath, value.name)}
                    >
                      {card.title} · {card.role === 'primary' ? '主方法' : '辅助方法'}
                    </button>
                    <details><summary>技术路径</summary><code>{card.cardPath}</code></details>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>研习材料</h3>
            {value.materials.length === 0 ? <p>目前没有公开材料。</p> : (
              <ul>
                {value.materials.map((material) => (
                  <li key={material.path}>
                    <button type="button" onClick={() => onSelectMaterial(material.path)}>
                      {material.label}
                    </button>
                    <details><summary>材料路径</summary><code>{material.path}</code></details>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>相关课程</h3>
            {value.lessons.map((lesson) => (
              <button key={lesson.lessonId} type="button" onClick={() => onCourse(lesson.route)}>
                {lesson.title}
              </button>
            ))}
          </section>
          <section>
            <h3>学习依据</h3>
            {value.evidence.length === 0 ? <p>还没有个人学习记录。</p> : (
              <ul>
                {value.evidence.map((evidence) => (
                  <li key={evidence.source}>
                    <button type="button" onClick={() => onMemory(evidence.source)}>
                      {evidence.active ? '当前记录' : '后来修正'} · {evidence.assessment}
                    </button>
                    <details>
                      <summary>来源信息</summary>
                      <code>{evidence.source}</code>
                      <p>{evidence.support}</p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </aside>
  );
}

export default MethodInspector;
