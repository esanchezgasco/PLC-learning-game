// Generació LOCAL de preguntes (sense IA) a partir del text original de cada apartat.
// Totes les preguntes es basen en frases literals del document i hi queden vinculades
// (fragment + pàgina), de manera que la resposta correcta sempre té justificació verificable.

import type { Difficulty, Question, QuestionType } from '../types';
import { analyzeSource, keyConcepts, type Definition } from './theory';
import { EXCERPT_SEP, contentWords, hashString, normalize, seededShuffle, truncate, uid } from './text';

export interface SectionInput {
  id: string;
  subjectId: string;
  topicId: string;
  title: string;
  sourceText: string;
  documentId?: string;
  docName?: string;
}

interface Ctx {
  section: SectionInput;
  generation: number;
  /** Termes definits en altres apartats del tema (per a distractors) */
  otherTerms: string[];
  otherBodies: string[];
  otherListItems: string[];
}

function q(
  ctx: Ctx,
  p: {
    type: QuestionType;
    prompt: string;
    answer: string;
    explanation: string;
    excerpt: string;
    pages: number[];
    difficulty: Difficulty;
    concept: string;
    template: string;
    pool: 'practice' | 'exam';
    options?: string[];
    pairs?: { left: string; right: string }[];
    acceptable?: string[];
    criteria?: { text: string; keywords: string[] }[];
  },
): Question {
  return {
    id: uid('q'),
    subjectId: ctx.section.subjectId,
    topicId: ctx.section.topicId,
    sectionId: ctx.section.id,
    type: p.type,
    prompt: p.prompt,
    options: p.options,
    pairs: p.pairs,
    answer: p.answer,
    acceptable: p.acceptable,
    criteria: p.criteria,
    explanation: p.explanation,
    source: {
      sectionId: ctx.section.id,
      pages: p.pages.filter((n) => n > 0),
      docId: ctx.section.documentId,
      docName: ctx.section.docName,
      excerpt: p.excerpt,
      verified: true,
    },
    difficulty: p.difficulty,
    concept: p.concept,
    template: p.template,
    pool: p.pool,
    origin: 'local',
    needsReview: false,
    flags: [],
    generation: ctx.generation,
    createdAt: Date.now(),
  };
}

function similar(a: string, b: string): boolean {
  const A = normalize(a);
  const B = normalize(b);
  return A === B || A.includes(B) || B.includes(A);
}

function pickDistinct(candidates: string[], exclude: string[], n: number, seed: number): string[] {
  const out: string[] = [];
  for (const c of seededShuffle(candidates, seed)) {
    if (out.length >= n) break;
    if ([...exclude, ...out].some((e) => similar(e, c))) continue;
    out.push(c);
  }
  return out;
}

function blankTerm(text: string, term: string): string | null {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return null;
  return text.slice(0, idx) + '________' + text.slice(idx + term.length);
}

function keywordsOf(text: string, n: number): string[] {
  const words = contentWords(text).filter((w) => w.length > 3);
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  // prioritza paraules llargues (més específiques) i freqüents
  return Array.from(freq.entries())
    .sort((a, b) => b[1] * 2 + b[0].length / 4 - (a[1] * 2 + a[0].length / 4))
    .slice(0, n)
    .map(([w]) => w);
}

function defQuestions(ctx: Ctx, defs: Definition[]): Question[] {
  const out: Question[] = [];
  const allTerms = [...defs.map((d) => d.term), ...ctx.otherTerms];
  const allBodies = [...defs.map((d) => d.body), ...ctx.otherBodies];
  defs.forEach((d, i) => {
    const seed = hashString(d.term + ctx.generation);
    const just = `Definició al text original (p. ${d.page}): «${d.text}»`;

    // PRÀCTICA 1: completar la definició (s'ha d'escriure el terme)
    const blanked = blankTerm(d.text, d.term);
    if (blanked && blanked !== d.text) {
      out.push(
        q(ctx, {
          type: 'cloze',
          prompt: `Completa la definició: «${blanked}»`,
          answer: d.term,
          acceptable: [d.term.replace(/^(el|la|els|les|l'|l’)\s*/i, '')],
          explanation: `El concepte que falta és «${d.term}». ${just}`,
          excerpt: d.text,
          pages: [d.page],
          difficulty: 'medium',
          concept: d.term,
          template: 'def-cloze',
          pool: 'practice',
        }),
      );
    }

    // PRÀCTICA 2: test — quin concepte correspon a la definició
    const distractTerms = pickDistinct(allTerms, [d.term], 3, seed);
    if (distractTerms.length === 3) {
      const opts = seededShuffle([d.term, ...distractTerms], seed + 1);
      out.push(
        q(ctx, {
          type: 'mcq',
          prompt: `Quin concepte correspon a la definició següent?\n«${truncate(d.body, 320)}»`,
          options: opts,
          answer: String(opts.indexOf(d.term)),
          explanation: `La definició correspon a «${d.term}». Les altres opcions són conceptes diferents del temari. ${just}`,
          excerpt: d.text,
          pages: [d.page],
          difficulty: 'medium',
          concept: d.term,
          template: 'def-mcq-term',
          pool: 'practice',
        }),
      );
    }

    // EXAMEN 1: test invers — quina és la definició correcta
    const distractBodies = pickDistinct(allBodies, [d.body], 3, seed + 2);
    if (distractBodies.length === 3) {
      const opts = seededShuffle([d.body, ...distractBodies].map((b) => truncate(b, 220)), seed + 3);
      out.push(
        q(ctx, {
          type: 'mcq',
          prompt: `Quina de les opcions següents defineix correctament «${d.term}»?`,
          options: opts,
          answer: String(opts.indexOf(truncate(d.body, 220))),
          explanation: `${just} Les altres opcions corresponen a definicions d’altres conceptes.`,
          excerpt: d.text,
          pages: [d.page],
          difficulty: 'medium',
          concept: d.term,
          template: 'def-mcq-body',
          pool: 'exam',
        }),
      );
    }

    // Vertader/fals: una versió per a la pràctica i l'oposada per a l'examen
    const wrongBody = pickDistinct(allBodies, [d.body], 1, seed + 4)[0];
    const trueQ = q(ctx, {
      type: 'truefalse',
      prompt: `Vertader o fals: «${d.term}» es pot definir com: ${truncate(d.body, 300)}.`,
      answer: 'true',
      explanation: `Vertader. ${just}`,
      excerpt: d.text,
      pages: [d.page],
      difficulty: 'easy',
      concept: d.term,
      template: 'def-tf-true',
      pool: i % 2 === 0 ? 'practice' : 'exam',
    });
    out.push(trueQ);
    if (wrongBody) {
      out.push(
        q(ctx, {
          type: 'truefalse',
          prompt: `Vertader o fals: «${d.term}» es pot definir com: ${truncate(wrongBody, 300)}.`,
          answer: 'false',
          explanation: `Fals. Aquesta descripció correspon a un altre concepte. ${just}`,
          excerpt: d.text,
          pages: [d.page],
          difficulty: 'easy',
          concept: d.term,
          template: 'def-tf-false',
          pool: i % 2 === 0 ? 'exam' : 'practice',
        }),
      );
    }

    // EXAMEN 2: resposta curta amb criteris explícits
    const kws = keywordsOf(d.body, 4);
    if (kws.length >= 2) {
      out.push(
        q(ctx, {
          type: 'short',
          prompt: `Defineix amb les teves paraules el concepte «${d.term}».`,
          answer: d.body,
          criteria: kws.map((k) => ({ text: `Esmenta la idea «${k}»`, keywords: [k] })),
          explanation: `Resposta de referència: ${just} La correcció automàtica és orientativa: comprova si la resposta inclou les idees clau.`,
          excerpt: d.text,
          pages: [d.page],
          difficulty: 'hard',
          concept: d.term,
          template: 'def-short',
          pool: i % 2 === 0 ? 'exam' : 'practice',
        }),
      );
    }
  });

  // Relacionar conceptes (un per a pràctica i, si n'hi ha prou, un altre per a l'examen)
  const makeMatching = (subset: Definition[], pool: 'practice' | 'exam', tag: string) => {
    if (subset.length < 3) return;
    out.push(
      q(ctx, {
        type: 'matching',
        prompt: 'Relaciona cada concepte amb la seva definició.',
        options: subset.map((d) => d.term),
        pairs: subset.map((d) => ({ left: d.term, right: truncate(d.body, 160) })),
        answer: '',
        explanation: subset.map((d) => `«${d.term}» (p. ${d.page}): ${truncate(d.body, 200)}`).join('\n'),
        excerpt: subset.map((d) => d.text).join(EXCERPT_SEP),
        pages: Array.from(new Set(subset.map((d) => d.page))),
        difficulty: 'hard',
        concept: subset.map((d) => d.term).join(' / '),
        template: `matching-${tag}`,
        pool,
      }),
    );
  };
  makeMatching(defs.slice(0, 4), 'practice', 'a');
  if (defs.length >= 6) makeMatching(defs.slice(defs.length - 4), 'exam', 'b');

  // Diferències entre conceptes (oberta, criteris de les dues definicions)
  for (let i = 0; i + 1 < defs.length && i < 4; i += 2) {
    const a = defs[i];
    const b = defs[i + 1];
    const ka = keywordsOf(a.body, 2);
    const kb = keywordsOf(b.body, 2);
    if (ka.length < 1 || kb.length < 1) continue;
    out.push(
      q(ctx, {
        type: 'difference',
        prompt: `Explica la diferència entre «${a.term}» i «${b.term}».`,
        answer: `${a.term}: ${a.body}. — ${b.term}: ${b.body}.`,
        criteria: [
          { text: `Caracteritza «${a.term}» (${ka.join(', ')})`, keywords: ka },
          { text: `Caracteritza «${b.term}» (${kb.join(', ')})`, keywords: kb },
        ],
        explanation: `Segons el text: «${a.text}» (p. ${a.page}) i «${b.text}» (p. ${b.page}). La correcció és orientativa.`,
        excerpt: `${a.text}${EXCERPT_SEP}${b.text}`,
        pages: Array.from(new Set([a.page, b.page])),
        difficulty: 'hard',
        concept: `${a.term} / ${b.term}`,
        template: 'difference',
        pool: (i / 2) % 2 === 0 ? 'exam' : 'practice',
      }),
    );
  }
  return out;
}

const UNIT = '(%|dies|dias|días|hores|horas|mes|mesos|meses|any|anys|año|años|setmanes|semanas|euros|€|persones|personas|membres|miembros)';
const NUM_WITH_UNIT = new RegExp(`(?<![\\d/])(\\d{1,4}(?:[.,]\\d+)?)\\s*${UNIT}(?![\\p{L}])`, 'u');
const NUM_ANY = /(?<![\d/])(\d{1,4}(?:[.,]\d+)?)(?![\d/])()/u;

function numberQuestions(ctx: Ctx, items: { text: string; page: number }[]): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  items.slice(0, 8).forEach((it, i) => {
    const m = it.text.match(NUM_WITH_UNIT) ?? it.text.match(NUM_ANY);
    if (!m || m.index === undefined) return;
    const num = m[1];
    if (/^(19|20)\d\d$/.test(num) && !m[2]) return; // evita anys solts
    const key = normalize(it.text);
    if (seen.has(key)) return;
    seen.add(key);
    const blanked = it.text.slice(0, m.index) + '____' + it.text.slice(m.index + num.length);
    const just = `Text original (p. ${it.page}): «${it.text}»`;
    const concept = truncate(it.text.replace(/\s+/g, ' '), 60);
    out.push(
      q(ctx, {
        type: 'cloze',
        prompt: `Completa amb la xifra exacta: «${blanked}»`,
        answer: num,
        explanation: `La xifra correcta és ${num}. ${just}`,
        excerpt: it.text,
        pages: [it.page],
        difficulty: 'hard',
        concept,
        template: 'num-cloze',
        pool: i % 2 === 0 ? 'practice' : 'exam',
      }),
    );
    const n = Number(num.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
      const alt = n <= 3 ? n + 2 : Math.round(n * (hashString(key) % 2 ? 2 : 0.5));
      if (alt !== n) {
        const altered = it.text.slice(0, m.index) + String(alt) + it.text.slice(m.index + num.length);
        out.push(
          q(ctx, {
            type: 'truefalse',
            prompt: `Vertader o fals: «${altered}»`,
            answer: 'false',
            explanation: `Fals: la xifra correcta és ${num}, no ${alt}. ${just}`,
            excerpt: it.text,
            pages: [it.page],
            difficulty: 'medium',
            concept,
            template: 'num-tf',
            pool: i % 2 === 0 ? 'exam' : 'practice',
          }),
        );
      }
    }
  });
  return out;
}

function listQuestions(ctx: Ctx, lists: { intro: string; items: string[]; page: number }[]): Question[] {
  const out: Question[] = [];
  lists.slice(0, 4).forEach((l, i) => {
    const items = l.items.map((it) => truncate(it, 140)).filter((it) => it.length >= 3);
    if (items.length < 2) return;
    const intro = l.intro ? truncate(l.intro.replace(/:$/, ''), 200) : `l’enumeració de l’apartat «${ctx.section.title}»`;
    const excerpt = [l.intro, ...l.items].filter(Boolean).join(EXCERPT_SEP);
    const just = `Enumeració original (p. ${l.page}): ${items.map((it) => `«${it}»`).join(', ')}.`;
    const concept = truncate(l.intro || ctx.section.title, 60);
    // Resposta curta: enumerar
    out.push(
      q(ctx, {
        type: 'short',
        prompt: `Enumera els elements que recull el text: ${intro}.`,
        answer: items.join('; '),
        criteria: items.slice(0, 6).map((it) => ({ text: `Inclou «${truncate(it, 60)}»`, keywords: keywordsOf(it, 2) })).filter((c) => c.keywords.length),
        explanation: `${just} La correcció és orientativa: compara la teva resposta amb la llista.`,
        excerpt,
        pages: [l.page],
        difficulty: 'hard',
        concept,
        template: 'list-short',
        pool: i % 2 === 0 ? 'practice' : 'exam',
      }),
    );
    // Test: quin element NO forma part de l'enumeració (element aliè d'un altre apartat)
    const foreign = pickDistinct(ctx.otherListItems.map((x) => truncate(x, 140)), items, 1, hashString(intro + ctx.generation))[0];
    if (foreign && items.length >= 3) {
      const opts = seededShuffle([...seededShuffle(items, i + 7).slice(0, 3), foreign], hashString(foreign));
      const qq = q(ctx, {
        type: 'mcq',
        prompt: `Quin dels elements següents NO forma part de l’enumeració: ${intro}?`,
        options: opts,
        answer: String(opts.indexOf(foreign)),
        explanation: `«${foreign}» no apareix en aquesta enumeració (prové d’una altra part del temari). ${just}`,
        excerpt,
        pages: [l.page],
        difficulty: 'medium',
        concept,
        template: 'list-odd',
        pool: i % 2 === 0 ? 'exam' : 'practice',
      });
      qq.flags.push('Distractor triat automàticament d’un altre apartat: comprova que no pertanyi també a aquesta llista.');
      out.push(qq);
    }
  });
  return out;
}

function conceptClozes(ctx: Ctx, sentences: { text: string; page: number }[], concepts: string[], limit: number): Question[] {
  const out: Question[] = [];
  const used = new Set<string>();
  for (const s of sentences) {
    if (out.length >= limit) break;
    if (s.text.length < 60 || s.text.length > 400) continue;
    const c = concepts.find((k) => !used.has(k) && k.length >= 4 && s.text.toLowerCase().includes(k.toLowerCase()) && s.text.toLowerCase().indexOf(k.toLowerCase()) > 5);
    if (!c) continue;
    const b = blankTerm(s.text, c);
    if (!b) continue;
    used.add(c);
    out.push(
      q(ctx, {
        type: 'cloze',
        prompt: `Completa la frase del temari: «${b}»`,
        answer: c,
        explanation: `La paraula o expressió que falta és «${c}». Text original (p. ${s.page}): «${s.text}»`,
        excerpt: s.text,
        pages: [s.page],
        difficulty: 'medium',
        concept: c,
        template: 'concept-cloze',
        pool: out.length % 2 === 0 ? 'practice' : 'exam',
      }),
    );
  }
  return out;
}

export interface TopicContext {
  otherTerms: string[];
  otherBodies: string[];
  otherListItems: string[];
}

/** Recull termes, definicions i elements de llista de tots els apartats d'un tema (per a distractors). */
export function topicContext(sections: SectionInput[], excludeId?: string): TopicContext {
  const ctx: TopicContext = { otherTerms: [], otherBodies: [], otherListItems: [] };
  for (const s of sections) {
    if (s.id === excludeId) continue;
    const f = analyzeSource(s.sourceText);
    ctx.otherTerms.push(...f.definitions.map((d) => d.term));
    ctx.otherBodies.push(...f.definitions.map((d) => d.body));
    f.lists.forEach((l) => ctx.otherListItems.push(...l.items));
  }
  return ctx;
}

/** Genera el banc de preguntes d'un apartat (pràctica + reserva d'examen). */
export function generateLocalQuestions(section: SectionInput, topic: TopicContext, generation = 1): Question[] {
  const facts = analyzeSource(section.sourceText);
  const ctx: Ctx = { section, generation, ...topic };
  const out: Question[] = [];
  out.push(...defQuestions(ctx, facts.definitions.slice(0, 14)));
  const numeric = [...facts.deadlines, ...facts.legal.filter((l) => /\d/.test(l.text))];
  out.push(...numberQuestions(ctx, numeric));
  out.push(...listQuestions(ctx, facts.lists));
  if (facts.definitions.length < 4) {
    out.push(...conceptClozes(ctx, facts.sentences, keyConcepts(facts, section.title, 20), 6));
  }
  return out;
}
