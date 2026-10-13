import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { conceptStats, MASTERY_LABEL } from '../lib/mastery';
import { Alert, Badge, Card, EmptyState, LinkButton, Loading, MASTERY_TONE, PageHeader, Stat, cx } from '../components/ui';
import { PercentBars } from '../components/Charts';
import { Feedback, TYPE_LABEL } from '../components/QuestionView';
import { PdfPageModal } from '../components/TheoryView';
import { formatDateTime } from '../lib/text';

export default function AttemptResults() {
  const { attemptId } = useParams();
  const data = useLiveQuery(async () => {
    const attempt = await db.attempts.get(attemptId ?? '');
    if (!attempt) return null;
    const [topic, sections, all] = await Promise.all([db.topics.get(attempt.topicId), db.sections.where('topicId').equals(attempt.topicId).toArray(), db.attempts.where('topicId').equals(attempt.topicId).toArray()]);
    return { attempt, topic, sections, all };
  }, [attemptId]);
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');
  const [page, setPage] = useState<{ docId?: string; docName?: string; page: number } | null>(null);

  if (data === undefined) return <Loading />;
  if (data === null) return <EmptyState title="Intent no trobat" />;
  const { attempt, topic, sections, all } = data;
  if (!attempt.finishedAt && attempt.kind === 'exam') return <Alert tone="warn">Aquest examen encara no s’ha lliurat.</Alert>;

  const answers = attempt.answers;
  const blank = answers.filter((a) => a.response.type === 'blank' || (a.response.type === 'text' && !a.response.value.trim())).length;
  const correct = answers.filter((a) => a.grade.correct).length;
  const incorrect = answers.length - correct - blank;
  const pct = answers.length ? answers.reduce((s, a) => s + a.grade.score, 0) / answers.length : 0;
  const secName = new Map(sections.map((s) => [s.id, s]));
  const bySection = new Map<string, { n: number; score: number }>();
  for (const a of answers) {
    const e = bySection.get(a.snapshot.sectionId) ?? { n: 0, score: 0 };
    e.n++;
    e.score += a.grade.score;
    bySection.set(a.snapshot.sectionId, e);
  }
  const sectionRows = Array.from(bySection.entries())
    .map(([id, e]) => ({ id, label: secName.get(id)?.title ?? '(apartat eliminat)', value: e.score / e.n, hint: `${e.n} preg.` }))
    .sort((a, b) => a.value - b.value);
  const weakSections = sectionRows.filter((r) => r.value < 0.6);
  const thisConcepts = conceptStats([attempt]);
  const failedConcepts = thisConcepts.filter((c) => c.correct < c.total);
  const overall = new Map(conceptStats(all).map((c) => [c.concept.toLowerCase(), c]));
  const shown = filter === 'wrong' ? answers.filter((a) => !a.grade.correct) : answers;
  const exam = attempt.kind === 'exam';

  return (
    <>
      <PageHeader
        crumbs={[{ to: `/temes/${attempt.topicId}`, label: topic?.title ?? 'Tema' }]}
        title={exam ? 'Resultats de l’examen' : attempt.kind === 'review' ? 'Resultats del repàs' : 'Resultats de la pràctica'}
        subtitle={`${formatDateTime(attempt.finishedAt ?? attempt.startedAt)} · ${answers.length} preguntes${exam ? ' · sense teoria' : ''}`}
        actions={
          exam && topic ? (
            <LinkButton to={`/temes/${topic.id}/examen`} variant="secondary">
              Repeteix amb preguntes noves
            </LinkButton>
          ) : undefined
        }
      />
      {attempt.notes && attempt.notes.length > 0 && (
        <div className="mb-4">
          <Alert tone="info">
            <ul className="ml-4 list-disc">
              {attempt.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Nota" value={exam ? `${attempt.grade ?? 0} / 10` : `${Math.round(pct * 100)}%`} hint={exam ? ((attempt.grade ?? 0) >= 5 ? 'Aprovat' : 'No aprovat') : undefined} />
        <Stat label="Encerts" value={`${Math.round(pct * 100)}%`} />
        <Stat label="Correctes" value={correct} />
        <Stat label="Incorrectes" value={incorrect} />
        <Stat label="En blanc" value={blank} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Resultats per apartat</h2>
          <PercentBars rows={sectionRows} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Què has de repassar</h2>
          {failedConcepts.length === 0 && weakSections.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Cap concepte fallat en aquest intent. Continua amb el repàs espaiat per consolidar-ho.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {weakSections.length > 0 && (
                <div>
                  <div className="font-medium">Apartats per tornar a estudiar:</div>
                  <ul className="mt-1 ml-5 list-disc">
                    {weakSections.map((r) => (
                      <li key={r.id}>
                        <Link className="text-brand-600 underline" to={`/temes/${attempt.topicId}/apartats/${r.id}`}>
                          {r.label}
                        </Link>{' '}
                        ({Math.round(r.value * 100)}%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {failedConcepts.length > 0 && (
                <div>
                  <div className="font-medium">Conceptes que encara no domines:</div>
                  <ul className="mt-1 space-y-1">
                    {failedConcepts.map((c) => {
                      const o = overall.get(c.concept.toLowerCase());
                      return (
                        <li key={c.concept} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{c.concept}</span>
                          {o && <Badge tone={MASTERY_TONE[o.level]}>{MASTERY_LABEL[o.level]}</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <LinkButton to="/repas" variant="secondary">
                Practica només els errors
              </LinkButton>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Correcció pregunta a pregunta</h2>
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm dark:border-slate-700">
          {(['all', 'wrong'] as const).map((f) => (
            <button key={f} className={cx('rounded-md px-3 py-1', filter === f ? 'bg-brand-600 text-white' : '')} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Totes' : 'Només errors'}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {shown.map((a) => {
          const idx = answers.indexOf(a);
          const sec = secName.get(a.snapshot.sectionId);
          return (
            <Card key={a.questionId + idx}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold">#{idx + 1}</span>
                <Badge tone="blue">{TYPE_LABEL[a.snapshot.type]}</Badge>
                {sec && <span>{sec.title}</span>}
              </div>
              <p className="mb-3 whitespace-pre-line text-slate-900 dark:text-white">{a.snapshot.prompt}</p>
              <div className="mb-3 text-sm">
                <strong>La teva resposta:</strong> <ResponseText a={a} />
              </div>
              <Feedback
                q={a.snapshot}
                grade={a.grade}
                response={a.response}
                docName={sec?.docName ?? a.snapshot.source.docName}
                onOpenPage={a.snapshot.source.docId ? (p) => setPage({ docId: a.snapshot.source.docId, docName: a.snapshot.source.docName, page: p }) : undefined}
              />
            </Card>
          );
        })}
      </div>
      <PdfPageModal docId={page?.docId} docName={page?.docName} page={page?.page ?? null} onClose={() => setPage(null)} />
    </>
  );
}

function ResponseText({ a }: { a: { response: import('../types').AnswerValue; snapshot: { options?: string[] } } }) {
  const r = a.response;
  if (r.type === 'blank') return <em className="text-slate-500">en blanc</em>;
  if (r.type === 'choice') return <span>{String.fromCharCode(65 + r.index)}. {a.snapshot.options?.[r.index]}</span>;
  if (r.type === 'bool') return <span>{r.value ? 'Vertader' : 'Fals'}</span>;
  if (r.type === 'text') return r.value.trim() ? <span className="whitespace-pre-line">{r.value}</span> : <em className="text-slate-500">en blanc</em>;
  return <span>{Object.entries(r.map).filter(([, v]) => v).length} parelles relacionades</span>;
}
