import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FreeLearningSessionSummary,
  LearningSetGuide,
  LearningSetHomeSnapshot,
  MetaSessionSummary,
  StudentLearningSetGuide,
} from '../shared/contracts';
import { countKnowledgeMaterials } from './knowledge';
import { countCurrentProblemCardFiles, listLearningNotes } from './learning-assets';
import { readMaterialBookIndex } from './material-book-index';
import { listMaterials } from './materials';
import { readCourseTree, readLearningSetGuide } from './markdown';
import { projectActiveLesson } from './display-projections';

function studentGuide(guide: LearningSetGuide): StudentLearningSetGuide {
  const lines = guide.body.split(/\r?\n/);
  const h1 = lines.findIndex((line) => /^#\s+/.test(line));
  const firstH2 = lines.findIndex((line) => /^##\s+/.test(line));
  const publicH2 = lines.findIndex((line) => (
    line.trim() === '## Student Learning Principles'
  ));
  const nextH2 = publicH2 < 0
    ? -1
    : lines.findIndex((line, index) => index > publicH2 && /^##\s+/.test(line));

  return {
    title: guide.title,
    introduction: lines
      .slice(h1 < 0 ? 0 : h1 + 1, firstH2 < 0 ? lines.length : firstH2)
      .join('\n')
      .trim(),
    principles: publicH2 < 0
      ? ''
      : lines
        .slice(publicH2 + 1, nextH2 < 0 ? lines.length : nextH2)
        .join('\n')
        .trim(),
  };
}

export function readLearningSetHome(
  root: string,
  recentFreeLearning: FreeLearningSessionSummary[] = [],
  recentMeta: MetaSessionSummary[] = [],
): LearningSetHomeSnapshot {
  const guide = readLearningSetGuide(root);
  const hasCourse = existsSync(join(root, 'ROADMAP.md'));
  const course = hasCourse ? readCourseTree(root) : null;
  const books = listMaterials(root).flatMap((material) => {
    const revision = material.revisions.find((candidate) => (
      candidate.revision === material.currentRevision
    ));
    if (!revision || revision.mediaType !== 'application/pdf') return [];
    const index = readMaterialBookIndex(root, material.id, revision.revision);
    return [{
      id: material.id,
      revision: revision.revision,
      title: revision.title,
      pageCount: index?.pageCount ?? null,
      outlineCount: index?.outline.length ?? 0,
      processedPages: index?.pages.filter((page) => (
        page.state === 'native-text' || page.state === 'visual-text'
      )).length ?? 0,
      route: `/assets/books/${encodeURIComponent(material.id)}`,
      importedAt: revision.importedAt,
    }];
  }).sort((left, right) => right.importedAt.localeCompare(left.importedAt))
    .map(({ importedAt: _importedAt, ...book }) => book);

  return {
    guide: studentGuide(guide),
    hasCourse,
    course: course === null ? null : {
      title: course.roadmap.title,
      route: '/course',
      activeLesson: projectActiveLesson(course.tree),
    },
    assets: {
      notes: listLearningNotes(root).length,
      problemCards: countCurrentProblemCardFiles(root),
      materials: countKnowledgeMaterials(root),
    },
    books,
    recentFreeLearning,
    recentMeta,
  };
}
