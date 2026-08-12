import type {
  LearningSourceReference,
  MaterialBookIndex,
  MaterialBookOutlineNode,
  MaterialLocator,
  MaterialSourceLabel,
} from '../shared/contracts';
import { parseMaterialLocator } from './material-locators';
import { readMaterialBookIndex } from './material-book-index';
import { readMaterialRevision } from './materials';

type MaterialSource = Extract<LearningSourceReference, { kind: 'material' }>;

function pageLabel(start: number, end: number): string {
  return start === end ? `第 ${start} 页` : `第 ${start}–${end} 页`;
}

export function materialSourceOutline(
  index: MaterialBookIndex,
  locator: MaterialLocator,
): MaterialBookOutlineNode | null {
  if (locator.kind !== 'pages') return null;
  return index.outline
    .filter((node) => (
      node.startPage !== null
      && node.endPage !== null
      && node.startPage <= locator.start
      && node.endPage >= locator.end
    ))
    .sort((left, right) => (
      right.level - left.level
      || (left.endPage! - left.startPage!) - (right.endPage! - right.startPage!)
    ))[0] ?? null;
}

export function materialSourceRoute(source: MaterialSource): string {
  const locator = source.locator ?? 'whole';
  return `/assets/books/${encodeURIComponent(source.id)}/read/${source.revision}/${
    encodeURIComponent(locator)
  }`;
}

export function resolveMaterialSourceLabel(root: string, source: MaterialSource): MaterialSourceLabel {
  const revision = readMaterialRevision(root, source.id, source.revision);
  const index = readMaterialBookIndex(root, source.id, source.revision);
  const locator = parseMaterialLocator(source.locator);
  const page = locator.kind === 'pages' ? pageLabel(locator.start, locator.end) : null;
  const chapter = index ? materialSourceOutline(index, locator) : null;
  const position = chapter?.title ?? page;
  const label = [`《${revision.title}》`, position, chapter && page ? page : null]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  return { source, label, route: materialSourceRoute(source) };
}

export function resolveMaterialSourceLabels(
  root: string,
  sources: readonly LearningSourceReference[],
): MaterialSourceLabel[] {
  return sources.flatMap((source) => (
    source.kind === 'material' ? [resolveMaterialSourceLabel(root, source)] : []
  ));
}
