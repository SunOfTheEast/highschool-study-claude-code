export type SessionRole = 'coach' | 'tutor';

export type StudySessionScope = {
  role: SessionRole;
  ownerId: string;
  ownerPath: string;
};

export const ROADMAP_COACH_SCOPE = {
  role: 'coach',
  ownerId: '@roadmap',
  ownerPath: 'ROADMAP.md',
} as const satisfies StudySessionScope;

export function isRoadmapCoachScope(scope: StudySessionScope): boolean {
  return scope.role === ROADMAP_COACH_SCOPE.role
    && scope.ownerId === ROADMAP_COACH_SCOPE.ownerId
    && scope.ownerPath === ROADMAP_COACH_SCOPE.ownerPath;
}

export function formatSessionOwnerContext(root: string, scope: StudySessionScope): string {
  const owner = isRoadmapCoachScope(scope)
    ? `Current Coach: ${scope.ownerId}\nCurrent Roadmap file: ${scope.ownerPath}`
    : scope.role === 'coach'
      ? `Current Coach: ${scope.ownerId}\nCurrent Plan file: ${scope.ownerPath}`
      : `Current Tutor: ${scope.ownerId}\nCurrent Lesson file: ${scope.ownerPath}`;
  return `Learning set root: ${root}\n${owner}`;
}
