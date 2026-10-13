import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractFromPdfDoc, looksScanned, type PdfJsDocLike } from '../src/lib/pdfText';
import { detectOutline, buildStructure } from '../src/lib/structure';
import { buildExtractiveTheory, analyzeSource } from '../src/lib/theory';
import { generateLocalQuestions, topicContext } from '../src/lib/questions';
import { checkQuestions } from '../src/lib/quality';
import { buildExam } from '../src/lib/exam';
import { fragmentInSource } from '../src/lib/text';

async function load(path: string) {
  const data = new Uint8Array(readFileSync(path));
  const pdf = await getDocument({ data, useSystemFonts: false, isEvalSupported: false }).promise;
  return extractFromPdfDoc('doc1', pdf as unknown as PdfJsDocLike);
}

describe('pipeline PDF real → estructura → teoria → preguntes → examen', () => {
  it('extreu text i detecta l’estructura de temes i apartats', async () => {
    const r = await load('e2e/fixtures/apunts-dret-administratiu.pdf');
    expect(r.pageCount).toBeGreaterThanOrEqual(2);
    expect(looksScanned(r)).toBe(false);
    const outline = detectOutline(r.pages);
    const l1 = outline.filter((n) => n.level === 1).map((n) => n.title);
    const l2 = outline.filter((n) => n.level === 2).map((n) => n.title);
    expect(l1.some((t) => /Tema 1/.test(t))).toBe(true);
    expect(l1.some((t) => /Tema 2/.test(t))).toBe(true);
    expect(l2.some((t) => /1\.1/.test(t))).toBe(true);
    expect(l2.some((t) => /2\.3/.test(t))).toBe(true);
    // el peu de pàgina repetit no és un títol
    expect(outline.some((n) => /Apunts d’exemple/.test(n.title))).toBe(false);
    expect(buildStructure(r.pages, outline, 'a.pdf').flatMap((t) => t.sections).some((s) => /Apunts d’exemple/.test(s.sourceText))).toBe(false);

    const topics = buildStructure(r.pages, outline, 'apunts.pdf');
    const t1 = topics.find((t) => /Tema 1/.test(t.title))!;
    const t2 = topics.find((t) => /Tema 2/.test(t.title))!;
    expect(t1.sections.map((s) => s.title)).toEqual(expect.arrayContaining([expect.stringMatching(/1\.1/), expect.stringMatching(/1\.2/), expect.stringMatching(/1\.3/)]));
    expect(t2.sections.length).toBeGreaterThanOrEqual(3);
    const s12 = t1.sections.find((s) => /1\.2/.test(s.title))!;
    expect(s12.sourceText).toMatch(/\[\[p:\d+\]\]/);
    expect(s12.sourceText).toMatch(/notificació/);

    // teoria
    const th = buildExtractiveTheory(s12.title, s12.sourceText);
    const defs = th.blocks.filter((b) => b.kind === 'definition').map((b) => (b as { term: string }).term);
    expect(defs).toEqual(expect.arrayContaining(['notificació', 'eficàcia', 'publicació']));
    expect(th.blocks.some((b) => b.kind === 'legal')).toBe(true);
    expect(th.blocks.some((b) => b.kind === 'example')).toBe(true);
    expect(th.blocks.every((b) => b.pages.length > 0)).toBe(true);

    const s11 = t1.sections.find((s) => /1\.1/.test(s.title))!;
    const f11 = analyzeSource(s11.sourceText);
    expect(f11.lists.length).toBeGreaterThanOrEqual(1);
    expect(f11.lists[0].items.length).toBe(4);

    // preguntes
    const inputs = t1.sections.map((s, i) => ({ id: `s${i}`, subjectId: 'sub', topicId: 't1', title: s.title, sourceText: s.sourceText }));
    const all = inputs.flatMap((s) => generateLocalQuestions(s, topicContext(inputs, s.id)));
    const src = Object.fromEntries(inputs.map((s) => [s.id, s.sourceText]));
    const { questions } = checkQuestions(all, src);
    expect(questions.length).toBeGreaterThan(15);
    const types = new Set(questions.map((q) => q.type));
    for (const t of ['mcq', 'truefalse', 'cloze', 'short', 'matching', 'difference']) expect(types.has(t as never)).toBe(true);
    for (const q of questions) {
      expect(q.explanation.length).toBeGreaterThan(5);
      expect(fragmentInSource(src[q.sectionId], q.source.excerpt)).toBe(true);
      if (q.type === 'mcq') {
        expect(new Set(q.options).size).toBe(q.options!.length);
        expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(questions.some((q) => q.pool === 'exam')).toBe(true);
    expect(questions.some((q) => q.pool === 'practice')).toBe(true);
    // pregunta sobre un termini legal (xifra exacta)
    expect(questions.some((q) => q.template === 'num-cloze' && q.answer === '10')).toBe(true);

    // examen: cobreix tots els apartats i no repeteix preguntes
    const exam = buildExam(questions, { questionCount: 20, durationMinutes: null, difficulty: 'mixed' }, { practicedIds: new Set(), examUses: new Map() }, 42);
    expect(exam.questions.length).toBeGreaterThan(10);
    expect(new Set(exam.questions.map((q) => q.id)).size).toBe(exam.questions.length);
    expect(new Set(exam.questions.map((q) => q.sectionId)).size).toBe(inputs.length);
    // segon examen: prioritza preguntes noves
    const uses = new Map(exam.questions.map((q) => [q.id, 1]));
    const exam2 = buildExam(questions, { questionCount: 10, durationMinutes: null, difficulty: 'mixed' }, { practicedIds: new Set(), examUses: uses }, 7);
    const overlap = exam2.questions.filter((q) => uses.has(q.id)).length;
    expect(overlap).toBeLessThan(exam2.questions.length);
  });

  it('detecta un PDF escanejat sense text', async () => {
    const r = await load('e2e/fixtures/escanejat.pdf');
    expect(looksScanned(r)).toBe(true);
  });
});

describe('neteja de text', () => {
  it('normalitza la ela geminada i les lligadures', async () => {
    const { fixGlyphs } = await import('../src/lib/pdfText');
    expect(fixGlyphs('nuŀlitat i anuŀlabilitat ﬁ')).toBe('nul·litat i anul·labilitat fi');
  });
});
