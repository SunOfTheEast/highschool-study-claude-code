import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { renderPeerPublicContext } from './peer-context';
import type { LearningAssetToolSession } from './learning-asset-tools';
import type { PeerResponder } from './peer-runner';
import type { FreeLearningSessionScope } from './session-scope';

export const PEER_MESSAGE_DETAILS = {
  kind: 'peer-message',
  version: 1,
  actorType: 'peer',
  actorId: 'peer-acheng',
  displayName: '阿澄',
} as const;

const peerParameters = Type.Object({
  peerId: Type.Literal('peer-acheng'),
  intent: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export function createPeerTool(
  root: string,
  scope: FreeLearningSessionScope,
  session: LearningAssetToolSession,
  respond: PeerResponder,
) {
  return defineTool({
    name: 'ask_peer',
    label: '邀请阿澄回应',
    description: 'Ask the AI classmate 阿澄 to respond in the current free-learning conversation. Use only when the student explicitly invites 阿澄, or explicitly accepts the teacher\'s immediately preceding suggestion to invite 阿澄. Do not use for an ordinary mention, an ordinary teaching question, or before the student accepts a suggestion.',
    executionMode: 'sequential',
    parameters: peerParameters,
    execute: async (_toolCallId, input, signal) => {
      const text = await respond({
        peerId: input.peerId,
        intent: input.intent,
        publicContext: renderPeerPublicContext(root, scope, session.getBranch()),
        ...(signal ? { signal } : {}),
      });
      return {
        content: [{ type: 'text' as const, text }],
        details: PEER_MESSAGE_DETAILS,
      };
    },
  });
}
