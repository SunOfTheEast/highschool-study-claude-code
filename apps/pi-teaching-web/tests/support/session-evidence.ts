import type { SessionEvidenceReader } from '../../src/study/evidence-tree';

export function fakeSessionEvidenceReader(
  messages: Record<
    string,
    { role: 'student' | 'coach' | 'tutor'; text: string }
  > = {},
): SessionEvidenceReader {
  return {
    readSession: () => null,
    readMessage: (source) => messages[source] ?? null,
  };
}
