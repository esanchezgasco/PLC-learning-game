// Repetició espaiada senzilla (sistema de Leitner).
// - Cada pregunta té una "caixa" (0..N). Si l'encertes, puja una caixa; si la falles, torna a la 0.
// - Cada caixa té un interval en dies (configurable). La pregunta "toca" quan ha passat l'interval.
// És una estimació orientativa del moment de repàs, no una predicció exacta del que recordes.

import type { ReviewState, SrsConfig } from '../types';

export const DEFAULT_SRS: SrsConfig = {
  intervals: [0, 1, 3, 7, 16, 35],
  openAnswerThreshold: 0.6,
  sessionSize: 20,
  staleDays: 10,
};

const DAY = 86400000;

export function updateReview(
  prev: ReviewState | undefined,
  base: Omit<ReviewState, 'box' | 'due' | 'lastReviewed' | 'lapses' | 'correctStreak' | 'totalSeen'>,
  correct: boolean,
  cfg: SrsConfig,
  now = Date.now(),
): ReviewState {
  const maxBox = cfg.intervals.length - 1;
  const box = prev ? (correct ? Math.min(prev.box + 1, maxBox) : 0) : correct ? 1 : 0;
  const days = cfg.intervals[box] ?? cfg.intervals[maxBox];
  return {
    ...base,
    box,
    // les fallades tornen l'endemà... o avui mateix si l'interval de la caixa 0 és 0
    due: now + days * DAY,
    lastReviewed: now,
    lapses: (prev?.lapses ?? 0) + (correct ? 0 : 1),
    correctStreak: correct ? (prev?.correctStreak ?? 0) + 1 : 0,
    totalSeen: (prev?.totalSeen ?? 0) + 1,
  };
}

export function isDue(r: ReviewState, now = Date.now()): boolean {
  return r.due <= now;
}

/**
 * Prioritat d'un element de repàs (més alt = més urgent). Ordre:
 * 1) preguntes fallades (caixa 0, amb més fallades primer), 2) poc consolidades,
 * 3) com més endarrerides respecte a la data prevista, més prioritat.
 */
export function reviewPriority(r: ReviewState, now = Date.now()): number {
  const overdueDays = Math.max(0, (now - r.due) / DAY);
  const failed = r.box === 0 ? 100 + r.lapses * 5 : 0;
  const weak = (5 - Math.min(r.box, 5)) * 8;
  return failed + weak + Math.min(overdueDays, 30);
}

export function nextDueLabel(r: ReviewState, now = Date.now()): string {
  const d = Math.ceil((r.due - now) / DAY);
  if (d <= 0) return 'avui';
  if (d === 1) return 'demà';
  return `d’aquí a ${d} dies`;
}
