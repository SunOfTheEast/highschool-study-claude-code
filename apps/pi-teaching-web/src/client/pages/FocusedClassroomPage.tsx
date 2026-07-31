import type { ReactNode } from 'react';

export type FocusedClassroomPageProps = {
  children?: ReactNode;
};

export function FocusedClassroomPage({
  children,
}: FocusedClassroomPageProps) {
  return (
    <main className="focused-classroom" aria-label="专注课堂">
      {children ?? <p>正在整理当前课堂…</p>}
    </main>
  );
}

export default FocusedClassroomPage;
