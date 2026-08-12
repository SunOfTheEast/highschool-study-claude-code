export type ReadingSize = 'standard' | 'large';

type ReadingStorage = Pick<Storage, 'getItem' | 'setItem'>;
type ReadingRoot = { dataset: Record<string, string | undefined> };

export const READING_SIZE_STORAGE_KEY = 'studyforge.reading-size';

export function readStoredReadingSize(storage: Pick<ReadingStorage, 'getItem'>): ReadingSize {
  return storage.getItem(READING_SIZE_STORAGE_KEY) === 'large' ? 'large' : 'standard';
}

export function applyReadingSize(
  value: ReadingSize,
  storage: ReadingStorage,
  root: ReadingRoot,
): void {
  storage.setItem(READING_SIZE_STORAGE_KEY, value);
  root.dataset.readingSize = value;
}

export function initializeReadingSize(storage: ReadingStorage, root: ReadingRoot): ReadingSize {
  const value = readStoredReadingSize(storage);
  root.dataset.readingSize = value;
  return value;
}
