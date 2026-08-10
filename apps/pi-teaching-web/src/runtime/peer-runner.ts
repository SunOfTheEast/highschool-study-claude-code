import type {
  AssistantMessage,
  Context,
  ModelsSimpleStreamOptions,
} from '@earendil-works/pi-ai';
import type { DesktopThinkingLevel } from '../desktop/contracts';

export type PeerResponderInput = {
  peerId: 'peer-acheng';
  intent: string;
  publicContext: string;
  signal?: AbortSignal;
};

export type PeerResponder = (input: PeerResponderInput) => Promise<string>;

export type PeerCompletion = (
  context: Context,
  options?: ModelsSimpleStreamOptions,
) => Promise<AssistantMessage>;

function finalText(message: AssistantMessage): string {
  if (message.stopReason === 'error' || message.stopReason === 'aborted') {
    throw new Error('PEER_RESPONSE_UNAVAILABLE');
  }
  const text = message.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('PEER_RESPONSE_UNAVAILABLE');
  return text;
}

export function createPeerResponder(
  complete: PeerCompletion,
  thinking: DesktopThinkingLevel,
  persona: string,
): PeerResponder {
  return async ({ intent, publicContext, signal }) => {
    const options: ModelsSimpleStreamOptions = {
      ...(thinking === 'off' ? {} : { reasoning: thinking }),
      ...(signal ? { signal } : {}),
    };
    const response = await complete({
      systemPrompt: persona,
      messages: [{
        role: 'user',
        content: `${publicContext}\n\n# 这次邀请\n${intent}`,
        timestamp: Date.now(),
      }],
    }, options);
    return finalText(response);
  };
}
