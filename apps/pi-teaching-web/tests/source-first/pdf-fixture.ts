import { writeFileSync } from 'node:fs';

function pdfObject(id: number, body: string): string {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function streamObject(id: number, body: string): string {
  return pdfObject(id, `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`);
}

export function writeThreePageBook(path: string, options: { emptyPages?: number[] } = {}): void {
  const content = (page: number, text: string, line: string) => (
    options.emptyPages?.includes(page) ? line : `BT /F1 24 Tf 40 120 Td (${text}) Tj ET\n${line}`
  );
  const objects = [
    pdfObject(1, '<< /Type /Catalog /Pages 2 0 R /Outlines 10 0 R /PageLabels 13 0 R >>'),
    pdfObject(2, '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>'),
    pdfObject(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R >>'),
    streamObject(4, content(1, 'PAGE ONE', '20 20 m 280 180 l S')),
    pdfObject(5, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>'),
    streamObject(6, content(2, 'PAGE TWO', '20 180 m 280 20 l S')),
    pdfObject(7, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>'),
    streamObject(8, content(3, 'PAGE THREE', '20 100 m 280 100 l S')),
    pdfObject(9, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    pdfObject(10, '<< /Type /Outlines /First 11 0 R /Last 12 0 R /Count 3 >>'),
    pdfObject(11, '<< /Title (Chapter One) /Parent 10 0 R /Dest [3 0 R /Fit] /First 14 0 R /Last 14 0 R /Count 1 /Next 12 0 R >>'),
    pdfObject(12, '<< /Title (Chapter Two) /Parent 10 0 R /Dest [7 0 R /Fit] /Prev 11 0 R >>'),
    pdfObject(13, '<< /Nums [0 << /P (Cover) >> 1 << /S /D /St 1 >>] >>'),
    pdfObject(14, '<< /Title (Section One) /Parent 11 0 R /Dest [5 0 R /Fit] >>'),
  ];
  let source = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(source, 'binary'));
    source += object;
  }
  const xref = Buffer.byteLength(source, 'binary');
  source += `xref\n0 ${objects.length + 1}\n`;
  source += '0000000000 65535 f \n';
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(path, Buffer.from(source, 'binary'));
}
