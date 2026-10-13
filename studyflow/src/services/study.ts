// Operacions d'estudi: aplicar estructura, generar material, registrar intents, repàs.
import { db, getSettings, updateSettings } from '../db/db';
import { buildStructure } from '../lib/structure';
import { buildExtractiveTheory } from '../lib/theory';
import { generateLocalQuestions, topicContext, type SectionInput } from '../lib/questions';
import { checkQuestions } from '../lib/quality';
import { grade } from '../lib/grading';
import { updateReview } from '../lib/srs';
import { uid } from '../lib/text';
import type { AnswerValue, Attempt, AttemptAnswer, OutlineNode, Question, Section, Topic } from '../types';

function toInput(s: Section): SectionInput {
  return { id: s.id, subjectId: s.subjectId, topicId: s.topicId, title: s.title, sourceText: s.sourceText, documentId: s.documentId, docName: s.docName };
}

/**
 * Crea temes i apartats a partir de l'estructura revisada d'un document.
 * Si el document ja tenia temes, es substitueixen; l'historial d'intents es conserva
 * (cada resposta guarda una còpia de la pregunta).
 */
export async function applyStructure(docId: string, outline: OutlineNode[]): Promise<Topic[]> {
  const doc = await db.documents.get(docId);
  if (!doc) throw new Error('Document no trobat');
  if (doc.status !== 'processed') throw new Error('El document no està processat correctament.');
  const pages = await db.pages.where('docId').equals(docId).sortBy('pageNumber');
  const built = buildStructure(pages, outline, doc.name);
  if (!built.length) throw new Error('No s’ha pogut construir cap tema amb el text extret.');

  const existing = await db.topics.where('documentId').equals(docId).toArray();
  const subjectTopics = await db.topics.where('subjectId').equals(doc.subjectId).toArray();
  let order = subjectTopics.filter((t) => t.documentId !== docId).reduce((m, t) => Math.max(m, t.order), 0);
  const now = Date.now();
  const topics: Topic[] = [];
  const sections: Section[] = [];
  for (const bt of built) {
    const topic: Topic = { id: uid('t'), subjectId: doc.subjectId, title: bt.title, order: ++order, documentId: docId, pageStart: bt.pageStart, pageEnd: bt.pageEnd, createdAt: now };
    topics.push(topic);
    bt.sections.forEach((bs, i) => {
      sections.push({
        id: uid('s'),
        topicId: topic.id,
        subjectId: doc.subjectId,
        title: bs.title,
        order: i + 1,
        documentId: docId,
        docName: doc.name,
        pageStart: bs.pageStart,
        pageEnd: bs.pageEnd,
        sourceText: bs.sourceText,
        theory: buildExtractiveTheory(bs.title, bs.sourceText),
        createdAt: now,
        updatedAt: now,
      });
    });
  }
  const questions: Question[] = [];
  for (const t of topics) {
    const secs = sections.filter((s) => s.topicId === t.id);
    const inputs = secs.map(toInput);
    const generated = inputs.flatMap((si) => generateLocalQuestions(si, topicContext(inputs, si.id), 1));
    questions.push(...checkQuestions(generated, Object.fromEntries(secs.map((s) => [s.id, s.sourceText]))).questions);
  }

  await db.transaction('rw', [db.topics, db.sections, db.questions, db.documents, db.progress, db.reviews], async () => {
    for (const t of existing) await deleteTopicContent(t.id, { keepAttempts: true });
    await db.topics.bulkAdd(topics);
    await db.sections.bulkAdd(sections);
    await db.questions.bulkAdd(questions);
    await db.documents.update(docId, { outline, structureApplied: true });
  });
  return topics;
}

/** Elimina el contingut d'un tema. Per defecte conserva l'historial d'intents. */
export async function deleteTopicContent(topicId: string, opts: { keepAttempts: boolean }) {
  await db.sections.where('topicId').equals(topicId).delete();
  await db.questions.where('topicId').equals(topicId).delete();
  await db.progress.where('topicId').equals(topicId).delete();
  await db.reviews.where('topicId').equals(topicId).delete();
  if (!opts.keepAttempts) await db.attempts.where('topicId').equals(topicId).delete();
  await db.topics.delete(topicId);
}

export async function deleteTopic(topicId: string) {
  await db.transaction('rw', [db.topics, db.sections, db.questions, db.progress, db.reviews, db.attempts], () => deleteTopicContent(topicId, { keepAttempts: false }));
}

/** Elimina un document i, opcionalment, els temes que se'n van derivar. */
export async function deleteDocument(docId: string, withTopics: boolean) {
  await db.transaction('rw', [db.documents, db.blobs, db.pages, db.topics, db.sections, db.questions, db.progress, db.reviews, db.attempts], async () => {
    if (withTopics) {
      const topics = await db.topics.where('documentId').equals(docId).toArray();
      for (const t of topics) await deleteTopicContent(t.id, { keepAttempts: false });
    } else {
      await db.topics.where('documentId').equals(docId).modify({ documentId: undefined });
    }
    await db.pages.where('docId').equals(docId).delete();
    await db.blobs.delete(docId);
    await db.documents.delete(docId);
  });
}

export async function deleteSubject(subjectId: string) {
  await db.transaction('rw', db.tables, async () => {
    const docs = await db.documents.where('subjectId').equals(subjectId).primaryKeys();
    for (const d of docs) {
      await db.pages.where('docId').equals(d).delete();
      await db.blobs.delete(d);
    }
    await db.documents.where('subjectId').equals(subjectId).delete();
    await db.topics.where('subjectId').equals(subjectId).delete();
    await db.sections.where('subjectId').equals(subjectId).delete();
    await db.questions.where('subjectId').equals(subjectId).delete();
    await db.attempts.where('subjectId').equals(subjectId).delete();
    await db.reviews.where('subjectId').equals(subjectId).delete();
    await db.progress.where('subjectId').equals(subjectId).delete();
    await db.subjects.delete(subjectId);
    const s = await getSettings();
    if (s.lastStudied?.subjectId === subjectId) await updateSettings({ lastStudied: undefined });
  });
}

/**
 * Regenera el banc de preguntes d'un tema. Les preguntes anteriors s'arxiven (no s'esborren)
 * perquè l'historial d'intents i el repàs continuïn sent consultables.
 */
export async function regenerateTopicQuestions(topicId: string): Promise<number> {
  const secs = await db.sections.where('topicId').equals(topicId).sortBy('order');
  const old = await db.questions.where('topicId').equals(topicId).toArray();
  const generation = old.reduce((m, q) => Math.max(m, q.generation), 0) + 1;
  const inputs = secs.map(toInput);
  const generated = inputs.flatMap((si) => generateLocalQuestions(si, topicContext(inputs, si.id), generation));
  const { questions } = checkQuestions(generated, Object.fromEntries(secs.map((s) => [s.id, s.sourceText])));
  await db.transaction('rw', db.questions, async () => {
    await db.questions.where('topicId').equals(topicId).filter((q) => q.origin === 'local' && !q.archived).modify({ archived: true });
    await db.questions.bulkAdd(questions);
  });
  return questions.length;
}

/** Torna a generar la teoria extractiva d'un apartat (es perden les edicions manuals). */
export async function regenerateSectionTheory(sectionId: string) {
  const s = await db.sections.get(sectionId);
  if (!s) return;
  await db.sections.update(sectionId, { theory: buildExtractiveTheory(s.title, s.sourceText), theoryEdited: false, updatedAt: Date.now() });
}

export async function markRead(section: Section) {
  const p = (await db.progress.get(section.id)) ?? { id: section.id, topicId: section.topicId, subjectId: section.subjectId };
  await db.progress.put({ ...p, readAt: Date.now() });
  await updateSettings({ lastStudied: { subjectId: section.subjectId, topicId: section.topicId, sectionId: section.id, at: Date.now() } });
}

export function snapshotOf(q: Question): AttemptAnswer['snapshot'] {
  return {
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    pairs: q.pairs,
    answer: q.answer,
    explanation: q.explanation,
    source: q.source,
    concept: q.concept,
    sectionId: q.sectionId,
    difficulty: q.difficulty,
    criteria: q.criteria,
  };
}

export async function startAttempt(p: { subjectId: string; topicId: string; sectionId?: string; kind: Attempt['kind']; questionIds: string[]; config?: Attempt['config']; notes?: string[] }): Promise<Attempt> {
  const a: Attempt = { id: uid('a'), startedAt: Date.now(), answers: [], ...p };
  await db.attempts.add(a);
  await updateSettings({ lastStudied: { subjectId: p.subjectId, topicId: p.topicId, sectionId: p.sectionId, at: Date.now() } });
  return a;
}

/** Corregeix i desa una resposta (pràctica i repàs: una a una). */
export async function answerQuestion(attemptId: string, q: Question, response: AnswerValue, gradeOverride?: AttemptAnswer['grade']): Promise<AttemptAnswer> {
  const settings = await getSettings();
  const g = gradeOverride ?? grade(q, response, settings.srs.openAnswerThreshold);
  const ans: AttemptAnswer = { questionId: q.id, snapshot: snapshotOf(q), response, grade: g, answeredAt: Date.now() };
  await db.transaction('rw', db.attempts, db.reviews, async () => {
    const a = await db.attempts.get(attemptId);
    if (!a) throw new Error('Intent no trobat');
    await db.attempts.update(attemptId, { answers: [...a.answers, ans] });
    const prev = await db.reviews.get(q.id);
    await db.reviews.put(updateReview(prev, { id: q.id, subjectId: q.subjectId, topicId: q.topicId, concept: q.concept }, g.correct, settings.srs));
  });
  return ans;
}

export async function finishPractice(attemptId: string) {
  const a = await db.attempts.get(attemptId);
  if (!a) return;
  await db.attempts.update(attemptId, { finishedAt: Date.now() });
  if (a.sectionId && a.kind === 'practice' && a.answers.length) {
    const score = a.answers.reduce((s, x) => s + x.grade.score, 0) / a.answers.length;
    const s = await db.sections.get(a.sectionId);
    if (s) {
      const p = (await db.progress.get(s.id)) ?? { id: s.id, topicId: s.topicId, subjectId: s.subjectId };
      await db.progress.put({ ...p, practicedAt: Date.now(), practiceLast: score, practiceBest: Math.max(p.practiceBest ?? 0, score) });
    }
  }
}

/** Lliura un examen: corregeix totes les respostes alhora i calcula la nota. */
export async function submitExam(attemptId: string, questions: Question[], responses: Record<string, AnswerValue>, overrides: Record<string, AttemptAnswer['grade']> = {}): Promise<Attempt> {
  const settings = await getSettings();
  const now = Date.now();
  const answers: AttemptAnswer[] = questions.map((q) => {
    const r = responses[q.id] ?? { type: 'blank' as const };
    return { questionId: q.id, snapshot: snapshotOf(q), response: r, grade: overrides[q.id] ?? grade(q, r, settings.srs.openAnswerThreshold), answeredAt: now };
  });
  const scores = answers.map((a) => a.grade.score);
  const gradeVal = scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 100) / 10 : 0;
  await db.transaction('rw', db.attempts, db.reviews, async () => {
    await db.attempts.update(attemptId, { answers, finishedAt: now, grade: gradeVal });
    for (const q of questions) {
      const a = answers.find((x) => x.questionId === q.id)!;
      const prev = await db.reviews.get(q.id);
      await db.reviews.put(updateReview(prev, { id: q.id, subjectId: q.subjectId, topicId: q.topicId, concept: q.concept }, a.grade.correct, settings.srs, now));
    }
  });
  return (await db.attempts.get(attemptId))!;
}
