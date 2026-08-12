import type { LearningContextReference } from '../shared/contracts';
import { formatMaterialLocator } from './material-locator';
import type { CarriedContextItem } from './pages/FreeLearningPage';

type ContextLoaders = {
  note(id: string): Promise<{ title: string; revision: number }>;
  problemCard(id: string): Promise<{
    title: string;
    revision: number;
    activity: { latestAttempt: unknown | null };
  }>;
  material(id: string): Promise<{
    material: { revisions: Array<{ revision: number; title: string }> };
  }>;
};

export function materialPagesForContext(locator: string | null): number[] {
  const page = /^page-([0-9]{4})$/.exec(locator ?? '');
  if (page) return [Number(page[1])];
  const range = /^pages-([0-9]{4})-([0-9]{4})$/.exec(locator ?? '');
  if (!range) return [];
  const start = Number(range[1]);
  const end = Number(range[2]);
  if (start < 1 || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

export async function loadFreeLearningContexts(
  references: readonly LearningContextReference[],
  loaders: ContextLoaders,
): Promise<CarriedContextItem[]> {
  return Promise.all(references.map(async (reference) => {
    if (reference.kind === 'material') {
      const value = await loaders.material(reference.id);
      const revision = value.material.revisions.find((candidate) => (
        candidate.revision === reference.revision
      ));
      return {
        key: `material:${reference.id}@${reference.revision}#${reference.locator ?? ''}`,
        kind: '资料',
        title: revision?.title ?? reference.id,
        detail: `第 ${reference.revision} 版 · ${formatMaterialLocator(reference.locator).human}`,
      };
    }
    if (reference.kind === 'note') {
      const value = await loaders.note(reference.id);
      return {
        key: `note:${reference.id}`,
        kind: '笔记',
        title: value.title,
        detail: `第 ${value.revision} 版`,
      };
    }
    const value = await loaders.problemCard(reference.id);
    return {
      key: `problem-card:${reference.id}`,
      kind: '题卡',
      title: value.title,
      detail: `第 ${value.revision} 版 · ${
        value.activity.latestAttempt ? '已有作答' : '尚未作答'
      }`,
    };
  }));
}
