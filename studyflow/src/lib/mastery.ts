// Nivell de domini per concepte, basat NOMÉS en respostes (no en haver llegit la teoria).
// La pràctica amb apunts compta, però no és suficient per arribar a "Assolit": cal haver
// encertat sense apunts (examen o repàs).

import type { Attempt, MasteryLevel, Section, SectionProgress } from '../types';

export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  not_started: 'Sense dades',
  not_achieved: 'No assolit',
  learning: 'En procés d’aprenentatge',
  achieved: 'Assolit',
  mastered: 'Ben dominat',
};

export interface ConceptStat {
  concept: string;
  topicId: string;
  sectionId: string;
  total: number;
  correct: number;
  practiceTotal: number;
  practiceCorrect: number;
  closedTotal: number; // sense apunts (examen + repàs)
  closedCorrect: number;
  lastClosedCorrect?: boolean;
  closedDays: Set<string>;
  recent: { correct: boolean; closed: boolean; at: number }[];
  level: MasteryLevel;
}

export function levelFor(s: Omit<ConceptStat, 'level'>): MasteryLevel {
  if (!s.total) return 'not_started';
  const recent = s.recent.slice(-6);
  let w = 0;
  let ok = 0;
  for (const r of recent) {
    const weight = r.closed ? 2 : 1;
    w += weight;
    if (r.correct) ok += weight;
  }
  const acc = w ? ok / w : 0;
  if (acc < 0.5) return 'not_achieved';
  if (!s.closedTotal) return 'learning'; // només pràctica amb teoria
  const closedAcc = s.closedCorrect / s.closedTotal;
  if (acc >= 0.9 && closedAcc >= 0.9 && s.closedTotal >= 3 && s.lastClosedCorrect && s.closedDays.size >= 2) return 'mastered';
  if (acc >= 0.75 && closedAcc >= 0.7 && s.lastClosedCorrect) return 'achieved';
  return 'learning';
}

export function conceptStats(attempts: Attempt[]): ConceptStat[] {
  const map = new Map<string, Omit<ConceptStat, 'level'>>();
  const sorted = attempts.filter((a) => a.finishedAt || a.kind !== 'exam').slice().sort((a, b) => a.startedAt - b.startedAt);
  for (const a of sorted) {
    const closed = a.kind !== 'practice';
    for (const ans of a.answers) {
      const concepts = ans.snapshot.concept.split(' / ');
      for (const concept of concepts) {
        const key = `${a.topicId}|${concept.toLowerCase()}`;
        const s = map.get(key) ?? {
          concept,
          topicId: a.topicId,
          sectionId: ans.snapshot.sectionId,
          total: 0,
          correct: 0,
          practiceTotal: 0,
          practiceCorrect: 0,
          closedTotal: 0,
          closedCorrect: 0,
          closedDays: new Set<string>(),
          recent: [],
        };
        const ok = ans.grade.correct;
        s.total++;
        if (ok) s.correct++;
        if (closed) {
          s.closedTotal++;
          if (ok) s.closedCorrect++;
          s.lastClosedCorrect = ok;
          s.closedDays.add(new Date(ans.answeredAt).toDateString());
        } else {
          s.practiceTotal++;
          if (ok) s.practiceCorrect++;
        }
        s.recent.push({ correct: ok, closed, at: ans.answeredAt });
        map.set(key, s);
      }
    }
  }
  return Array.from(map.values()).map((s) => ({ ...s, level: levelFor(s) }));
}

export interface TopicProgress {
  sectionsTotal: number;
  sectionsRead: number;
  sectionsPracticed: number;
  readPct: number;
  practicedPct: number;
  examAttempts: number;
  bestGrade?: number;
  lastGrade?: number;
  examPassed: boolean;
  grades: { at: number; grade: number }[];
  failedQuestions: number;
  lastStudied?: number;
}

export function topicProgress(sections: Section[], progress: SectionProgress[], attempts: Attempt[]): TopicProgress {
  const ids = new Set(sections.map((s) => s.id));
  const prog = progress.filter((p) => ids.has(p.id));
  const read = prog.filter((p) => p.readAt).length;
  const practiced = prog.filter((p) => p.practicedAt).length;
  const exams = attempts.filter((a) => a.kind === 'exam' && a.finishedAt && a.grade !== undefined).sort((a, b) => a.finishedAt! - b.finishedAt!);
  const grades = exams.map((a) => ({ at: a.finishedAt!, grade: a.grade! }));
  // preguntes l'última resposta de les quals ha estat incorrecta
  const last = new Map<string, boolean>();
  attempts
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)
    .forEach((a) => a.answers.forEach((x) => last.set(x.questionId, x.grade.correct)));
  const failed = Array.from(last.values()).filter((v) => !v).length;
  const times = [
    ...prog.map((p) => Math.max(p.readAt ?? 0, p.practicedAt ?? 0)),
    ...attempts.map((a) => a.finishedAt ?? a.startedAt),
  ].filter(Boolean);
  const best = grades.length ? Math.max(...grades.map((g) => g.grade)) : undefined;
  return {
    sectionsTotal: sections.length,
    sectionsRead: read,
    sectionsPracticed: practiced,
    readPct: sections.length ? read / sections.length : 0,
    practicedPct: sections.length ? practiced / sections.length : 0,
    examAttempts: exams.length,
    bestGrade: best,
    lastGrade: grades.length ? grades[grades.length - 1].grade : undefined,
    examPassed: best !== undefined && best >= 5,
    grades,
    failedQuestions: failed,
    lastStudied: times.length ? Math.max(...times) : undefined,
  };
}
