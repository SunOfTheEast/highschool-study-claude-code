import type { ConversationItem, SessionKey } from '../shared/contracts';

const discoveryTools = new Set(['read', 'grep', 'find', 'ls', 'discovery']);

type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;

function isDiscovery(item: ConversationItem): boolean {
  return item.kind === 'tool' && discoveryTools.has(item.name);
}

function mergeDiscovery(first: ToolItem, next: ToolItem): ToolItem {
  return {
    id: first.id,
    kind: 'tool',
    name: 'discovery',
    status: first.status === 'running' || next.status === 'running' ? 'running' : 'done',
    detail: null,
    at: first.at,
  };
}

export function presentConversation(items: readonly ConversationItem[]): ConversationItem[] {
  const visible: ConversationItem[] = [];
  for (const item of items) {
    if (item.kind !== 'tool') {
      visible.push(item);
      continue;
    }
    if (item.status === 'error') continue;
    if (!isDiscovery(item)) {
      visible.push({ ...item, detail: null });
      continue;
    }
    const previous = visible.at(-1);
    if (previous?.kind === 'tool' && isDiscovery(previous)) {
      visible[visible.length - 1] = mergeDiscovery(previous, item);
    } else {
      visible.push({ ...item, name: 'discovery', detail: null });
    }
  }
  return visible;
}

export function waitingForTeacherCopy(sessionKey: SessionKey): string {
  if (sessionKey.startsWith('meta:')) return '老师正在梳理你的长期学习方向…';
  if (sessionKey.startsWith('roadmap:')) return '老师正在整理下一阶段的学习安排…';
  if (sessionKey.startsWith('plan:')) return '老师正在准备这一阶段的课堂…';
  if (sessionKey.startsWith('lesson:')) return '老师正在思考你刚才的学习表现与下一步…';
  return '老师正在思考你刚才的问题…';
}

export function toolActivityCopy(item: ToolItem, sessionKey: SessionKey): string {
  if (item.name === 'discovery') {
    if (sessionKey.startsWith('plan:')) {
      return item.status === 'running' ? '老师正在查找合适材料' : '老师查找了合适材料';
    }
    if (sessionKey.startsWith('roadmap:') || sessionKey.startsWith('meta:')) {
      return item.status === 'running' ? '老师正在回看相关学习记录' : '老师回看了相关学习记录';
    }
    return item.status === 'running' ? '老师正在查找相关内容' : '老师查看了相关内容';
  }
  if (item.name === 'save_note') return item.status === 'running' ? '正在保存笔记' : '笔记已保存';
  if (item.name === 'save_problem_card' || item.name === 'save_prepared_problem_card') {
    return item.status === 'running' ? '正在保存题卡' : '题卡已保存';
  }
  if (item.name === 'create_roadmap') {
    return item.status === 'running' ? '正在建立长期学习路线' : '长期学习路线已建立';
  }
  if (item.name === 'free_learning_memory_commit' || item.name === 'lesson_memory_commit') {
    return item.status === 'running' ? '老师正在整理这次学习记录' : '学习记录已整理';
  }
  if (item.name.startsWith('calendar_')) {
    return item.status === 'running' ? '老师正在整理学习约定' : '学习约定已更新';
  }
  if (item.name === 'classroom_log_append' || item.name === 'classroom_update') {
    return item.status === 'running' ? '老师正在记录课堂进展' : '课堂进展已记录';
  }
  if ((item.name === 'edit' || item.name === 'write') && sessionKey.startsWith('plan:')) {
    return item.status === 'running' ? '老师正在整理课程安排' : '课程安排已整理';
  }
  return item.status === 'running' ? '老师正在处理' : '处理完成';
}
