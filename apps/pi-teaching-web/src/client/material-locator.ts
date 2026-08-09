export type MaterialLocatorLabel = {
  human: string;
  canonical: string;
};

export function formatMaterialLocator(locator: string | null): MaterialLocatorLabel {
  if (locator === null || locator === 'whole') {
    return { human: '完整资料', canonical: 'whole' };
  }
  const page = /^page-([0-9]{4})$/.exec(locator);
  if (page) return { human: `第 ${Number(page[1])} 页`, canonical: locator };
  const lines = /^lines-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(locator);
  if (lines) return { human: `第 ${lines[1]}–${lines[2]} 行`, canonical: locator };
  return { human: locator, canonical: locator };
}
