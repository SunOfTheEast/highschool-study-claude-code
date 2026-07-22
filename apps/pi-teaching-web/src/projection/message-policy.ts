import type { ChatMessage, SessionKey } from '../shared/contracts';

export type MessageProjectionMode = 'safe' | 'raw-stream';

type ContentPart = { type?: unknown; text?: unknown };
type StoredMessage = { role?: unknown; content?: unknown };

export function parseMessageProjectionMode(value: string | undefined): MessageProjectionMode {
  const mode = value ?? 'safe';
  if (mode === 'safe' || mode === 'raw-stream') return mode;
  throw new Error(`INVALID_MESSAGE_PROJECTION: ${mode}`);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap((part) => {
    const item = part as ContentPart;
    return item?.type === 'text' ? [String(item.text ?? '')] : [];
  }).join('');
}

export function visibleAssistantText(
  content: unknown,
  mode: MessageProjectionMode,
): string | null {
  const hasToolCall = Array.isArray(content)
    && content.some((part) => (part as ContentPart)?.type === 'toolCall');
  if (mode === 'safe' && hasToolCall) return null;
  return textFromContent(content) || null;
}

export function projectStoredMessage(
  sessionKey: SessionKey,
  raw: unknown,
  index: number,
  mode: MessageProjectionMode,
): ChatMessage | null {
  const message = raw as StoredMessage;
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  const text = message.role === 'assistant'
    ? visibleAssistantText(message.content, mode)
    : textFromContent(message.content) || null;
  if (!text) return null;
  return {
    id: `${sessionKey}:${index}`,
    role: message.role === 'user'
      ? 'student'
      : sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
    text,
    complete: true,
  };
}
