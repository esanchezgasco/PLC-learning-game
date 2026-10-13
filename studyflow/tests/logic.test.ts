import { describe, it, expect } from 'vitest';
import { grade, textMatches } from '../src/lib/grading';
import { updateReview, DEFAULT_SRS, reviewPriority } from '../src/lib/srs';
import { levelFor, conceptStats } from '../src/lib/mastery';
import { checkQuestions } from '../src/lib/quality';
import { examGrade } from '../src/lib/exam';
import type { Attempt, Question } from '../src/types';
// @ts-expect-error mòdul JS del servidor
import { createAiMiddleware } from '../server/ai-handler.mjs';

const base: Question = {
  id: 'q1', subjectId: 's', topicId: 't', sectionId: 'sec', type: 'mcq', prompt: 'Quina és la resposta correcta?',
  options: ['A', 'B', 'C', 'D'], answer: '2', explanation: 'Perquè sí', difficulty: 'medium', concept: 'c', template: 'x',
  pool: 'practice', origin: 'local', needsReview: false, flags: [], generation: 1, createdAt: 0,
  source: { sectionId: 'sec', pages: [1], excerpt: 'El text diu això.', verified: true },
};

describe('correcció', () => {
  it('corregeix test, V/F i completar amb tolerància', () => {
    expect(grade(base, { type: 'choice', index: 2 }).correct).toBe(true);
    expect(grade(base, { type: 'choice', index: 1 }).correct).toBe(false);
    expect(grade({ ...base, type: 'truefalse', answer: 'false' }, { type: 'bool', value: false }).correct).toBe(true);
    expect(textMatches('Notificacio', 'notificació')).toBe(true);
    expect(textMatches('la notificació', 'notificació')).toBe(true);
    expect(textMatches('publicació', 'notificació')).toBe(false);
    expect(grade(base, { type: 'blank' }).score).toBe(0);
  });
  it('corregeix preguntes obertes per criteris i marca la correcció com a orientativa', () => {
    const q: Question = { ...base, type: 'short', criteria: [{ text: 'comunica', keywords: ['comunica'] }, { text: 'interessades', keywords: ['interessades'] }] };
    const g = grade(q, { type: 'text', value: 'Mitjà per comunicar l’acte a les persones interessades' });
    expect(g.orientative).toBe(true);
    expect(g.correct).toBe(true);
    expect(grade(q, { type: 'text', value: 'no ho sé' }).correct).toBe(false);
  });
  it('corregeix relacionar per parelles', () => {
    const q: Question = { ...base, type: 'matching', pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] };
    const g = grade(q, { type: 'matching', map: { a: '1', b: '1' } });
    expect(g.score).toBe(0.5);
    expect(g.correct).toBe(false);
  });
  it('calcula la nota sobre 10', () => {
    expect(examGrade([1, 1, 0, 0.5])).toBe(6.3);
  });
});

describe('repetició espaiada', () => {
  it('puja de caixa en encertar i torna a 0 en fallar', () => {
    const b = { id: 'q', subjectId: 's', topicId: 't', concept: 'c' };
    const now = 1_000_000;
    let r = updateReview(undefined, b, true, DEFAULT_SRS, now);
    expect(r.box).toBe(1);
    expect(r.due).toBe(now + 86400000);
    r = updateReview(r, b, true, DEFAULT_SRS, now);
    expect(r.box).toBe(2);
    r = updateReview(r, b, false, DEFAULT_SRS, now);
    expect(r.box).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.due).toBe(now);
    expect(reviewPriority(r, now)).toBeGreaterThan(reviewPriority({ ...r, box: 3, lapses: 0 }, now));
  });
});

describe('nivell de domini', () => {
  const ans = (correct: boolean, at: number) => ({ questionId: 'q', snapshot: { ...base, concept: 'X' }, response: { type: 'blank' as const }, grade: { correct, score: correct ? 1 : 0, feedback: '', orientative: false }, answeredAt: at });
  const att = (kind: Attempt['kind'], answers: ReturnType<typeof ans>[], t: number): Attempt => ({ id: String(t), subjectId: 's', topicId: 't', kind, startedAt: t, finishedAt: t, questionIds: [], answers });
  it('la pràctica amb apunts no basta per arribar a assolit', () => {
    const [c] = conceptStats([att('practice', [ans(true, 1), ans(true, 2), ans(true, 3)], 1)]);
    expect(c.level).toBe('learning');
  });
  it('encerts sense apunts en dies diferents → ben dominat', () => {
    const d = 86400000;
    const [c] = conceptStats([att('exam', [ans(true, 1)], 1), att('review', [ans(true, d * 2)], d * 2), att('exam', [ans(true, d * 5)], d * 5)]);
    expect(c.level).toBe('mastered');
  });
  it('errors → no assolit', () => {
    const [c] = conceptStats([att('exam', [ans(false, 1), ans(false, 2)], 1)]);
    expect(c.level).toBe('not_achieved');
    expect(levelFor({ ...c, total: 0 })).toBe('not_started');
  });
});

describe('qualitat', () => {
  it('detecta opcions duplicades, fonts no verificables i duplicats', () => {
    const src = { sec: 'El text diu això.' };
    const dupOpts = { ...base, id: 'a', prompt: 'Pregunta amb opcions repetides?', options: ['A', 'A', 'C', 'D'] };
    const badSrc = { ...base, id: 'b', prompt: 'Una altra pregunta diferent?', source: { ...base.source, excerpt: 'Frase inventada que no hi és enlloc del document' } };
    const dup = { ...base, id: 'c' };
    const { questions, issues } = checkQuestions([structuredClone(base), dupOpts, badSrc, dup], src);
    expect(questions.find((q) => q.id === 'a')!.needsReview).toBe(true);
    expect(questions.find((q) => q.id === 'b')!.source.verified).toBe(false);
    expect(questions.find((q) => q.id === 'c')).toBeUndefined();
    expect(issues.some((i) => /duplicada/.test(i.issue))).toBe(true);
  });
});

describe('capa d’IA del servidor sense clau', () => {
  const call = (url: string, method = 'GET', body?: unknown) =>
    new Promise<{ status: number; json: Record<string, unknown> }>((resolve) => {
      const mw = createAiMiddleware({ ANTHROPIC_API_KEY: '', AI_MAX_INPUT_CHARS: '100' });
      const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
      const req = Object.assign((async function* () { yield* chunks; })(), { url, method });
      const res = { statusCode: 0, setHeader() {}, end(s: string) { resolve({ status: this.statusCode, json: JSON.parse(s) }); } };
      mw(req, res, () => resolve({ status: 404, json: {} }));
    });
  it('informa que no està configurada i no exposa claus', async () => {
    const r = await call('/api/ai/status');
    expect(r.status).toBe(200);
    expect(r.json.configured).toBe(false);
    expect(JSON.stringify(r.json)).not.toMatch(/sk-|apiKey|API_KEY/);
  });
  it('retorna un error clar si es demana IA sense clau', async () => {
    const r = await call('/api/ai/theory', 'POST', { sourceText: 'x' });
    expect(r.status).toBe(503);
    expect(String(r.json.error)).toMatch(/ANTHROPIC_API_KEY/);
  });
});
