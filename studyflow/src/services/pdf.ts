// Processament de PDF al navegador amb PDF.js (i OCR opcional amb Tesseract.js).
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db } from '../db/db';
import { extractFromPdfDoc, looksScanned, type PdfJsDocLike } from '../lib/pdfText';
import { detectOutline } from '../lib/structure';
import type { DocumentPage, PdfLine, StudyDocument } from '../types';
import { uid } from '../lib/text';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_PDF_BYTES = 80 * 1024 * 1024;

async function openPdf(blob: Blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

/** Desa un PDF nou. El fitxer es conserva encara que el processament falli. */
export async function addDocument(subjectId: string, file: File): Promise<StudyDocument> {
  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error(`«${file.name}» no és un PDF.`);
  if (file.size > MAX_PDF_BYTES) throw new Error(`«${file.name}» supera la mida màxima (${MAX_PDF_BYTES / 1024 / 1024} MB).`);
  const doc: StudyDocument = { id: uid('doc'), subjectId, name: file.name, size: file.size, status: 'pending', createdAt: Date.now() };
  await db.transaction('rw', db.documents, db.blobs, async () => {
    await db.documents.add(doc);
    await db.blobs.put({ id: doc.id, data: file });
  });
  return doc;
}

export type Progress = (msg: string, fraction?: number) => void;

/** Extreu el text i detecta l'estructura. No marca el document com a processat si l'extracció falla. */
export async function processDocument(docId: string, onProgress?: Progress): Promise<StudyDocument> {
  const doc = await db.documents.get(docId);
  const blob = await db.blobs.get(docId);
  if (!doc) throw new Error('Document no trobat');
  if (!blob) {
    await db.documents.update(docId, { status: 'error', error: 'No s’ha trobat el fitxer PDF desat. Torna’l a pujar.' });
    throw new Error('Fitxer PDF no disponible');
  }
  await db.documents.update(docId, { status: 'processing', error: undefined });
  try {
    onProgress?.('Obrint el PDF…', 0);
    const pdf = await openPdf(blob.data);
    const res = await extractFromPdfDoc(docId, pdf as unknown as PdfJsDocLike, (p, t) => onProgress?.(`Extraient text: pàgina ${p} de ${t}`, p / t));
    if (looksScanned(res)) {
      await db.transaction('rw', db.pages, db.documents, async () => {
        await db.pages.where('docId').equals(docId).delete();
        await db.documents.update(docId, {
          status: 'needs_ocr',
          pageCount: res.pageCount,
          textChars: res.textChars,
          pagesWithoutText: res.pagesWithoutText,
          error: 'El PDF no conté text seleccionable (sembla escanejat). Cal aplicar OCR per extreure’n el text.',
        });
      });
      return (await db.documents.get(docId))!;
    }
    const outline = detectOutline(res.pages);
    await db.transaction('rw', db.pages, db.documents, async () => {
      await db.pages.where('docId').equals(docId).delete();
      await db.pages.bulkPut(res.pages);
      await db.documents.update(docId, {
        status: 'processed',
        pageCount: res.pageCount,
        textChars: res.textChars,
        pagesWithoutText: res.pagesWithoutText,
        outline,
        textSource: 'pdf',
        processedAt: Date.now(),
        error: res.pagesWithoutText.length ? `${res.pagesWithoutText.length} pàgines no tenen text seleccionable (${res.pagesWithoutText.slice(0, 10).join(', ')}${res.pagesWithoutText.length > 10 ? '…' : ''}).` : undefined,
      });
    });
    onProgress?.('Fet', 1);
    return (await db.documents.get(docId))!;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const friendly = /password/i.test(msg) ? 'El PDF està protegit amb contrasenya.' : /Invalid PDF|corrupt/i.test(msg) ? 'El fitxer està malmès o no és un PDF vàlid.' : msg;
    await db.documents.update(docId, { status: 'error', error: `No s’ha pogut extreure el text: ${friendly}` });
    throw new Error(friendly);
  }
}

/**
 * OCR opcional amb Tesseract.js. Tot el reconeixement es fa al navegador: el document NO s'envia enlloc.
 * La primera vegada es descarreguen els models d'idioma (~10-20 MB) des d'un CDN públic.
 */
export async function ocrDocument(docId: string, langs = 'cat+spa+eng', onProgress?: Progress): Promise<StudyDocument> {
  const blob = await db.blobs.get(docId);
  if (!blob) throw new Error('Fitxer PDF no disponible');
  await db.documents.update(docId, { status: 'processing', error: undefined });
  try {
    onProgress?.('Carregant el motor d’OCR (la primera vegada descarrega els models d’idioma)…', 0);
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(langs);
    const pdf = await openPdf(blob.data);
    const pages: DocumentPage[] = [];
    let chars = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress?.(`OCR: pàgina ${n} de ${pdf.numPages}`, (n - 1) / pdf.numPages);
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const lines: PdfLine[] = [];
      for (const b of data.blocks ?? [])
        for (const p of b.paragraphs)
          for (const l of p.lines) {
            const h = (l.bbox.y1 - l.bbox.y0) / 2; // escala 2 → punts aproximats
            lines.push({ text: l.text.trim(), size: Math.round(h * 0.75 * 10) / 10, bold: false, y: -l.bbox.y0, x: l.bbox.x0 / 2 });
          }
      const text = lines.map((l) => l.text).join('\n');
      chars += text.replace(/\s/g, '').length;
      pages.push({ id: `${docId}:${n}`, docId, pageNumber: n, text, lines: lines.filter((l) => l.text), source: 'ocr' });
    }
    await worker.terminate();
    if (chars < 50) throw new Error('L’OCR no ha reconegut text suficient.');
    const outline = detectOutline(pages);
    await db.transaction('rw', db.pages, db.documents, async () => {
      await db.pages.where('docId').equals(docId).delete();
      await db.pages.bulkPut(pages);
      await db.documents.update(docId, {
        status: 'processed',
        pageCount: pdf.numPages,
        textChars: chars,
        outline,
        textSource: 'ocr',
        processedAt: Date.now(),
        error: 'Text obtingut per OCR: pot contenir errors de reconeixement. Revisa’l abans d’estudiar.',
      });
    });
    return (await db.documents.get(docId))!;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.documents.update(docId, { status: 'needs_ocr', error: `L’OCR ha fallat: ${msg}. Pots tornar-ho a provar o pujar una versió del PDF amb text.` });
    throw e;
  }
}

/** Renderitza una pàgina del PDF original (per consultar-la des de la teoria). */
export async function renderPage(docId: string, pageNumber: number, canvas: HTMLCanvasElement, width = 800): Promise<void> {
  const blob = await db.blobs.get(docId);
  if (!blob) throw new Error('PDF no disponible');
  const pdf = await openPdf(blob.data);
  const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages));
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
}
