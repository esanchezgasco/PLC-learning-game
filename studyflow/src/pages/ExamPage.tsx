import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { setExamRunning } from '../hooks/examMode';
import { buildExam } from '../lib/exam';
import { isAnswered } from '../lib/grading';
import { startAttempt, submitExam } from '../services/study';
import { Alert, Badge, Button, Card, EmptyState, LinkButton, Loading, PageHeader, cx, useConfirm } from '../components/ui';
import { QuestionInput, TYPE_LABEL } from '../components/QuestionView';
import type { AnswerValue, Attempt, ExamConfig, Question } from '../types';

export default function ExamPage() {
  const { topicId } = useParams();
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const topic = await db.topics.get(topicId ?? '');
    if (!topic) return null;
    const [questions, attempts, sections] = await Promise.all([
      db.questions.where('topicId').equals(topic.id).toArray(),
      db.attempts.where('topicId').equals(topic.id).toArray(),
      db.sections.where('topicId').equals(topic.id).toArray(),
    ]);
    return { topic, questions, attempts, sections };
  }, [topicId]);
  const [running, setRunning] = useState<{ attempt: Attempt; questions: Question[] } | null>(null);
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!config) setConfig(settings.examDefaults);
  }, [settings.examDefaults, config]);

  if (data === undefined || !config) return <Loading />;
  if (data === null) return <EmptyState title="Tema no trobat" />;
  const { topic, questions, attempts, sections } = data;
  const active = questions.filter((q) => !q.archived);
  const inProgress = attempts.find((a) => a.kind === 'exam' && !a.finishedAt);

  if (running) return <ExamRunner attempt={running.attempt} questions={running.questions} topicTitle={topic.title} onSubmitted={(id) => nav(`/intents/${id}`, { replace: true })} />;

  const resume = () => {
    if (!inProgress) return;
    const byId = new Map(questions.map((q) => [q.id, q]));
    const qs = inProgress.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];
    setRunning({ attempt: inProgress, questions: qs });
  };

  const start = async () => {
    const practicedIds = new Set<string>();
    const practicedKeys = new Set<string>();
    const examUses = new Map<string, number>();
    const byId = new Map(questions.map((q) => [q.id, q]));
    for (const a of attempts) {
      if (a.kind === 'exam') a.questionIds.forEach((id) => examUses.set(id, (examUses.get(id) ?? 0) + 1));
      else
        a.answers.forEach((x) => {
          practicedIds.add(x.questionId);
          const q = byId.get(x.questionId);
          if (q) practicedKeys.add(`${q.template}|${q.concept}`);
        });
    }
    const exam = buildExam(active, config, { practicedIds, examUses, practicedKeys });
    if (!exam.questions.length) return;
    if (inProgress) await db.attempts.delete(inProgress.id);
    const attempt = await startAttempt({ subjectId: topic.subjectId, topicId: topic.id, kind: 'exam', questionIds: exam.questions.map((q) => q.id), config, notes: exam.notes });
    if (config.durationMinutes) {
      attempt.deadline = Date.now() + config.durationMinutes * 60000;
      await db.attempts.update(attempt.id, { deadline: attempt.deadline });
    }
    setRunning({ attempt, questions: exam.questions });
  };

  const usable = active.filter((q) => !q.needsReview).length;
  const examPool = active.filter((q) => q.pool === 'exam' && !q.needsReview).length;
  return (
    <>
      <PageHeader crumbs={[{ to: `/temes/${topic.id}`, label: topic.title }]} title="Examen global del tema" subtitle="Sense teoria, sense pistes i sense correccions fins al lliurament." />
      {inProgress && (
        <div className="mb-4">
          <Alert tone="warn" title="Tens un examen en curs">
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={resume}>Continua l’examen</Button>
              <span className="self-center text-xs">Si en comences un de nou, el que està en curs es descartarà.</span>
            </div>
          </Alert>
        </div>
      )}
      <Card className="max-w-2xl">
        <h2 className="font-semibold">Configuració</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="ex-n">
              Nombre de preguntes
            </label>
            <input id="ex-n" type="number" min={1} max={100} className="input" value={config.questionCount} onChange={(e) => setConfig({ ...config, questionCount: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
          <div>
            <label className="label" htmlFor="ex-d">
              Durada (minuts)
            </label>
            <input
              id="ex-d"
              type="number"
              min={0}
              className="input"
              placeholder="Sense límit"
              value={config.durationMinutes ?? ''}
              onChange={(e) => setConfig({ ...config, durationMinutes: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
            />
          </div>
          <div>
            <label className="label" htmlFor="ex-diff">
              Dificultat
            </label>
            <select id="ex-diff" className="input" value={config.difficulty} onChange={(e) => setConfig({ ...config, difficulty: e.target.value as ExamConfig['difficulty'] })}>
              <option value="mixed">Mixta (fàcil, mitjana i difícil)</option>
              <option value="easy">Fàcil</option>
              <option value="medium">Mitjana</option>
              <option value="hard">Difícil</option>
            </select>
          </div>
        </div>
        <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-400">
          <li>
            · {usable} preguntes fiables disponibles ({examPool} reservades per a examen) de {sections.length} apartats.
          </li>
          {usable < config.questionCount && <li className="text-amber-700 dark:text-amber-300">· No hi ha prou contingut fiable per a {config.questionCount} preguntes: l’examen en tindrà menys.</li>}
          <li>· Les preguntes es reparteixen entre tots els apartats i es prioritzen les que no has practicat ni vist en exàmens anteriors.</li>
          <li>· Pots navegar entre preguntes i deixar-ne en blanc. Les preguntes obertes es corregeixen de manera orientativa.</li>
        </ul>
        <div className="mt-5 flex gap-2">
          <Button onClick={start} disabled={!usable}>
            Comença l’examen
          </Button>
          <LinkButton to={`/temes/${topic.id}`} variant="secondary">
            Cancel·la
          </LinkButton>
        </div>
      </Card>
    </>
  );
}

function ExamRunner({ attempt, questions, topicTitle, onSubmitted }: { attempt: Attempt; questions: Question[]; topicTitle: string; onSubmitted: (id: string) => void }) {
  const [responses, setResponses] = useState<Record<string, AnswerValue>>(attempt.draft ?? {});
  const [i, setI] = useState(0);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();
  const submittedRef = useRef(false);

  useEffect(() => {
    setExamRunning(true);
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      setExamRunning(false);
      window.removeEventListener('beforeunload', warn);
    };
  }, []);

  // Desa les respostes provisionals per poder reprendre l'examen
  useEffect(() => {
    const t = setTimeout(() => db.attempts.update(attempt.id, { draft: responses }), 300);
    return () => clearTimeout(t);
  }, [responses, attempt.id]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const done = await submitExam(attempt.id, questions, responses);
    await db.attempts.update(attempt.id, { draft: undefined });
    onSubmitted(done.id);
  }, [attempt.id, questions, responses, onSubmitted]);

  useEffect(() => {
    if (!attempt.deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt.deadline]);
  const remaining = attempt.deadline ? Math.max(0, attempt.deadline - now) : null;
  useEffect(() => {
    if (remaining === 0) submit();
  }, [remaining, submit]);

  const answeredCount = useMemo(() => questions.filter((q) => isAnswered(responses[q.id])).length, [questions, responses]);
  const q = questions[i];
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  const askSubmit = async () => {
    const blank = questions.length - answeredCount;
    const ok = await confirm({
      title: 'Lliurar l’examen',
      message: blank ? `Tens ${blank} preguntes sense contestar, que comptaran com a incorrectes. Vols lliurar l’examen igualment?` : 'Has contestat totes les preguntes. Un cop lliurat, veuràs la nota i la correcció.',
      confirmLabel: 'Lliura',
    });
    if (ok) submit();
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-slate-800 dark:bg-slate-950/95">
        <div>
          <div className="text-xs text-slate-500">Examen sense teoria</div>
          <div className="font-semibold">{topicTitle}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 tabular-nums dark:text-slate-400">
            {answeredCount}/{questions.length} contestades
          </span>
          {remaining !== null && (
            <Badge tone={remaining < 60000 ? 'red' : 'slate'} title="Temps restant">
              ⏱ {mmss(remaining)}
            </Badge>
          )}
          <Button onClick={askSubmit} disabled={submitting}>
            Lliura l’examen
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>
              Pregunta {i + 1} de {questions.length}
            </span>
            <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
          </div>
          <p className="mb-4 text-lg leading-relaxed whitespace-pre-line text-slate-900 dark:text-white">{q.prompt}</p>
          <QuestionInput q={q} value={responses[q.id]} onChange={(v) => setResponses((r) => ({ ...r, [q.id]: v }))} />
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
              ‹ Anterior
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setMarked((m) => {
                  const n = new Set(m);
                  if (n.has(q.id)) n.delete(q.id);
                  else n.add(q.id);
                  return n;
                })
              }
            >
              {marked.has(q.id) ? 'Desmarca' : 'Marca per revisar'}
            </Button>
            {i + 1 < questions.length ? (
              <Button onClick={() => setI(i + 1)}>Següent ›</Button>
            ) : (
              <Button onClick={askSubmit} disabled={submitting}>
                Lliura l’examen
              </Button>
            )}
          </div>
        </Card>
        <Card className="p-4 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-2 text-sm font-semibold">Preguntes</div>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5" role="list" aria-label="Navegació de preguntes">
            {questions.map((x, k) => {
              const a = isAnswered(responses[x.id]);
              return (
                <button
                  key={x.id}
                  role="listitem"
                  onClick={() => setI(k)}
                  aria-label={`Pregunta ${k + 1}${a ? ', contestada' : ', pendent'}${marked.has(x.id) ? ', marcada' : ''}`}
                  aria-current={k === i}
                  className={cx(
                    'focus-ring relative h-9 rounded-md border text-sm tabular-nums',
                    a ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900',
                    k === i && 'ring-2 ring-brand-400 ring-offset-1 dark:ring-offset-slate-900',
                  )}
                >
                  {k + 1}
                  {marked.has(x.id) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-brand-600" /> Contestada
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded border border-slate-300" /> Pendent
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Marcada per revisar
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
