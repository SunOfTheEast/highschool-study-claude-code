import type { ReactNode } from 'react';
import type { CourseViewProjection } from '../../shared/view-contracts';

export type CoursePageProps = {
  value: CourseViewProjection;
  children?: ReactNode;
};

export function CoursePage({ value, children }: CoursePageProps) {
  return (
    <main className="coordinate-page course-page" aria-label="课程脉络">
      <h1>{value.learningSet.title}</h1>
      <p>{value.learningSet.overview}</p>
      {children}
    </main>
  );
}

export default CoursePage;
