import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { SessionKey, StudyViewEvent } from '../shared/contracts';
import {
  visibleAssistantText,
  type MessageProjectionMode,
} from './message-policy';

const labels: Record<string, string> = {
  card_search: '正在查找真实题卡',
  trace_search: '正在核对课堂证据',
  trace_append: '正在记录课堂证据',
  source_resolve: '正在核验来源',
  classroom_update: '正在更新课堂节点',
  lesson_close: '正在整理课堂总结',
  lesson_prepare: '正在整理课堂结构',
  plan_update: '正在写回学习计划',
  card_alternative_append: '正在登记已验证的另解',
};

export function projectSessionEvent(
  sessionKey: SessionKey,
  event: AgentSessionEvent,
  mode: MessageProjectionMode = 'safe',
): StudyViewEvent[] {
  if (event.type === 'message_update') {
    return mode === 'raw-stream' && event.assistantMessageEvent.type === 'text_delta'
      ? [{
        type: 'message-delta',
        sessionKey,
        messageId: `${sessionKey}:${event.message.timestamp}`,
        delta: event.assistantMessageEvent.delta,
      }]
      : [];
  }
  if (event.type === 'message_end' && event.message.role === 'assistant') {
    const text = visibleAssistantText(event.message.content, mode);
    return text
      ? [{
        type: 'message',
        sessionKey,
        message: {
          id: `${sessionKey}:${event.message.timestamp}`,
          role: sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
          text,
          complete: true,
        },
      }]
      : [];
  }
  if (event.type === 'tool_execution_start') {
    return [{
      type: 'work-status',
      sessionKey,
      tool: event.toolName,
      status: 'running',
      label: labels[event.toolName] ?? '正在处理',
    }];
  }
  if (event.type === 'tool_execution_end') {
    return [{
      type: 'work-status',
      sessionKey,
      tool: event.toolName,
      status: event.isError ? 'failed' : 'done',
      label: labels[event.toolName] ?? '处理完成',
    }];
  }
  return [];
}
