// Correcció de respostes. Les preguntes tancades es corregeixen de manera exacta;
// les obertes amb criteris explícits (cobertura de paraules clau) i sempre com a ORIENTATIVES.

import type { AnswerValue, GradeResult, Question } from '../types';
import { levenshtein, normalize } from './text';

function stem(w: string): string {
  // arrel aproximada per tolerar flexió (plural/gènere) en català i castellà
  return w.length > 5 ? w.slice(0, Math.max(5, w.length - 2)) : w;
}

export function textMatches(given: string, expected: string): boolean {
  const g = normalize(given);
  const e = normalize(expected);
  if (!g || !e) return false;
  if (g === e) return true;
  const strip = (s: string) => s.replace(/^(el|la|els|les|l|un|una|lo|los|las|the|a|an)\s+/, '');
  if (strip(g) === strip(e)) return true;
  const tol = e.length <= 4 ? 0 : e.length <= 8 ? 1 : 2;
  return levenshtein(strip(g), strip(e)) <= tol;
}

export function keywordPresent(answer: string, keyword: string): boolean {
  const a = normalize(answer).split(' ');
  const k = normalize(keyword).split(' ');
  return k.every((kw) => a.some((w) => w === kw || stem(w) === stem(kw) || (kw.length > 6 && levenshtein(w, kw) <= 1)));
}

export function gradeOpen(q: Question, text: string, threshold = 0.6): GradeResult {
  const criteria = q.criteria ?? [];
  if (!text.trim()) return { correct: false, score: 0, feedback: 'Resposta en blanc.', orientative: true, matchedCriteria: [], missedCriteria: criteria.map((c) => c.text) };
  if (!criteria.length) {
    return { correct: false, score: 0, feedback: 'No hi ha criteris automàtics: compara la teva resposta amb la resposta de referència.', orientative: true };
  }
  const matched: string[] = [];
  const missed: string[] = [];
  for (const c of criteria) {
    const hit = c.keywords.some((k) => keywordPresent(text, k));
    (hit ? matched : missed).push(c.text);
  }
  const score = matched.length / criteria.length;
  const correct = score >= threshold;
  return {
    correct,
    score,
    orientative: true,
    matchedCriteria: matched,
    missedCriteria: missed,
    feedback: `Avaluació orientativa: compleix ${matched.length} de ${criteria.length} criteris (${Math.round(score * 100)}%).` + (missed.length ? ` Falta: ${missed.join('; ')}.` : ''),
  };
}

export function grade(q: Question, r: AnswerValue, openThreshold = 0.6): GradeResult {
  if (r.type === 'blank') return { correct: false, score: 0, feedback: 'Sense resposta.', orientative: false };
  switch (q.type) {
    case 'mcq': {
      const ok = r.type === 'choice' && String(r.index) === q.answer;
      return { correct: ok, score: ok ? 1 : 0, orientative: false, feedback: ok ? 'La teva resposta coincideix amb la resposta correcta.' : `Incorrecte. La resposta correcta és: «${q.options?.[Number(q.answer)] ?? ''}».` };
    }
    case 'truefalse': {
      const ok = r.type === 'bool' && String(r.value) === q.answer;
      return { correct: ok, score: ok ? 1 : 0, orientative: false, feedback: ok ? 'La teva resposta coincideix amb la resposta correcta.' : `Incorrecte. L’afirmació és ${q.answer === 'true' ? 'vertadera' : 'falsa'}.` };
    }
    case 'cloze': {
      const val = r.type === 'text' ? r.value : '';
      const ok = [q.answer, ...(q.acceptable ?? [])].some((e) => textMatches(val, e));
      return { correct: ok, score: ok ? 1 : 0, orientative: false, feedback: ok ? 'La teva resposta coincideix amb la resposta correcta.' : `Incorrecte. La resposta esperada és: «${q.answer}».` };
    }
    case 'matching': {
      const pairs = q.pairs ?? [];
      const map = r.type === 'matching' ? r.map : {};
      const good = pairs.filter((p) => normalize(map[p.left] ?? '') === normalize(p.right)).length;
      const score = pairs.length ? good / pairs.length : 0;
      return { correct: score === 1, score, orientative: false, feedback: `${good} de ${pairs.length} parelles correctes.` };
    }
    case 'short':
    case 'difference':
    case 'case':
      return gradeOpen(q, r.type === 'text' ? r.value : '', openThreshold);
  }
}

export function isAnswered(r: AnswerValue | undefined): boolean {
  if (!r || r.type === 'blank') return false;
  if (r.type === 'text') return r.value.trim().length > 0;
  if (r.type === 'matching') return Object.values(r.map).some(Boolean);
  return true;
}
