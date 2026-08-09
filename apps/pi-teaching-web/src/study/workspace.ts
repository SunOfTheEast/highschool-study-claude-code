import type { CourseSnapshot, CourseTreeNode } from '../shared/contracts';
import {
  readCourseTree,
  readLesson,
  readPlan,
  StudyDocumentError,
} from './markdown';

function findNode(node: CourseTreeNode, path: string): CourseTreeNode | null {
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}

export function readWorkspace(
  root: string,
  selectedPath: string | null = 'ROADMAP.md',
): CourseSnapshot {
  const course = readCourseTree(root);
  if (selectedPath === null) return course;
  const node = findNode(course.tree, selectedPath);
  if (!node) throw new StudyDocumentError(selectedPath, 'document is not linked from ROADMAP.md');
  const selected = node.kind === 'roadmap'
    ? course.roadmap
    : node.kind === 'plan'
      ? readPlan(root, node.path)
      : readLesson(root, node.path);
  return { ...course, selected };
}
