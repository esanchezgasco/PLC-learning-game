// Construcció d'exàmens globals de tema: barreja apartats, equilibra dificultats i
// prioritza preguntes no practicades i no usades en exàmens anteriors.

import type { Difficulty, ExamConfig, Question } from '../types';
import { seededShuffle } from './text';

export interface ExamHistory {
  practicedIds: Set<string>;
  /** questionId -> nombre d'exàmens anteriors en què ha sortit */
  examUses: Map<string, number>;
  /** Plantilles+concepte ja vistes a la pràctica (per evitar la mateixa pregunta reformulada) */
  practicedKeys?: Set<string>;
}

export interface BuiltExam {
  questions: Question[];
  notes: string[];
}

const TARGET: Record<Difficulty, number> = { easy: 0.3, medium: 0.4, hard: 0.3 };

export function buildExam(all: Question[], config: ExamConfig, history: ExamHistory, seed = Date.now()): BuiltExam {
  const notes: string[] = [];
  let pool = all.filter((q) => !q.archived);
  const flagged = pool.filter((q) => q.needsReview);
  pool = pool.filter((q) => !q.needsReview);
  if (flagged.length) notes.push(`S’han exclòs ${flagged.length} preguntes marcades per revisar.`);

  if (config.difficulty !== 'mixed') {
    const only = pool.filter((q) => q.difficulty === config.difficulty);
    if (only.length >= Math.min(config.questionCount, 5)) pool = only;
    else notes.push(`No hi ha prou preguntes de dificultat «${config.difficulty}»; s’hi han afegit d’altres nivells.`);
  }

  const score = (q: Question) => {
    let s = 0;
    if (q.pool === 'exam') s += 3;
    if (!history.practicedIds.has(q.id)) s += 2;
    if (history.practicedKeys?.has(`${q.template}|${q.concept}`)) s -= 2;
    const uses = history.examUses.get(q.id) ?? 0;
    s -= uses * 3;
    return s;
  };

  // Agrupa per apartat, ordenat per puntuació (amb barreja per desempatar)
  const bySection = new Map<string, Question[]>();
  for (const q of seededShuffle(pool, seed)) {
    const arr = bySection.get(q.sectionId) ?? [];
    arr.push(q);
    bySection.set(q.sectionId, arr);
  }
  bySection.forEach((arr) => arr.sort((a, b) => score(b) - score(a)));

  const chosen: Question[] = [];
  const conceptCount = new Map<string, number>();
  const diffCount: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const sections = seededShuffle(Array.from(bySection.keys()), seed + 1);
  const maxPerConcept = pool.length >= config.questionCount * 2 ? 1 : 2;

  let progress = true;
  while (chosen.length < config.questionCount && progress) {
    progress = false;
    for (const sid of sections) {
      if (chosen.length >= config.questionCount) break;
      const arr = bySection.get(sid)!;
      if (!arr.length) continue;
      // tria el candidat que millor equilibra la dificultat
      const wanted = (d: Difficulty) => TARGET[d] * (chosen.length + 1) - diffCount[d];
      let bestIdx = -1;
      let bestVal = -Infinity;
      arr.forEach((q, i) => {
        if ((conceptCount.get(q.concept) ?? 0) >= maxPerConcept) return;
        const v = score(q) * 2 + (config.difficulty === 'mixed' ? wanted(q.difficulty) * 3 : 0);
        if (v > bestVal) {
          bestVal = v;
          bestIdx = i;
        }
      });
      if (bestIdx < 0) continue;
      const [q] = arr.splice(bestIdx, 1);
      chosen.push(q);
      diffCount[q.difficulty]++;
      conceptCount.set(q.concept, (conceptCount.get(q.concept) ?? 0) + 1);
      progress = true;
    }
  }

  if (chosen.length < config.questionCount) {
    notes.push(
      chosen.length
        ? `Només hi ha ${chosen.length} preguntes fiables i diferents per a aquest tema (s’en demanaven ${config.questionCount}). L’examen té menys preguntes.`
        : 'No hi ha preguntes disponibles per a aquest tema.',
    );
  }
  const reused = chosen.filter((q) => (history.examUses.get(q.id) ?? 0) > 0).length;
  if (reused) notes.push(`${reused} preguntes ja havien aparegut en exàmens anteriors (no n’hi havia prou de noves).`);
  const practiced = chosen.filter((q) => history.practicedIds.has(q.id)).length;
  if (practiced) notes.push(`${practiced} preguntes coincideixen amb preguntes de pràctica.`);
  const covered = new Set(chosen.map((q) => q.sectionId)).size;
  if (covered < bySection.size) notes.push(`L’examen cobreix ${covered} de ${bySection.size} apartats.`);

  return { questions: seededShuffle(chosen, seed + 2), notes };
}

/** Nota sobre 10 a partir de les puntuacions (0..1) de cada pregunta. */
export function examGrade(scores: number[]): number {
  if (!scores.length) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 100) / 10;
}
