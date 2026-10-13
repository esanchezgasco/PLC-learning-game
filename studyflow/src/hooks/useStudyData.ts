import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { conceptStats, topicProgress, type ConceptStat, type TopicProgress } from '../lib/mastery';
import type { Attempt, ReviewState, Section, SectionProgress, Subject, Topic } from '../types';

export interface TopicSummary {
  topic: Topic;
  sections: Section[];
  progress: TopicProgress;
}

export interface SubjectSummary {
  subject: Subject;
  topics: TopicSummary[];
  readPct: number;
  practicedPct: number;
  examsPassed: number;
  dueReviews: number;
  lastStudied?: number;
  concepts: ConceptStat[];
  attempts: Attempt[];
}

export async function loadSubjectSummary(subject: Subject, now = Date.now()): Promise<SubjectSummary> {
  const [topics, sections, progress, attempts, reviews] = await Promise.all([
    db.topics.where('subjectId').equals(subject.id).sortBy('order'),
    db.sections.where('subjectId').equals(subject.id).toArray(),
    db.progress.where('subjectId').equals(subject.id).toArray(),
    db.attempts.where('subjectId').equals(subject.id).toArray(),
    db.reviews.where('subjectId').equals(subject.id).toArray(),
  ]);
  return summarize(subject, topics, sections, progress, attempts, reviews, now);
}

export function summarize(subject: Subject, topics: Topic[], sections: Section[], progress: SectionProgress[], attempts: Attempt[], reviews: ReviewState[], now = Date.now()): SubjectSummary {
  const ts: TopicSummary[] = topics.map((t) => {
    const secs = sections.filter((s) => s.topicId === t.id).sort((a, b) => a.order - b.order);
    return { topic: t, sections: secs, progress: topicProgress(secs, progress, attempts.filter((a) => a.topicId === t.id)) };
  });
  const total = sections.length || 1;
  const topicIds = new Set(topics.map((t) => t.id));
  return {
    subject,
    topics: ts,
    readPct: progress.filter((p) => p.readAt && topicIds.has(p.topicId)).length / total,
    practicedPct: progress.filter((p) => p.practicedAt && topicIds.has(p.topicId)).length / total,
    examsPassed: ts.filter((t) => t.progress.examPassed).length,
    dueReviews: reviews.filter((r) => r.due <= now && topicIds.has(r.topicId)).length,
    lastStudied: Math.max(0, ...ts.map((t) => t.progress.lastStudied ?? 0)) || undefined,
    concepts: conceptStats(attempts.filter((a) => topicIds.has(a.topicId))),
    attempts,
  };
}

export function useAllSummaries(): SubjectSummary[] | undefined {
  return useLiveQuery(async () => {
    const subjects = await db.subjects.orderBy('createdAt').toArray();
    return Promise.all(subjects.map((s) => loadSubjectSummary(s)));
  }, []);
}

export function useSubjectSummary(subjectId?: string): SubjectSummary | null | undefined {
  return useLiveQuery(async () => {
    if (!subjectId) return null;
    const s = await db.subjects.get(subjectId);
    return s ? loadSubjectSummary(s) : null;
  }, [subjectId]);
}
