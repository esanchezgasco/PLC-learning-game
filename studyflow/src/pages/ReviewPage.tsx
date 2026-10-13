import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { useAllSummaries } from '../hooks/useStudyData';
import { nextDueLabel, reviewPriority } from '../lib/srs';
import { MASTERY_LABEL } from '../lib/mastery';
import { isAnswered } from '../lib/grading';
import { daysBetween, formatDate } from '../lib/text';
import { answerQuestion, finishPractice, startAttempt } from '../services/study';
import { Alert, Badge, Button, Card, EmptyState, LinkButton, Loading, MASTERY_TONE, PageHeader, Stat } from '../components/ui';
import { DIFF_LABEL, Feedback, QuestionInput, TYPE_LABEL } from '../components/QuestionView';
import type { AnswerValue, AttemptAnswer, Question } from '../types';

export default function ReviewPage() {
  const settings = useSettings();
  const summaries = useAllSummaries();
  const [subjectFilter, setSubjectFilter] = useState('');
  const [session, setSession] = useState<Question[] | null>(null);
  const data = useLiveQuery(async () => {
    const [reviews, questions] = await Promise.all([db.reviews.toArray(), db.questions.toArray()]);
    return { reviews, questions };
  }, [session]);

  const now = Date.now();
  const computed = useMemo(() => {
    if (!data) return null;
    const qById = new Map(data.questions.map((q) => [q.id, q]));
    const rs = data.reviews.filter((r) => qById.has(r.id) && (!subjectFilter || r.subjectId === subjectFilter));
    const due = rs.filter((r) => r.due <= now).sort((a, b) => reviewPriority(b, now) - reviewPriority(a, now));
    const failed = rs.filter((r) => r.box === 0).sort((a, b) => b.lapses - a.lapses);
    const upcoming = rs.filter((r) => r.due > now).sort((a, b) => a.due - b.due);
    return { qById, due, failed, upcoming };
  }, [data, subjectFilter, now]);

  if (!summaries || !computed) return <Loading />;
  if (session) return <ReviewRunner questions={session} onExit={() => setSession(null)} />;

  const subs = summaries.filter((s) => !subjectFilter || s.subject.id === subjectFilter);
  const weakConcepts = subs.flatMap((s) => s.concepts.filter((c) => c.level === 'not_achieved' || c.level === 'learning').map((c) => ({ c, s })));
  const stale = subs.flatMap((s) => s.topics.filter((t) => t.progress.lastStudied && daysBetween(t.progress.lastStudied, now) >= settings.srs.staleDays).map((t) => ({ t, s })));
  const notPassed = subs.flatMap((s) => s.topics.filter((t) => t.progress.sectionsRead > 0 && !t.progress.examPassed).map((t) => ({ t, s })));
  const topicTitle = new Map(summaries.flatMap((s) => s.topics.map((t) => [t.topic.id, t.topic.title] as const)));
  const pick = (ids: string[]) => ids.map((id) => computed.qById.get(id)).filter(Boolean).slice(0, settings.srs.sessionSize) as Question[];

  return (
    <>
      <PageHeader
        title="Repàs pendent"
        subtitle="Repetició espaiada: les preguntes fallades tornen aviat; les encertades s’espaien cada cop més."
        actions={
          <select className="input w-56" aria-label="Filtra per assignatura" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">Totes les assignatures</option>
            {summaries.map((s) => (
              <option key={s.subject.id} value={s.subject.id}>
                {s.subject.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Toca repassar avui" value={computed.due.length} />
        <Stat label="Preguntes fallades" value={computed.failed.length} hint="última resposta incorrecta" />
        <Stat label="Conceptes febles" value={weakConcepts.length} />
        <Stat label="Temes sense examen superat" value={notPassed.length} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Sessió de repàs</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {computed.due.length ? `${Math.min(computed.due.length, settings.srs.sessionSize)} preguntes, prioritzant les fallades i les més endarrerides.` : 'No hi ha res pendent per avui.'} Sense teoria; correcció immediata.
          </p>
          <Button className="mt-3" disabled={!computed.due.length} onClick={() => setSession(pick(computed.due.map((r) => r.id)))}>
            Comença el repàs
          </Button>
        </Card>
        <Card>
          <h2 className="font-semibold">Practica només els errors</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{computed.failed.length} preguntes que vas fallar l’última vegada, encara que no els toqui avui.</p>
          <Button className="mt-3" variant="secondary" disabled={!computed.failed.length} onClick={() => setSession(pick(computed.failed.map((r) => r.id)))}>
            Repassa els errors
          </Button>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">1. Preguntes fallades</h2>
          {computed.failed.length === 0 ? (
            <p className="text-sm text-slate-500">Cap.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {computed.failed.slice(0, 8).map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">{computed.qById.get(r.id)?.prompt}</span>
                  <Badge tone="red">{r.lapses}×</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">2. Conceptes amb resultats baixos</h2>
          {weakConcepts.length === 0 ? (
            <p className="text-sm text-slate-500">Cap (o encara no hi ha prou respostes).</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {weakConcepts.slice(0, 10).map(({ c }) => (
                <li key={c.topicId + c.concept} className="flex justify-between gap-2">
                  <Link to={`/temes/${c.topicId}/apartats/${c.sectionId}`} className="line-clamp-1 hover:underline">
                    {c.concept}
                  </Link>
                  <Badge tone={MASTERY_TONE[c.level]}>{MASTERY_LABEL[c.level]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">3. Temes estudiats fa temps (≥ {settings.srs.staleDays} dies)</h2>
          {stale.length === 0 ? (
            <p className="text-sm text-slate-500">Cap.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {stale.map(({ t }) => (
                <li key={t.topic.id} className="flex justify-between gap-2">
                  <Link to={`/temes/${t.topic.id}`} className="hover:underline">
                    {t.topic.title}
                  </Link>
                  <span className="text-slate-500">{formatDate(t.progress.lastStudied)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">4. Temes sense l’examen global superat</h2>
          {notPassed.length === 0 ? (
            <p className="text-sm text-slate-500">Cap.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {notPassed.map(({ t }) => (
                <li key={t.topic.id} className="flex items-center justify-between gap-2">
                  <span>{t.topic.title}</span>
                  <LinkButton to={`/temes/${t.topic.id}/examen`} variant="ghost" className="px-2 py-1">
                    Examen ›
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {computed.upcoming.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-2 font-semibold">Pròxims repassos</h2>
          <ul className="space-y-1 text-sm">
            {computed.upcoming.slice(0, 8).map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="line-clamp-1">
                  {topicTitle.get(r.topicId)} · {r.concept}
                </span>
                <span className="shrink-0 text-slate-500">{nextDueLabel(r, now)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <Alert tone="info" title="Com funciona (algoritme de Leitner)">
          Cada pregunta té una «caixa». Si l’encertes puja una caixa; si la falles torna a la primera. Intervals actuals (dies): {settings.srs.intervals.join(', ')}. Es poden canviar a Configuració. Les dates són una estimació orientativa del millor moment per repassar, no una predicció del que recordaràs.
        </Alert>
      </div>
      {computed.due.length === 0 && computed.failed.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Res pendent">Respon qüestionaris i exàmens: les preguntes s’afegiran automàticament al repàs.</EmptyState>
        </div>
      )}
    </>
  );
}

function ReviewRunner({ questions, onExit }: { questions: Question[]; onExit: () => void }) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState<AnswerValue | undefined>();
  const [result, setResult] = useState<AttemptAnswer | null>(null);
  const [attempts, setAttempts] = useState<Record<string, string>>({});
  const [score, setScore] = useState({ ok: 0, n: 0 });
  const q = questions[i];

  const check = async () => {
    if (!q || !value) return;
    let aid = attempts[q.topicId];
    if (!aid) {
      aid = (await startAttempt({ subjectId: q.subjectId, topicId: q.topicId, kind: 'review', questionIds: questions.filter((x) => x.topicId === q.topicId).map((x) => x.id) })).id;
      setAttempts((m) => ({ ...m, [q.topicId]: aid }));
    }
    const ans = await answerQuestion(aid, q, value);
    setResult(ans);
    setScore((s) => ({ ok: s.ok + (ans.grade.correct ? 1 : 0), n: s.n + 1 }));
  };
  const next = async () => {
    setResult(null);
    setValue(undefined);
    if (i + 1 >= questions.length) await Promise.all(Object.values(attempts).map((id) => finishPractice(id)));
    setI(i + 1);
  };

  if (!q)
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-semibold">Repàs completat</h2>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {score.ok}/{score.n}
        </p>
        <p className="text-sm text-slate-500">Les preguntes encertades s’han espaiat; les fallades tornaran aviat.</p>
        <Button className="mt-4" onClick={onExit}>
          Torna al repàs
        </Button>
      </Card>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <span>
          Repàs · pregunta {i + 1} de {questions.length} · sense teoria
        </span>
        <Button size="sm" variant="ghost" onClick={onExit}>
          Surt
        </Button>
      </div>
      <Card>
        <div className="mb-3 flex gap-2">
          <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
          <Badge>{DIFF_LABEL[q.difficulty]}</Badge>
        </div>
        <p className="mb-4 text-lg whitespace-pre-line text-slate-900 dark:text-white">{q.prompt}</p>
        <QuestionInput q={q} value={result ? result.response : value} onChange={setValue} disabled={!!result} />
        <div className="mt-4 flex gap-2">
          {!result ? (
            <Button onClick={check} disabled={!isAnswered(value)}>
              Comprova
            </Button>
          ) : (
            <Button onClick={next}>{i + 1 < questions.length ? 'Següent' : 'Acaba'}</Button>
          )}
        </div>
        {result && (
          <div className="mt-5">
            <Feedback q={result.snapshot} grade={result.grade} response={result.response} />
          </div>
        )}
      </Card>
    </div>
  );
}
