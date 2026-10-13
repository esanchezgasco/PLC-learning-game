// Generació de teoria EXTRACTIVA (sense IA): organitza el text original del PDF en blocs
// (paràgrafs, definicions, enumeracions, referències normatives, exemples) i en treu
// un resum extractiu i una llista de conceptes. No reescriu ni afegeix informació.

import type { TheoryBlock, TheoryContent } from '../types';
import { contentWords, normalize, parsePaged, splitSentences, truncate, uid } from './text';

export interface Definition {
  term: string;
  text: string; // definició completa (frase original)
  body: string; // part que defineix (sense el terme)
  page: number;
}

const BULLET = /^\s*([•·\-–—*▪◦●]|\(?[a-zA-Z]\)|\(?\d{1,2}[.)]|\(?[ivx]{1,4}\))\s+/;
const DEF_VERBS =
  "és|són|es defineix com|es defineixen com|consisteix en|s'entén per|s’entén per|fa referència a|" +
  'es|son|se define como|se definen como|consiste en|se entiende por|hace referencia a|' +
  'is|are|is defined as|refers to';
const DEF_RE = new RegExp(`^(?:(?:El|La|Els|Les|Un|Una|Lo|Los|Las|The|A|An)\\s+|L['’])?(.{2,60}?)\\s*(?:,[^,]{0,40},)?\\s+(${DEF_VERBS})\\s+(.{15,})$`, 'u');
const COLON_DEF_RE = /^([\p{Lu}][^:]{1,50}):\s+(.{15,})$/u;
const REVERSE_DEF_RE = /^(?:S'anomena|S’anomena|Es denomina|Se denomina|Se llama|S'entén per|Se entiende por)\s+(.{2,50}?)\s+(?:a |al |la |el |)(.{10,})$/iu;

export const LEGAL_RE =
  /\b(art(?:icle|ículo|\.)?\s*\d+[\w.]*|arts?\.\s*\d+|llei\s+(?:org[àa]nica\s+)?\d+\/\d{2,4}|ley\s+(?:org[áa]nica\s+)?\d+\/\d{2,4}|reial decret(?:\s+legislatiu)?\s+\d+\/\d{2,4}|real decreto(?:\s+legislativo)?\s+\d+\/\d{2,4}|rd\s*\d+\/\d{2,4}|decret\s+\d+\/\d{2,4}|directiva\s+\d+\/\d+|reglament\s*\(ue\)\s*\d+\/\d+|sts\s+\d+\/\d{4}|stc\s+\d+\/\d{4}|sentència|sentencia|jurisprud[eè]ncia|constituci[oó]|codi civil|c[oó]digo civil|codi penal|c[oó]digo penal)\b/giu;
export const DEADLINE_RE =
  /\b(\d+|un|una|dos|dues|tres|quatre|cinc|sis|set|vuit|nou|deu|quinze|vint|trenta|uno|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta)\s+(dies|dias|días|hores|horas|mesos|meses|anys|años|setmanes|semanas)(\s+h[àa]bils|\s+h[áa]biles|\s+naturals|\s+naturales)?\b|\btermini\b|\bplazo\b/giu;
const EXAMPLE_RE = /^(per exemple|p\. ?ex\.|exemple|por ejemplo|ejemplo|for example|e\.g\.)[:,]?\s*/i;
const EXCEPTION_RE = /\b(excepte|llevat que|llevat de|tret que|excepció|excepcions|no obstant|excepto|salvo|excepción|sin embargo|except|unless)\b/i;

const BAD_TERM_START = /^(aix[oò]|aquest|aquesta|això|esto|esta|este|ello|it|this|that|el que|lo que|la qual|el qual|que|quan|on|si|també|per tant|por tanto)\b/i;

/** Uneix línies trencades en paràgrafs, mantenint enumeracions com a línies separades. */
export function linesToParagraphs(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const paras: string[] = [];
  let cur = '';
  const flush = () => {
    if (cur.trim()) paras.push(cur.trim());
    cur = '';
  };
  for (const l of lines) {
    if (!l) {
      flush();
      continue;
    }
    if (BULLET.test(l)) {
      flush();
      cur = l;
      continue;
    }
    if (!cur) {
      cur = l;
      continue;
    }
    // guionet de partició de paraula
    if (/[a-zà-ú]-$/.test(cur) && /^[a-zà-ú]/.test(l)) {
      cur = cur.slice(0, -1) + l;
      continue;
    }
    const prevEnds = /[.!?:;]$/.test(cur);
    const startsUpper = /^[\p{Lu}«"“(¿¡]/u.test(l);
    if (prevEnds && startsUpper && (cur.length > 60 || BULLET.test(cur))) {
      flush();
      cur = l;
    } else {
      cur += ' ' + l;
    }
  }
  flush();
  return paras;
}

export function isGoodTerm(term: string): boolean {
  const t = term.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (BAD_TERM_START.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 7) return false;
  if (/\d{3,}/.test(t)) return false;
  if (contentWords(t).length === 0) return false;
  return true;
}

export function extractDefinition(sentence: string, page: number): Definition | null {
  const s = sentence.replace(/\s+/g, ' ').trim();
  if (s.length < 25 || s.length > 600) return null;
  let m = s.match(REVERSE_DEF_RE);
  if (m && isGoodTerm(m[1])) return { term: cleanTerm(m[1]), text: s, body: m[2].replace(/\.$/, ''), page };
  m = s.match(COLON_DEF_RE);
  if (m && isGoodTerm(m[1]) && m[1].split(' ').length <= 6) return { term: cleanTerm(m[1]), text: s, body: m[2].replace(/\.$/, ''), page };
  m = s.match(DEF_RE);
  if (m && isGoodTerm(m[1])) {
    const verb = m[2].toLowerCase();
    const body = m[3].replace(/\.$/, '');
    // "es" és ambigu en català (pronom); només l'acceptem seguit d'article (castellà: "X es un/una/el...")
    if ((verb === 'es' || verb === 'is' || verb === 'are' || verb === 'son') && !/^(un|una|el|la|lo|los|las|aquel|aquella|aquello|cada|toda|todo|a|an|the|any|unos|unas)\s/i.test(body)) return null;
    // descarta frases on el "verb" és només un copulatiu amb adjectiu curt ("és important")
    if (contentWords(body).length < 3) return null;
    if (/^(important|necessari|necesario|possible|posible|obligatori|obligatorio|habitual|freqüent)\b/i.test(body)) return null;
    return { term: cleanTerm(m[1]), text: s, body, page };
  }
  return null;
}

function cleanTerm(t: string): string {
  return t
    .replace(/^[«"“'‘]+|[»"”'’]+$/g, '')
    .replace(/^(el|la|els|les|un|una|lo|los|las|the|a|an)\s+/i, '')
    .replace(/^l['’]\s*/i, '')
    .trim();
}

export interface ExtractedFacts {
  definitions: Definition[];
  lists: { intro: string; items: string[]; page: number }[];
  legal: { text: string; refs: string[]; page: number }[];
  deadlines: { text: string; page: number }[];
  examples: { text: string; page: number }[];
  exceptions: { text: string; page: number }[];
  sentences: { text: string; page: number }[];
  paragraphs: { text: string; page: number; isList: boolean }[];
}

/** Analitza el text d'una secció i en treu fets reutilitzables per a teoria i preguntes. */
export function analyzeSource(sourceText: string): ExtractedFacts {
  const facts: ExtractedFacts = {
    definitions: [],
    lists: [],
    legal: [],
    deadlines: [],
    examples: [],
    exceptions: [],
    sentences: [],
    paragraphs: [],
  };
  const seenDef = new Set<string>();
  for (const seg of parsePaged(sourceText)) {
    const paras = linesToParagraphs(seg.text);
    let listIntro = '';
    let listItems: string[] = [];
    const flushList = () => {
      if (listItems.length >= 2) facts.lists.push({ intro: listIntro, items: listItems, page: seg.page });
      listItems = [];
      listIntro = '';
    };
    paras.forEach((p, i) => {
      const isItem = BULLET.test(p);
      facts.paragraphs.push({ text: p, page: seg.page, isList: isItem });
      if (isItem) {
        if (!listItems.length) {
          const prev = paras[i - 1];
          listIntro = prev && /:$/.test(prev) ? prev : prev && !BULLET.test(prev) ? truncate(prev, 200) : '';
        }
        listItems.push(p.replace(BULLET, '').trim());
      } else {
        flushList();
      }
      for (const s of splitSentences(p.replace(BULLET, ''))) {
        const sent = s.trim();
        if (sent.length < 15) continue;
        facts.sentences.push({ text: sent, page: seg.page });
        const d = extractDefinition(sent, seg.page);
        if (d && !seenDef.has(normalize(d.term))) {
          seenDef.add(normalize(d.term));
          facts.definitions.push(d);
        }
        const refs = Array.from(new Set((sent.match(LEGAL_RE) ?? []).map((r) => r.trim())));
        if (refs.length) facts.legal.push({ text: sent, refs, page: seg.page });
        if (DEADLINE_RE.test(sent)) facts.deadlines.push({ text: sent, page: seg.page });
        DEADLINE_RE.lastIndex = 0;
        if (EXAMPLE_RE.test(sent)) facts.examples.push({ text: sent, page: seg.page });
        if (EXCEPTION_RE.test(sent)) facts.exceptions.push({ text: sent, page: seg.page });
      }
    });
    flushList();
  }
  return facts;
}

/** Conceptes clau: termes definits + sintagmes freqüents. */
export function keyConcepts(facts: ExtractedFacts, title: string, max = 12): string[] {
  const out: string[] = facts.definitions.map((d) => d.term);
  const freq = new Map<string, { n: number; label: string }>();
  for (const s of facts.sentences) {
    const words = s.text.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i].replace(/[^\p{L}·'’-]/gu, '');
      const b = words[i + 1].replace(/[^\p{L}·'’-]/gu, '');
      if (a.length < 4 || b.length < 4) continue;
      if (contentWords(a).length === 0 || contentWords(b).length === 0) continue;
      const k = normalize(`${a} ${b}`);
      const e = freq.get(k) ?? { n: 0, label: `${a} ${b}`.toLowerCase() };
      e.n++;
      freq.set(k, e);
    }
  }
  const titleN = normalize(title);
  Array.from(freq.values())
    .filter((e) => e.n >= 3 && !titleN.includes(normalize(e.label)))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .forEach((e) => out.push(e.label));
  const seen = new Set<string>();
  return out.filter((t) => {
    const k = normalize(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, max);
}

/** Crea la teoria extractiva d'un apartat. */
export function buildExtractiveTheory(title: string, sourceText: string): TheoryContent {
  const facts = analyzeSource(sourceText);
  const blocks: TheoryBlock[] = [];
  const defByText = new Map(facts.definitions.map((d) => [d.text, d]));
  const warnings: string[] = [];

  // Recorregut ordenat del text original, marcant definicions, llistes, normativa i exemples.
  let pendingList: { title?: string; items: string[]; ordered: boolean; page: number } | null = null;
  const flushList = () => {
    if (pendingList && pendingList.items.length) {
      blocks.push({ kind: 'list', id: uid('b'), title: pendingList.title, items: pendingList.items, ordered: pendingList.ordered, origin: 'pdf', pages: [pendingList.page] });
    }
    pendingList = null;
  };
  facts.paragraphs.forEach((p, i) => {
    if (p.isList) {
      const ordered = /^\s*\(?(\d{1,2}|[a-z]|[ivx]{1,4})[.)]/i.test(p.text);
      if (!pendingList) {
        const prev = facts.paragraphs[i - 1];
        pendingList = { title: prev && /:$/.test(prev.text) ? undefined : undefined, items: [], ordered, page: p.page };
      }
      pendingList.items.push(p.text.replace(BULLET, '').trim());
      return;
    }
    flushList();
    const sentences = splitSentences(p.text);
    // Definicions dins el paràgraf: es mostren com a blocs propis
    const defs = sentences.map((s) => defByText.get(s.trim())).filter(Boolean) as Definition[];
    const legalRefs = Array.from(new Set((p.text.match(LEGAL_RE) ?? []).map((r) => r.trim())));
    if (defs.length && defs.length === sentences.length) {
      defs.forEach((d) => blocks.push({ kind: 'definition', id: uid('b'), term: d.term, text: d.text, origin: 'pdf', pages: [p.page] }));
      return;
    }
    if (EXAMPLE_RE.test(p.text)) {
      blocks.push({ kind: 'example', id: uid('b'), text: p.text, origin: 'pdf', pages: [p.page] });
      return;
    }
    if (legalRefs.length) {
      blocks.push({ kind: 'legal', id: uid('b'), text: p.text, refs: legalRefs, origin: 'pdf', pages: [p.page] });
    } else {
      blocks.push({ kind: 'paragraph', id: uid('b'), text: p.text, origin: 'pdf', pages: [p.page] });
    }
    defs.forEach((d) => blocks.push({ kind: 'definition', id: uid('b'), term: d.term, text: d.text, origin: 'pdf', pages: [p.page] }));
  });
  flushList();

  // Taula comparativa de definicions (reorganització, sense contingut nou)
  if (facts.definitions.length >= 2) {
    blocks.push({
      kind: 'comparison',
      id: uid('b'),
      title: 'Quadre de conceptes definits en aquest apartat',
      headers: ['Concepte', 'Definició (text original)', 'Pàg.'],
      rows: facts.definitions.slice(0, 12).map((d) => [d.term, d.body, String(d.page)]),
      origin: 'extractive',
      pages: Array.from(new Set(facts.definitions.map((d) => d.page))),
    });
  }
  if (facts.exceptions.length) {
    blocks.push({
      kind: 'note',
      id: uid('b'),
      text: 'Atenció a les excepcions i matisos que apareixen al text: ' + facts.exceptions.map((e) => `«${truncate(e.text, 220)}» (p. ${e.page})`).join(' · '),
      origin: 'extractive',
      pages: Array.from(new Set(facts.exceptions.map((e) => e.page))),
    });
  }
  if (facts.deadlines.length) {
    blocks.push({
      kind: 'list',
      id: uid('b'),
      title: 'Terminis i quantitats esmentats',
      items: facts.deadlines.slice(0, 12).map((d) => `${d.text} (p. ${d.page})`),
      ordered: false,
      origin: 'extractive',
      pages: Array.from(new Set(facts.deadlines.map((d) => d.page))),
    });
  }

  const concepts = keyConcepts(facts, title);
  // Resum extractiu: primera frase dels paràgrafs principals
  const summaryItems: string[] = [];
  const summaryPages = new Set<number>();
  for (const p of facts.paragraphs) {
    if (p.isList || p.text.length < 80) continue;
    const first = splitSentences(p.text)[0];
    if (first && first.length >= 40) {
      summaryItems.push(truncate(first, 280));
      summaryPages.add(p.page);
    }
    if (summaryItems.length >= 6) break;
  }

  if (!facts.sentences.length) warnings.push('No s’ha trobat text suficient en aquest apartat.');
  if (!facts.definitions.length) warnings.push('No s’han detectat definicions explícites; les preguntes possibles seran limitades.');

  return {
    objectives: {
      items: concepts.length
        ? [`Identificar i explicar: ${concepts.slice(0, 6).join(', ')}.`, ...(facts.lists.length ? ['Recordar les enumeracions i classificacions de l’apartat.'] : []), ...(facts.legal.length ? ['Retenir les referències normatives, articles i terminis citats.'] : [])]
        : [`Comprendre el contingut de «${title}».`],
      origin: 'extractive',
    },
    blocks,
    summary: { items: summaryItems, origin: 'extractive', pages: Array.from(summaryPages) },
    keyConcepts: { items: concepts, origin: 'extractive' },
    generator: 'extractive',
    generatedAt: Date.now(),
    warnings,
  };
}
