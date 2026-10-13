// Conversió dels elements de text de PDF.js a línies (amb mida de font i negreta).
// És independent del navegador: el mateix codi s'usa a l'app i a les proves de Node.

import type { DocumentPage, PdfLine } from '../types';

export interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
}

export interface PdfJsPageLike {
  getTextContent(): Promise<{ items: unknown[]; styles: Record<string, { fontFamily?: string }> }>;
}

export interface PdfJsDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfJsPageLike>;
}

/** Corregeix glifs especials habituals en PDF (ela geminada, lligadures tipogràfiques) */
export function fixGlyphs(s: string): string {
  return s
    .replace(/ŀ\s?l/g, 'l·l')
    .replace(/Ŀ\s?L/g, 'L·L')
    .replace(/ŀ/g, 'l·')
    .replace(/Ŀ/g, 'L·')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/\u00ad/g, '');
}

/** Agrupa elements de text en línies segons la coordenada vertical. */
export function itemsToLines(items: RawTextItem[], styles: Record<string, { fontFamily?: string }> = {}): PdfLine[] {
  type Acc = { y: number; parts: { x: number; str: string; size: number; bold: boolean; width: number }[] };
  const rows: Acc[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const [a, b, , , x, y] = it.transform;
    const size = Math.round(Math.hypot(a, b) * 10) / 10 || it.height || 10;
    const fam = `${it.fontName} ${styles[it.fontName]?.fontFamily ?? ''}`;
    const bold = /bold|black|heavy|semibold|-b\b|,b\b/i.test(fam) || /bold/i.test(it.fontName);
    const tol = Math.max(2, size * 0.4);
    let row = rows.find((r) => Math.abs(r.y - y) <= tol);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, str: it.str, size, bold, width: it.width });
  }
  rows.sort((r1, r2) => r2.y - r1.y);
  return rows.map((r) => {
    r.parts.sort((p1, p2) => p1.x - p2.x);
    let text = '';
    let prevEnd = -Infinity;
    for (const p of r.parts) {
      const gap = p.x - prevEnd;
      if (text && gap > p.size * 0.15 && !text.endsWith(' ') && !p.str.startsWith(' ')) text += ' ';
      text += p.str;
      prevEnd = p.x + p.width;
    }
    const totalLen = r.parts.reduce((s, p) => s + p.str.length, 0) || 1;
    const size = r.parts.reduce((s, p) => s + p.size * p.str.length, 0) / totalLen;
    const boldLen = r.parts.filter((p) => p.bold).reduce((s, p) => s + p.str.length, 0);
    return {
      text: fixGlyphs(text).replace(/\s+/g, ' ').trim(),
      size: Math.round(size * 10) / 10,
      bold: boldLen / totalLen > 0.6,
      y: Math.round(r.y),
      x: Math.round(Math.min(...r.parts.map((p) => p.x))),
    };
  }).filter((l) => l.text.length > 0);
}

export interface ExtractResult {
  pages: DocumentPage[];
  pageCount: number;
  textChars: number;
  pagesWithoutText: number[];
}

/** Extreu el text pàgina a pàgina. `onProgress` rep (pàgina, total). */
export async function extractFromPdfDoc(docId: string, pdf: PdfJsDocLike, onProgress?: (p: number, total: number) => void): Promise<ExtractResult> {
  const pages: DocumentPage[] = [];
  const empty: number[] = [];
  let chars = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const lines = itemsToLines(content.items as RawTextItem[], content.styles);
    const text = lines.map((l) => l.text).join('\n');
    const meaningful = text.replace(/\s/g, '').length;
    if (meaningful < 20) empty.push(n);
    chars += meaningful;
    pages.push({ id: `${docId}:${n}`, docId, pageNumber: n, text, lines, source: 'pdf' });
    onProgress?.(n, pdf.numPages);
  }
  return { pages, pageCount: pdf.numPages, textChars: chars, pagesWithoutText: empty };
}

/** Un PDF es considera escanejat si la majoria de pàgines no tenen text seleccionable. */
export function looksScanned(r: ExtractResult): boolean {
  if (!r.pageCount) return true;
  return r.pagesWithoutText.length / r.pageCount >= 0.6 || r.textChars < 80 * r.pageCount * 0.2;
}
