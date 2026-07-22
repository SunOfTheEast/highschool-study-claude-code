export type SessionRole = 'coach' | 'tutor';

export type StudySessionScope = {
  role: SessionRole;
  ownerId: string;
  ownerPath: string;
};

export function formatSessionOwnerContext(root: string, scope: StudySessionScope): string {
  const owner = scope.role === 'coach'
    ? `Current Coach: ${scope.ownerId}\nCurrent Plan file: ${scope.ownerPath}`
    : `Current Tutor: ${scope.ownerId}\nCurrent Lesson file: ${scope.ownerPath}`;
  return `Learning set root: ${root}\n${owner}`;
}
