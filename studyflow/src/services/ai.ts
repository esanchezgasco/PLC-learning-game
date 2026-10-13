// Client de la capa d'IA. Les crides passen pel servidor (/api/ai/*): les claus mai són al navegador.
// Abans d'enviar cap contingut, la interfície demana el consentiment explícit de l'usuari.
import { db, getSettings } from '../db/db';
import { checkQuestions } from '../lib/quality';
import { fragmentInSource, findPageOf, uid } from '../lib/text';
import type { ContentOrigin, Difficulty, GradeResult, Question, QuestionType, Section, TheoryBlock, TheoryContent } from '../types';

export interface AiStatus {
  configured: boolean;
  reachable: boolean;
  defaultProvider: string;
  providers: { id: string; label: string; configured: boolean; models: string[]; defaultModel: string }[];
  limits?: { maxInputChars: number; ratePerMin: number; maxPerDay: number; usedToday: number };
  estimatedCostUsd?: number;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const r = await fetch('/api/ai/status');
    if (!r.ok) throw new Error();
    const j = await r.json();
    return { ...j, reachable: true };
  } catch {
    return { configured: false, reachable: false, defaultProvider: 'anthropic', providers: [] };
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<{ data: T; model: string; usage: { input: number; output: number; costUsd: number } }> {
  const s = await getSettings();
  if (!s.aiEnabled) throw new Error('La IA està desactivada a la configuració.');
  if (!s.aiConsent) throw new Error('Cal acceptar l’enviament de contingut a la IA (Configuració → IA).');
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: s.aiProvider, model: s.aiModel || undefined, ...body }),
  });
  const j = await r.json().catch(() => ({ error: `Error ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

const ORIGIN: Record<string, ContentOrigin> = { textual: 'ai-textual', complementari: 'ai-complement', no_verificable: 'ai-unverified' };

interface AiBlock {
  tipus: string;
  origen: string;
  terme?: string;
  text?: string;
  elements?: string[];
  capcaleres?: string[];
  files?: string[][];
  referencies?: string[];
  pagines?: number[];
  cita?: string;
}

/** Genera teoria amb IA i en verifica les cites contra el text original. */
export async function aiTheory(section: Section, subjectName: string): Promise<TheoryContent> {
  const { data, model } = await post<{ objectius?: string[]; blocs?: AiBlock[]; resum?: string[]; conceptes_clau?: string[]; avisos?: string[] }>('/api/ai/theory', {
    sectionTitle: section.title,
    subjectName,
    sourceText: section.sourceText,
  });
  const warnings = [...(data.avisos ?? [])];
  let downgraded = 0;
  const validPages = (ps?: number[]) => (ps ?? []).filter((p) => Number.isInteger(p) && p >= (section.pageStart ?? 0) && p <= (section.pageEnd ?? 99999));
  const blocks: TheoryBlock[] = (data.blocs ?? []).map((b) => {
    let origin = ORIGIN[b.origen] ?? 'ai-unverified';
    // Una afirmació "textual" ha de portar una cita que existeixi al document
    if (origin === 'ai-textual' && !(b.cita && fragmentInSource(section.sourceText, b.cita))) {
      origin = 'ai-unverified';
      downgraded++;
    }
    let pages = validPages(b.pagines);
    if (!pages.length && b.cita) {
      const p = findPageOf(section.sourceText, b.cita);
      if (p) pages = [p];
    }
    const id = uid('b');
    const text = b.text ?? '';
    switch (b.tipus) {
      case 'titol':
        return { kind: 'heading', id, text, origin, pages };
      case 'definicio':
        return { kind: 'definition', id, term: b.terme ?? '', text, origin, pages };
      case 'llista':
        return { kind: 'list', id, title: text || undefined, items: b.elements ?? [], ordered: false, origin, pages };
      case 'normativa':
        return { kind: 'legal', id, text, refs: b.referencies ?? [], origin, pages };
      case 'exemple':
        return { kind: 'example', id, text, origin, pages };
      case 'comparacio':
        return { kind: 'comparison', id, title: text, headers: b.capcaleres ?? [], rows: b.files ?? [], origin, pages };
      case 'nota':
        return { kind: 'note', id, text, origin, pages };
      default:
        return { kind: 'paragraph', id, text, origin, pages };
    }
  });
  if (downgraded) warnings.push(`${downgraded} blocs declarats com a textuals no tenien una cita verificable al document i s’han marcat com a «no verificable».`);
  return {
    objectives: { items: data.objectius ?? [], origin: 'ai-complement' },
    blocks,
    summary: { items: data.resum ?? [], origin: 'ai-complement', pages: [] },
    keyConcepts: { items: data.conceptes_clau ?? [], origin: 'ai-complement' },
    generator: 'ai',
    generatedAt: Date.now(),
    aiModel: model,
    warnings,
  };
}

interface AiQuestion {
  tipus: QuestionType;
  enunciat: string;
  opcions?: string[];
  resposta: string | number | boolean;
  criteris?: { text: string; paraules_clau: string[] }[];
  explicacio: string;
  cita: string;
  pagines?: number[];
  dificultat?: Difficulty;
  concepte?: string;
}

/** Genera preguntes amb IA. Les que no tenen cita verificable queden marcades per revisar. */
export async function aiQuestions(section: Section, count: number, pool: 'practice' | 'exam'): Promise<Question[]> {
  const { data } = await post<{ preguntes?: AiQuestion[] }>('/api/ai/questions', { sectionTitle: section.title, sourceText: section.sourceText, count, pool });
  const existing = await db.questions.where('topicId').equals(section.topicId).toArray();
  const generation = existing.reduce((m, q) => Math.max(m, q.generation), 0) || 1;
  const allowed: QuestionType[] = ['mcq', 'truefalse', 'cloze', 'short', 'difference', 'case'];
  const qs: Question[] = (data.preguntes ?? [])
    .filter((p) => allowed.includes(p.tipus) && p.enunciat)
    .map((p) => {
      const page = findPageOf(section.sourceText, p.cita ?? '');
      return {
        id: uid('q'),
        subjectId: section.subjectId,
        topicId: section.topicId,
        sectionId: section.id,
        type: p.tipus,
        prompt: p.enunciat,
        options: p.tipus === 'mcq' ? p.opcions : undefined,
        answer: String(p.resposta),
        criteria: p.criteris?.map((c) => ({ text: c.text, keywords: c.paraules_clau ?? [] })),
        explanation: p.explicacio ?? '',
        source: { sectionId: section.id, pages: page ? [page] : (p.pagines ?? []), docId: section.documentId, docName: section.docName, excerpt: p.cita ?? '', verified: false },
        difficulty: p.dificultat ?? 'medium',
        concept: p.concepte ?? section.title,
        template: `ai-${p.tipus}`,
        pool,
        origin: 'ai' as const,
        needsReview: false,
        flags: ['Generada per IA'],
        generation,
        createdAt: Date.now(),
      };
    });
  return checkQuestions(qs, { [section.id]: section.sourceText }).questions;
}

/** Correcció orientativa amb IA d'una resposta oberta. */
export async function aiGrade(q: Question, answer: string): Promise<GradeResult> {
  const { data } = await post<{ puntuacio: number; criteris_complerts?: string[]; criteris_no_complerts?: string[]; comentari?: string }>('/api/ai/grade', {
    question: q.prompt,
    reference: q.answer,
    criteria: q.criteria,
    answer,
  });
  const score = Math.max(0, Math.min(1, Number(data.puntuacio) || 0));
  const s = await getSettings();
  return {
    correct: score >= s.srs.openAnswerThreshold,
    score,
    orientative: true,
    matchedCriteria: data.criteris_complerts,
    missedCriteria: data.criteris_no_complerts,
    feedback: `Avaluació orientativa per IA (${Math.round(score * 100)}%): ${data.comentari ?? ''}`,
  };
}
