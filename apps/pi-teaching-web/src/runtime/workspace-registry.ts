import type { ImageContent } from '@earendil-works/pi-ai';
import {
  ROADMAP_COACH_SESSION_KEY,
  type ConversationItem,
  type PlanWorkspaceSnapshot,
  type RoadmapWorkspaceSnapshot,
  type SessionKey,
} from '../shared/contracts';
import type { MessageProjectionMode } from '../projection/message-policy';
import { projectConversationEntries } from '../projection/conversation-projector';
import type { WorkflowSnapshot } from '../workflows/contracts';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../memory-review/contracts';
import {
  readLearningSet,
  readPlanWorkspace,
  readRoadmapWorkspace,
} from '../study/read-workspace';
import { validatePreparedLesson } from '../study/validate-prepared-lesson';
import { setFrontmatterField } from '../study/write-workspace';
import { resolvePersona } from '../study/persona';
import type { StudySession, StudySessionFactory } from './session-factory';
import { findOwnedPiSessionFile } from './session-owner';
import {
  ROADMAP_COACH_SCOPE,
  type StudySessionScope,
} from './session-scope';

export type SessionFileLookup = (
  root: string,
  sessionId: string,
  expected: StudySessionScope,
) => Promise<string | null>;

export const findPiSessionFile: SessionFileLookup = findOwnedPiSessionFile;

export class WorkspaceRegistry {
  private readonly sessions = new Map<string, StudySession>();
  private planId: string | null = null;

  constructor(
    private readonly root: string,
    private readonly factory: StudySessionFactory,
    private readonly lookup: SessionFileLookup = findPiSessionFile,
  ) {}

  snapshot(planId: string | null = this.planId): PlanWorkspaceSnapshot {
    if (!planId) throw new Error('PLAN_NOT_SELECTED');
    this.planId = planId;
    return readPlanWorkspace(this.root, planId);
  }

  roadmapSnapshot(): RoadmapWorkspaceSnapshot {
    return readRoadmapWorkspace(this.root);
  }

  private workspaceForLesson(lessonId: string): PlanWorkspaceSnapshot {
    for (const plan of readLearningSet(this.root).plans) {
      const workspace = readPlanWorkspace(this.root, plan.id);
      if (workspace.lessons.some((lesson) => lesson.id === lessonId)) {
        this.planId = plan.id;
        return workspace;
      }
    }
    throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
  }

  async openCoach(planId: string): Promise<StudySession> {
    this.planId = planId;
    const key = `coach:${planId}`;
    const cached = this.sessions.get(key);
    if (cached) return cached;
    const snapshot = readPlanWorkspace(this.root, planId);
    const scope = {
      role: 'coach',
      ownerId: planId,
      ownerPath: snapshot.plan.path,
    } satisfies StudySessionScope;
    const sessionFile = snapshot.coach.sessionId
      ? await this.lookup(this.root, snapshot.coach.sessionId, scope)
      : null;
    const session = await this.factory({
      ...scope,
      sessionFile,
    });
    this.sessions.set(key, session);
    setFrontmatterField(this.root, snapshot.plan.path, 'coach_session', session.sessionId);
    return session;
  }

  async openRoadmapCoach(): Promise<StudySession> {
    const cached = this.sessions.get(ROADMAP_COACH_SESSION_KEY);
    if (cached) return cached;
    const snapshot = readRoadmapWorkspace(this.root);
    const sessionFile = snapshot.coach.sessionId
      ? await this.lookup(this.root, snapshot.coach.sessionId, ROADMAP_COACH_SCOPE)
      : null;
    const session = await this.factory({
      ...ROADMAP_COACH_SCOPE,
      sessionFile,
    });
    this.sessions.set(ROADMAP_COACH_SESSION_KEY, session);
    setFrontmatterField(
      this.root,
      ROADMAP_COACH_SCOPE.ownerPath,
      'roadmap_coach_session',
      session.sessionId,
    );
    return session;
  }

  async startLesson(lessonId: string): Promise<StudySession> {
    const workspace = this.workspaceForLesson(lessonId);
    const lesson = workspace.lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    if (lesson.status === 'prepared') {
      validatePreparedLesson(this.root, lesson.path);
      setFrontmatterField(this.root, lesson.path, 'status', 'active');
    } else if (lesson.status === 'paused') {
      setFrontmatterField(this.root, lesson.path, 'status', 'active');
    }
    return this.openTutor(lessonId);
  }

  async triggerLessonStart(lessonId: string): Promise<void> {
    const session = this.sessions.get(`tutor:${lessonId}`) ?? await this.openTutor(lessonId);
    await session.triggerLessonStart();
  }

  async openTutor(lessonId: string): Promise<StudySession> {
    const key = `tutor:${lessonId}`;
    const lesson = this.workspaceForLesson(lessonId).lessons.find((item) => item.id === lessonId);
    if (!lesson || !['active', 'paused'].includes(lesson.status)) {
      throw new Error(`LESSON_NOT_OPEN: ${lessonId}`);
    }
    const cached = this.sessions.get(key);
    if (cached) return cached;
    const scope = {
      role: 'tutor',
      ownerId: lessonId,
      ownerPath: lesson.path,
    } satisfies StudySessionScope;
    const sessionFile = lesson.tutorSessionId
      ? await this.lookup(this.root, lesson.tutorSessionId, scope)
      : null;
    const session = await this.factory({
      ...scope,
      sessionFile,
    });
    this.sessions.set(key, session);
    setFrontmatterField(this.root, lesson.path, 'tutor_session', session.sessionId);
    return session;
  }

  async send(key: SessionKey, text: string, images: ImageContent[] = []): Promise<void> {
    const session = await this.openSession(key);
    await session.prompt(text, images);
  }

  async setDeepMode(key: SessionKey, enabled: boolean): Promise<void> {
    (await this.openSession(key)).setDeepMode(enabled);
  }

  async deepMode(key: SessionKey): Promise<boolean> {
    return (await this.openSession(key)).deepModeEnabled();
  }

  async workflows(key: SessionKey): Promise<WorkflowSnapshot[]> {
    return (await this.openSession(key)).workflows();
  }

  async memoryReview(key: SessionKey): Promise<MemoryReviewSnapshot | null> {
    if (!key.startsWith('coach:') || key === ROADMAP_COACH_SESSION_KEY) {
      throw new Error('MEMORY_REVIEW_PLAN_COACH_ONLY');
    }
    return (await this.openCoach(key.slice(6))).memoryReview();
  }

  async submitMemoryReview(
    key: SessionKey,
    id: string,
    decisions: MemoryReviewDecision[],
  ): Promise<MemoryReviewSnapshot> {
    if (!key.startsWith('coach:') || key === ROADMAP_COACH_SESSION_KEY) {
      throw new Error('MEMORY_REVIEW_PLAN_COACH_ONLY');
    }
    return (await this.openCoach(key.slice(6))).submitMemoryReview(id, decisions);
  }

  async confirmWorkflow(key: SessionKey, id: string): Promise<WorkflowSnapshot> {
    return (await this.openSession(key)).confirmWorkflow(id);
  }

  async cancelWorkflow(key: SessionKey, id: string): Promise<void> {
    (await this.openSession(key)).cancelWorkflow(id);
  }

  async pauseLesson(lessonId: string): Promise<void> {
    const lesson = this.workspaceForLesson(lessonId).lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    const tutor = this.sessions.get(`tutor:${lessonId}`);
    if (tutor?.isStreaming) await tutor.abort();
    setFrontmatterField(this.root, lesson.path, 'status', 'paused');
  }

  async abandonForReprepare(lessonId: string): Promise<void> {
    const lesson = this.workspaceForLesson(lessonId).lessons.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    const coach = await this.openCoach(lesson.planId);
    if (lesson.status === 'prepared') {
      await coach.prompt(
        `学生要求重新备课。Tutor 尚未开始；请在学生确认方向后原地修改 ${lesson.path}，保持 Lesson ID 不变。`,
      );
      return;
    }
    setFrontmatterField(this.root, lesson.path, 'status', 'abandoned');
    const tutor = this.sessions.get(`tutor:${lessonId}`);
    if (tutor) {
      await tutor.abort();
      tutor.dispose();
      this.sessions.delete(`tutor:${lessonId}`);
    }
    await coach.prompt(
      `学生要求重新备课。保留 ${lesson.path}，使用新的 Lesson ID 准备替代课程，并追加到 Plan Lesson Index。`,
    );
  }

  history(key: SessionKey, mode: MessageProjectionMode = 'safe'): ConversationItem[] {
    const session = this.sessions.get(key);
    if (!session) return [];
    return projectConversationEntries(key, session.entries, mode);
  }

  personaId(key: SessionKey): string {
    return this.sessions.get(key)?.personaId() ?? resolvePersona(this.root).id;
  }

  async setPersona(key: SessionKey, id: string): Promise<void> {
    const persona = resolvePersona(this.root, id);
    const session = await this.openSession(key);
    await session.setPersona(persona.id, persona.content);
  }

  subscribe(
    key: SessionKey,
    listener: Parameters<StudySession['subscribe']>[0],
  ): () => void {
    const session = this.sessions.get(key);
    if (!session) throw new Error(`SESSION_NOT_OPEN: ${key}`);
    return session.subscribe(listener);
  }

  subscribeWorkflows(
    key: SessionKey,
    listener: Parameters<StudySession['subscribeWorkflows']>[0],
  ): () => void {
    const session = this.sessions.get(key);
    if (!session) throw new Error(`SESSION_NOT_OPEN: ${key}`);
    return session.subscribeWorkflows(listener);
  }

  get(key: SessionKey): StudySession | undefined {
    return this.sessions.get(key);
  }

  dispose(): void {
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
  }

  openSession(key: SessionKey): Promise<StudySession> {
    if (key === ROADMAP_COACH_SESSION_KEY) return this.openRoadmapCoach();
    return key.startsWith('coach:')
      ? this.openCoach(key.slice(6))
      : this.openTutor(key.slice(6));
  }
}
