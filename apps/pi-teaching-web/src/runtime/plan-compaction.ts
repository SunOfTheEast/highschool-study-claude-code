import type { ImageContent } from '@earendil-works/pi-ai';
import type {
  AgentSessionEvent,
  ContextUsage,
} from '@earendil-works/pi-coding-agent';
import type { NodeSessionScope } from './session-scope';

export const PLAN_COMPACTION_THRESHOLD_TOKENS = 200_000;

export const PLAN_COMPACTION_INSTRUCTIONS = `StudyForge Plan-session checkpoint:
- Treat ROADMAP.md, the current Plan, and Lesson Markdown as the durable sources of truth.
- Keep exact current-node and relevant Lesson paths, explicit student requirements, unresolved questions, decisions, and next actions.
- Distinguish observed student facts, teacher hypotheses, and judgments that still need verification.
- Do not reproduce card bodies, Scout search transcripts, old tool output, or classroom logs already stored in Markdown.
- When detail is needed later, read the original Markdown again. This summary is a working index, not a teaching fact or Handoff.`;

type PlanCompactionSession = {
  prompt(text: string, options: { images: ImageContent[] }): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  getContextUsage(): ContextUsage | undefined;
  compact(customInstructions?: string): Promise<unknown>;
};

type CompactionErrorReporter = (error: unknown) => void;

type ToolExecutionStartEvent = Extract<
  AgentSessionEvent,
  { type: 'tool_execution_start' }
>;

function isLessonMarkdownMutation(
  event: AgentSessionEvent,
): event is ToolExecutionStartEvent {
  if (event.type !== 'tool_execution_start') return false;
  if (event.toolName !== 'edit' && event.toolName !== 'write') return false;
  if (typeof event.args?.path !== 'string') return false;
  const path = event.args.path.replaceAll('\\', '/');
  return /(?:^|\/)lessons\/[^/]+\.md$/.test(path);
}

function logCompactionError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[studyforge] Plan Session compaction failed: ${message}`);
}

export function createPlanCompactionPrompt(
  session: PlanCompactionSession,
  scope: NodeSessionScope,
  reportError: CompactionErrorReporter = logCompactionError,
) {
  let turnActive = false;
  let hasSuccessfulLessonMutation = false;
  const pendingLessonMutations = new Set<string>();

  const resetTurn = () => {
    turnActive = false;
    hasSuccessfulLessonMutation = false;
    pendingLessonMutations.clear();
  };

  const unsubscribe = session.subscribe((event) => {
    if (!turnActive || scope.nodeKind !== 'plan') return;
    if (isLessonMarkdownMutation(event)) {
      pendingLessonMutations.add(event.toolCallId);
      return;
    }
    if (event.type !== 'tool_execution_end') return;
    if (!pendingLessonMutations.delete(event.toolCallId)) return;
    if (!event.isError) hasSuccessfulLessonMutation = true;
  });

  return {
    prompt: async (text: string, images: ImageContent[] = []): Promise<void> => {
      resetTurn();
      turnActive = true;
      try {
        await session.prompt(text, { images });
      } catch (error) {
        resetTurn();
        throw error;
      }

      turnActive = false;
      pendingLessonMutations.clear();
      const shouldCompact = hasSuccessfulLessonMutation;
      hasSuccessfulLessonMutation = false;
      if (!shouldCompact) return;

      try {
        const usage = session.getContextUsage();
        if (usage?.tokens === null || usage?.tokens === undefined) return;
        if (usage.tokens < PLAN_COMPACTION_THRESHOLD_TOKENS) return;
        await session.compact(PLAN_COMPACTION_INSTRUCTIONS);
      } catch (error) {
        reportError(error);
      }
    },
    dispose: unsubscribe,
  };
}
