import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type {
  LearningContextReference,
  LearningNoteBlock,
  ProblemAttemptResponse,
} from '../shared/contracts';
import {
  readLearningNote,
  readProblemCard,
} from '../study/learning-assets';
import {
  readMaterialLocator,
  readMaterialRevision,
} from '../study/materials';
import { readProblemActivity } from '../study/problem-attempts';
import type { FreeLearningSessionScope } from './session-scope';

type PublicUtterance = {
  speaker: string;
  text: string;
};

function contentText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content.flatMap((item) => (
    item && typeof item === 'object'
    && (item as { type?: unknown }).type === 'text'
    && typeof (item as { text?: unknown }).text === 'string'
      ? [(item as { text: string }).text]
      : []
  )).join('').trim();
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function publicUtterances(entries: readonly SessionEntry[]): PublicUtterance[] {
  return entries.flatMap((entry) => {
    if (entry.type !== 'message') return [];
    const message = record(entry.message);
    if (!message) return [];
    const text = contentText(message.content);
    if (!text) return [];
    if (message.role === 'user') return [{ speaker: '学生', text }];
    if (message.role === 'assistant') return [{ speaker: '老师', text }];
    if (message.role !== 'toolResult' || message.toolName !== 'ask_peer' || message.isError === true) {
      return [];
    }
    const details = record(message.details);
    return details?.kind === 'peer-message'
      && details.version === 1
      && details.actorType === 'peer'
      && details.actorId === 'peer-acheng'
      && details.displayName === '阿澄'
      ? [{ speaker: '阿澄（AI 同学）', text }]
      : [];
  });
}

function renderNoteBlock(block: LearningNoteBlock): string {
  return block.kind === 'markdown'
    ? block.body
    : [`回忆问题：${block.prompt}`, `回忆答案：${block.answer}`].join('\n');
}

function renderAttempt(response: ProblemAttemptResponse): string {
  return response.kind === 'answer' ? response.text : '学生表示暂时不会作答。';
}

function renderStudentVisibleAsset(root: string, reference: LearningContextReference): string {
  if (reference.kind === 'note') {
    const note = readLearningNote(root, reference.id);
    return [
      `## 笔记：${note.title}`,
      ...note.blocks.map(renderNoteBlock),
    ].join('\n\n');
  }
  if (reference.kind === 'material') {
    const revision = readMaterialRevision(root, reference.id, reference.revision);
    const locator = readMaterialLocator(root, reference);
    return [
      `## 资料：${revision.title}`,
      ...(locator.text ? [locator.text] : []),
    ].join('\n\n');
  }
  const card = readProblemCard(root, reference.id);
  const activity = readProblemActivity(root, card.id);
  return [
    `## 题卡：${card.stem}`,
    ...(card.studentNote ? [`学生笔记：${card.studentNote}`] : []),
    ...(activity.latestAttempt
      ? [`最近作答：${renderAttempt(activity.latestAttempt.response)}`]
      : []),
    ...(activity.answerRevealedForLatestAttempt
      ? [`已经公开的标准答案：${card.standardAnswer}`]
      : []),
  ].join('\n\n');
}

export function renderPeerPublicContext(
  root: string,
  scope: FreeLearningSessionScope,
  entries: readonly SessionEntry[],
): string {
  const conversation = publicUtterances(entries).map((item) => (
    `${item.speaker}：${item.text}`
  ));
  const assets = scope.selectedAssets.map((reference) => (
    renderStudentVisibleAsset(root, reference)
  ));
  return [
    '# 当前公开对话',
    conversation.join('\n\n') || '（还没有公开发言）',
    ...(assets.length > 0 ? ['# 学生带入的内容', ...assets] : []),
  ].join('\n\n');
}
