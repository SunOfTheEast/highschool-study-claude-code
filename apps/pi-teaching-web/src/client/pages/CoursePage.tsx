import type { ReactNode } from 'react';
import type {
  CourseTreeNode,
  CourseViewProjection,
} from '../../shared/view-contracts';
import { CourseInspector, type LessonCourseAction } from '../components/CourseInspector';
import { CourseTree } from '../components/CourseTree';
import { PlanStage } from '../components/PlanStage';

function findNode(
  root: CourseTreeNode,
  key: string | null,
): CourseTreeNode | null {
  if (root.key === key) return root;
  for (const child of root.children) {
    const found = findNode(child, key);
    if (found) return found;
  }
  return null;
}

export type CoursePageProps = {
  value: CourseViewProjection;
  coachPanel?: ReactNode;
  selectedKey?: string | null;
  onNodeSelect?(node: CourseTreeNode): void;
  onLessonAction?(action: LessonCourseAction): void;
  onKnowledge?(): void;
  onMemory?(): void;
};

export function CoursePage({
  value,
  coachPanel = null,
  selectedKey = null,
  onNodeSelect = () => {},
  onLessonAction = () => {},
  onKnowledge = () => {},
  onMemory = () => {},
}: CoursePageProps) {
  const selected = findNode(value.roadmap, selectedKey) ?? value.roadmap;
  return (
    <main className="coordinate-page course-page course-workspace" aria-label="课程脉络">
      <CourseTree
        root={value.roadmap}
        selectedKey={selected.key}
        onSelect={onNodeSelect}
      />
      <PlanStage value={value} coachPanel={coachPanel} />
      <CourseInspector
        value={value}
        selected={selected}
        onLessonAction={onLessonAction}
        onKnowledge={onKnowledge}
        onMemory={onMemory}
      />
    </main>
  );
}

export default CoursePage;
