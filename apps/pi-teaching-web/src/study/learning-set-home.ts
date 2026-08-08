import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FreeLearningSessionSummary,
  LearningSetHomeSnapshot,
  MetaSessionSummary,
} from '../shared/contracts';
import { readKnowledge } from './knowledge';
import { listLearningNotes } from './learning-assets';
import { readCourseTree, readLearningSetGuide } from './markdown';

export function readLearningSetHome(
  root: string,
  recentFreeLearning: FreeLearningSessionSummary[] = [],
  recentMeta: MetaSessionSummary[] = [],
): LearningSetHomeSnapshot {
  const guide = readLearningSetGuide(root);
  const knowledge = readKnowledge(root);
  const hasCourse = existsSync(join(root, 'ROADMAP.md'));
  const course = hasCourse ? readCourseTree(root) : null;

  return {
    guide,
    hasCourse,
    course: course === null ? null : {
      title: course.roadmap.title,
      currentPosition: course.roadmap.currentPosition,
      route: '/course',
    },
    assets: {
      notes: listLearningNotes(root).length,
      problemCards: knowledge.cards.length,
      materials: knowledge.materials.length,
    },
    recentFreeLearning,
    recentMeta,
  };
}
