import type {
  PublicKnowledgeFilters,
  ViewQuery,
} from '../../shared/view-contracts';

export function MethodFilters({
  value,
  onChange,
}: {
  value: PublicKnowledgeFilters;
  onChange(patch: Partial<ViewQuery>): void;
}) {
  return (
    <form className="method-filters" aria-label="方法分区">
      <strong>方法分区</strong>
      <label>
        专题
        <select
          value={value.topicId ?? ''}
          onChange={(event) => onChange({ topicId: event.currentTarget.value || null })}
        >
          <option value="">完整方法树</option>
          {value.availableTopics.map((topic) => (
            <option key={topic.id} value={topic.id}>{topic.title}</option>
          ))}
        </select>
      </label>
      <label>
        学习周期
        <select
          value={value.planId ?? ''}
          onChange={(event) => onChange({ planId: event.currentTarget.value || null })}
        >
          <option value="">全部 Plan</option>
          {value.availablePlans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.title}</option>
          ))}
        </select>
      </label>
      <label>
        时间范围
        <select
          value={value.timeRange}
          onChange={(event) => onChange({
            timeRange: event.currentTarget.value as ViewQuery['timeRange'],
          })}
        >
          <option value="all">全部学习记录</option>
          <option value="plan">当前 Plan</option>
          <option value="lesson">当前 Lesson</option>
        </select>
      </label>
    </form>
  );
}

export default MethodFilters;
