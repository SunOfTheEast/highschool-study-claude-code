import type {
  CourseSnapshot,
  KnowledgeSnapshot,
  LessonDocument,
  PlanDocument,
  RoadmapDocument,
} from './contracts';

export type CourseViewProjection = CourseSnapshot;
export type KnowledgeViewProjection = KnowledgeSnapshot;

export type SelectedCourseDocument =
  | RoadmapDocument
  | PlanDocument
  | LessonDocument;
