import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { renderPeerPublicContext } from './peer-context';
import type { LearningAssetToolSession } from './learning-asset-tools';
import type { PeerResponder } from './peer-runner';
import type { FreeLearningSessionScope } from './session-scope';
import type { PeerMove } from '../shared/contracts';

export const PEER_MESSAGE_DETAILS = {
  kind: 'peer-message',
  version: 1,
  actorType: 'peer',
  actorId: 'peer-axia',
  displayName: '阿夏',
} as const;

const peerParameters = Type.Object({
  peerId: Type.Literal('peer-axia'),
  intent: Type.String({ minLength: 1 }),
  move: Type.Optional(Type.Union([
    Type.Literal('question'),
    Type.Literal('association'),
    Type.Literal('challenge'),
  ])),
}, { additionalProperties: false });

export function createPeerTool(
  root: string,
  scope: FreeLearningSessionScope,
  session: LearningAssetToolSession,
  respond: PeerResponder,
) {
  return defineTool({
    name: 'ask_peer',
    label: '邀请阿夏回应',
    description: 'Ask the AI classmate 阿夏 to respond in the current free-learning conversation. Use only when the student explicitly invites 阿夏, or explicitly accepts the teacher\'s immediately preceding suggestion to invite 阿夏. Set move to question, association, or challenge only when it describes the learning action you are already inviting. Do not use for an ordinary mention, an ordinary teaching question, or before the student accepts a suggestion. Treat the reply as teaching help, not student evidence. Any learning-memory update must rely on actual student evidence; if it relies on a later response after Peer help, preserve that help boundary.',
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
        details: {
          ...PEER_MESSAGE_DETAILS,
          move: (input.move ?? null) as PeerMove | null,
        },
      };
    },
  });
}
