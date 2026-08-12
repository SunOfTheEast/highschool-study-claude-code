import type { MaterialLocator } from '../shared/contracts';

export type MaterialLocatorBounds = {
  pageCount?: number;
  lineCount?: number;
};

function positive(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error('MATERIAL_LOCATOR_INVALID');
  }
  return parsed;
}

function checkedRange(
  kind: 'lines' | 'pages',
  startText: string,
  endText: string,
  bounds: MaterialLocatorBounds,
): MaterialLocator {
  const start = positive(startText);
  const end = positive(endText);
  if (start > end) throw new Error('MATERIAL_LOCATOR_INVALID');
  const maximum = kind === 'pages' ? bounds.pageCount : bounds.lineCount;
  if (maximum !== undefined && end > maximum) {
    throw new Error('MATERIAL_LOCATOR_NOT_FOUND');
  }
  return { kind, start, end };
}

export function parseMaterialLocator(
  value: string | null,
  bounds: MaterialLocatorBounds = {},
): MaterialLocator {
  if (value === null || value === 'whole') return { kind: 'whole' };
  const lines = /^lines-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(value);
  if (lines) return checkedRange('lines', lines[1]!, lines[2]!, bounds);
  const page = /^page-([0-9]{4})$/.exec(value);
  if (page) return checkedRange('pages', page[1]!, page[1]!, bounds);
  const pages = /^pages-([0-9]{4})-([0-9]{4})$/.exec(value);
  if (pages) return checkedRange('pages', pages[1]!, pages[2]!, bounds);
  throw new Error('MATERIAL_LOCATOR_INVALID');
}

function pageNumber(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1 || value > 9_999) {
    throw new Error('MATERIAL_LOCATOR_INVALID');
  }
  return String(value).padStart(4, '0');
}

export function formatMaterialLocatorValue(locator: MaterialLocator): string | null {
  if (locator.kind === 'whole') return null;
  if (
    !Number.isSafeInteger(locator.start)
    || !Number.isSafeInteger(locator.end)
    || locator.start < 1
    || locator.start > locator.end
  ) throw new Error('MATERIAL_LOCATOR_INVALID');
  if (locator.kind === 'lines') return `lines-${locator.start}-${locator.end}`;
  const start = pageNumber(locator.start);
  const end = pageNumber(locator.end);
  return locator.start === locator.end ? `page-${start}` : `pages-${start}-${end}`;
}
