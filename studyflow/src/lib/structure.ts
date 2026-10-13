// Detecció de l'estructura (temes i subtemes) a partir de les línies extretes del PDF.
// Heurística transparent: numeració, paraules clau (Tema, Capítol...), mida i gruix de la font,
// majúscules. Cada node indica el motiu i una confiança perquè l'usuari ho pugui revisar.

import type { DocumentPage, OutlineNode, PdfLine } from '../types';
import { normalize, uid } from './text';

const KEYWORD_L1 =
  /^(tema|unitat|unidad|cap[ií]tol|cap[ií]tulo|chapter|unit|lli[cç][oó]|lecci[oó]n|bloc|bloque|part|parte|m[oò]dul|m[oó]dulo|t[ií]tol|t[ií]tulo)\s+([0-9]+|[IVXLC]+)\b[.:\-–—]?\s*(.*)$/i;
const NUM_L1 = /^(\d{1,2})[.)]?\s+(\p{Lu}.{2,})$/u;
const NUM_L2 = /^(\d{1,2})\.(\d{1,2})\.?\s+(\S.{1,})$/u;
const NUM_L3 = /^(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.?\s+(\S.{1,})$/u;
const ROMAN_L1 = /^([IVXLC]{1,6})[.)]\s+(\p{Lu}.{2,})$/u;
const TOC_LINE = /(\.{4,}|…{2,}|\s{2,}\.\s?\.)\s*\d+\s*$/;
const PAGE_NUM = /^(p[àá]g(ina)?\.?\s*)?\d{1,4}(\s*(\/|de|of)\s*\d{1,4})?$/i;

export interface DetectOptions {
  maxHeadingLength?: number;
}

/** Línies repetides a moltes pàgines (capçaleres/peus) o números de pàgina */
export function findBoilerplate(pages: DocumentPage[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    const edge = [...p.lines.slice(0, 3), ...p.lines.slice(-3)];
    for (const l of edge) {
      const k = normalize(l.text.replace(/\d+/g, '#'));
      if (k && !seen.has(k)) {
        seen.add(k);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  const out = new Set<string>();
  const threshold = Math.max(2, Math.ceil(pages.length * 0.4));
  counts.forEach((c, k) => {
    if (c >= threshold && pages.length >= 2) out.add(k);
  });
  return out;
}

export function isBoilerplate(line: PdfLine, boiler: Set<string>): boolean {
  const t = line.text.trim();
  if (!t) return true;
  if (PAGE_NUM.test(t)) return true;
  return boiler.has(normalize(t.replace(/\d+/g, '#')));
}

export function bodyFontSize(pages: DocumentPage[]): number {
  const weights = new Map<number, number>();
  for (const p of pages)
    for (const l of p.lines) {
      const s = Math.round(l.size * 2) / 2;
      weights.set(s, (weights.get(s) ?? 0) + l.text.length);
    }
  let best = 10;
  let bestW = -1;
  weights.forEach((w, s) => {
    if (w > bestW) {
      bestW = w;
      best = s;
    }
  });
  return best;
}

function looksLikeSentence(t: string): boolean {
  return /[.;,:]$/.test(t) && !/^\d/.test(t);
}

function isAllCaps(t: string): boolean {
  const letters = t.replace(/[^\p{L}]/gu, '');
  return letters.length >= 4 && letters === letters.toUpperCase() && /\p{Lu}/u.test(letters);
}

function isTocPage(p: DocumentPage): boolean {
  const toc = p.lines.filter((l) => TOC_LINE.test(l.text)).length;
  return toc >= 3 && toc >= p.lines.length * 0.3;
}

export function cleanTitle(t: string): string {
  return t.replace(/\s+/g, ' ').replace(/[.:\s]+$/, '').trim();
}

/** Classifica una línia com a possible títol */
export function classifyLine(
  line: PdfLine,
  body: number,
  maxLen = 110,
): { level: 0 | 1 | 2; confidence: number; reason: string } | null {
  const t = line.text.trim();
  if (t.length < 3 || t.length > maxLen) return null;
  if (TOC_LINE.test(t)) return null;
  if (/^[•·\-–—*▪◦●]/.test(t)) return null;
  if (/^[a-z]\)\s/.test(t)) return null;
  const bigger = line.size >= body * 1.15;
  const much = line.size >= body * 1.4;

  let m = t.match(KEYWORD_L1);
  if (m) return { level: 1, confidence: 0.95, reason: 'Paraula clau de capítol/tema' };
  if (NUM_L3.test(t)) {
    if (looksLikeSentence(t) && !bigger) return null;
    return { level: 0, confidence: 0.5, reason: 'Numeració de tercer nivell (s’inclou dins l’apartat)' };
  }
  m = t.match(NUM_L2);
  if (m && !looksLikeSentence(t) && t.length <= 100)
    return { level: 2, confidence: bigger || line.bold ? 0.9 : 0.7, reason: 'Numeració de segon nivell (1.1)' };
  m = t.match(NUM_L1);
  if (m && !looksLikeSentence(t) && t.length <= 90 && (bigger || line.bold || isAllCaps(m[2])))
    return { level: 1, confidence: 0.8, reason: 'Numeració de primer nivell' };
  m = t.match(ROMAN_L1);
  if (m && !looksLikeSentence(t) && t.length <= 90)
    return { level: 1, confidence: bigger || line.bold ? 0.8 : 0.6, reason: 'Numeració romana' };
  if (much && !looksLikeSentence(t)) return { level: 1, confidence: 0.7, reason: 'Font molt més gran que el cos' };
  if (bigger && !looksLikeSentence(t)) return { level: 2, confidence: 0.6, reason: 'Font més gran que el cos' };
  if (line.bold && !looksLikeSentence(t) && t.length <= 80 && t.split(' ').length <= 12)
    return { level: 2, confidence: 0.45, reason: 'Text en negreta curt' };
  if (isAllCaps(t) && t.length <= 70 && !looksLikeSentence(t))
    return { level: 2, confidence: 0.4, reason: 'Text curt en majúscules' };
  return null;
}

export function detectOutline(pages: DocumentPage[], opts: DetectOptions = {}): OutlineNode[] {
  const body = bodyFontSize(pages);
  const boiler = findBoilerplate(pages);
  const nodes: OutlineNode[] = [];
  for (const p of pages) {
    if (isTocPage(p)) continue;
    p.lines.forEach((line, idx) => {
      if (isBoilerplate(line, boiler)) return;
      const c = classifyLine(line, body, opts.maxHeadingLength);
      if (!c || c.level === 0) return;
      nodes.push({
        id: uid('n'),
        title: cleanTitle(line.text),
        level: c.level,
        page: p.pageNumber,
        lineIndex: idx,
        confidence: c.confidence,
        reason: c.reason,
      });
    });
  }
  // Fusiona títols partits en dues línies consecutives amb el mateix estil
  const merged: OutlineNode[] = [];
  for (const n of nodes) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.page === n.page &&
      n.lineIndex === prev.lineIndex + 1 &&
      prev.level === n.level &&
      !/^\d/.test(n.title) &&
      !KEYWORD_L1.test(n.title) &&
      prev.title.length + n.title.length < 120
    ) {
      prev.title = `${prev.title} ${n.title}`;
      continue;
    }
    // "TEMA 1" en una línia i el títol a la següent
    if (prev && prev.page === n.page && n.lineIndex === prev.lineIndex + 1 && /^\S+\s+([0-9]+|[IVXLC]+)$/.test(prev.title) && KEYWORD_L1.test(prev.title)) {
      prev.title = `${prev.title}. ${n.title}`;
      continue;
    }
    merged.push(n);
  }
  // Massa nodes de baixa confiança: els desactivem (l'usuari els pot reactivar)
  const strong = merged.filter((n) => n.confidence >= 0.6);
  if (strong.length >= 2) {
    for (const n of merged) if (n.confidence < 0.6) n.level = 0;
  }
  // Si no hi ha cap tema (nivell 1) però sí apartats, promou-ne el primer nivell disponible
  if (!merged.some((n) => n.level === 1) && merged.some((n) => n.level === 2)) {
    // Mantenim els apartats; buildStructure crearà un tema a partir del nom del document
  }
  return merged;
}

export interface BuiltSection {
  title: string;
  pageStart: number;
  pageEnd: number;
  sourceText: string;
}
export interface BuiltTopic {
  title: string;
  pageStart: number;
  pageEnd: number;
  sections: BuiltSection[];
}

/**
 * Construeix temes i apartats tallant el text del document segons l'estructura (ja revisada).
 * Les capçaleres/peus repetits s'eliminen. Cada fragment conserva marques de pàgina.
 */
export function buildStructure(pages: DocumentPage[], outline: OutlineNode[], docName: string, pagesPerChunk = 3): BuiltTopic[] {
  const boiler = findBoilerplate(pages);
  const active = outline
    .filter((n) => n.level === 1 || n.level === 2)
    .slice()
    .sort((a, b) => a.page - b.page || a.lineIndex - b.lineIndex);

  // Text línia a línia amb pàgina
  type L = { page: number; idx: number; text: string };
  const all: L[] = [];
  for (const p of pages)
    p.lines.forEach((l, idx) => {
      if (!isBoilerplate(l, boiler)) all.push({ page: p.pageNumber, idx, text: l.text.trim() });
    });

  const toSource = (ls: L[]): string => {
    let out = '';
    let cur = -1;
    for (const l of ls) {
      if (l.page !== cur) {
        out += `${out ? '\n' : ''}[[p:${l.page}]]\n`;
        cur = l.page;
      }
      out += l.text + '\n';
    }
    return out.trim();
  };
  const range = (ls: L[]) => ({
    pageStart: ls.length ? ls[0].page : 0,
    pageEnd: ls.length ? ls[ls.length - 1].page : 0,
  });

  // Sense estructura: un tema amb apartats per blocs de pàgines
  if (!active.length) {
    const sections: BuiltSection[] = [];
    const pageNums = pages.map((p) => p.pageNumber);
    for (let i = 0; i < pageNums.length; i += pagesPerChunk) {
      const chunk = pageNums.slice(i, i + pagesPerChunk);
      const ls = all.filter((l) => chunk.includes(l.page));
      if (!ls.length) continue;
      const r = range(ls);
      sections.push({
        title: r.pageStart === r.pageEnd ? `Pàgina ${r.pageStart}` : `Pàgines ${r.pageStart}–${r.pageEnd}`,
        ...r,
        sourceText: toSource(ls),
      });
    }
    const r = range(all);
    return sections.length ? [{ title: docName.replace(/\.pdf$/i, ''), ...r, sections }] : [];
  }

  const posOf = (n: OutlineNode) => all.findIndex((l) => l.page > n.page || (l.page === n.page && l.idx >= n.lineIndex));
  const marks = active.map((n) => ({ n, pos: posOf(n) })).filter((m) => m.pos >= 0);

  const topics: BuiltTopic[] = [];
  let curTopic: BuiltTopic | null = null;
  const ensureTopic = (title: string, at: number) => {
    if (!curTopic) {
      curTopic = { title, pageStart: all[at]?.page ?? 1, pageEnd: all[at]?.page ?? 1, sections: [] };
      topics.push(curTopic);
    }
    return curTopic;
  };

  // Text previ al primer títol
  if (marks.length && marks[0].pos > 0) {
    const pre = all.slice(0, marks[0].pos);
    const chars = pre.reduce((a, l) => a + l.text.length, 0);
    if (chars > 300) {
      const t = ensureTopic(marks[0].n.level === 1 ? 'Introducció' : docName.replace(/\.pdf$/i, ''), 0);
      t.sections.push({ title: 'Introducció', ...range(pre), sourceText: toSource(pre) });
      if (marks[0].n.level === 1) curTopic = null;
    }
  }

  for (let i = 0; i < marks.length; i++) {
    const { n, pos } = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1].pos : all.length;
    const body = all.slice(pos + 1, end); // sense la línia del títol
    if (n.level === 1) {
      curTopic = { title: n.title, pageStart: n.page, pageEnd: n.page, sections: [] };
      topics.push(curTopic);
      const chars = body.reduce((a, l) => a + l.text.length, 0);
      if (chars > 0) {
        // Text del tema abans del primer apartat
        const nextIsSub = i + 1 < marks.length && marks[i + 1].n.level === 2;
        curTopic.sections.push({
          title: nextIsSub ? 'Introducció del tema' : n.title,
          ...range(body.length ? body : [all[pos]]),
          sourceText: toSource(body),
        });
        if (nextIsSub && chars < 120) curTopic.sections.pop();
      }
    } else {
      const t = ensureTopic(docName.replace(/\.pdf$/i, ''), pos);
      if (!body.length) continue;
      t.sections.push({ title: n.title, ...range([all[pos], ...body]), sourceText: toSource(body) });
    }
  }
  for (const t of topics) {
    if (t.sections.length) {
      t.pageStart = Math.min(t.pageStart, ...t.sections.map((s) => s.pageStart));
      t.pageEnd = Math.max(...t.sections.map((s) => s.pageEnd));
    }
  }
  return topics.filter((t) => t.sections.length > 0);
}
