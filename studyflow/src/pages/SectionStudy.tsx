import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Alert, Badge, Button, Card, EmptyState, LinkButton, Loading, PageHeader, Spinner, cx, useConfirm, useToast } from '../components/ui';
import { PdfPageModal, TheoryView } from '../components/TheoryView';
import { TheoryEditor } from '../components/TheoryEditor';
import { DIFF_LABEL, Feedback, QuestionInput, TYPE_LABEL } from '../components/QuestionView';
import { answerQuestion, finishPractice, markRead, regenerateSectionTheory, startAttempt } from '../services/study';
import { aiGrade, aiQuestions, aiTheory } from '../services/ai';
import { useAiGate } from '../hooks/useAi';
import { isAnswered } from '../lib/grading';
import { seededShuffle } from '../lib/text';
import type { AnswerValue, AttemptAnswer, Question, Section } from '../types';

const PRACTICE_SIZE = 12;

export default function SectionStudy() {
  const { topicId, sectionId } = useParams();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'practica' ? 'practice' : 'theory';
  const data = useLiveQuery(async () => {
    const section = await db.sections.get(sectionId ?? '');
    if (!section) return null;
    const [topic, siblings, progress, subject] = await Promise.all([
      db.topics.get(section.topicId),
      db.sections.where('topicId').equals(section.topicId).sortBy('order'),
      db.progress.get(section.id),
      db.subjects.get(section.subjectId),
    ]);
    return { section, topic, siblings, progress, subject };
  }, [sectionId]);
  const [editing, setEditing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const ai = useAiGate();

  if (data === undefined) return <Loading />;
  if (data === null) return <EmptyState title="Apartat no trobat" action={<LinkButton to={`/temes/${topicId}`}>Torna al tema</LinkButton>} />;
  const { section, topic, siblings, progress, subject } = data;
  const idx = siblings.findIndex((s) => s.id === section.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  const genAiTheory = async () => {
    if (!(await ai.ensureConsent('generar teoria estructurada'))) return;
    setAiBusy(true);
    try {
      const theory = await aiTheory(section, subject?.name ?? '');
      await db.sections.update(section.id, { theory, theoryEdited: false, updatedAt: Date.now() });
      toast('Teoria generada amb IA. Revisa els blocs marcats com a complementaris o no verificables.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error de la IA', 'error');
    } finally {
      setAiBusy(false);
    }
  };
  const genAiQuestions = async () => {
    if (!(await ai.ensureConsent('generar preguntes'))) return;
    setAiBusy(true);
    try {
      const qs = [...(await aiQuestions(section, 8, 'practice')), ...(await aiQuestions(section, 8, 'exam'))];
      await db.questions.bulkAdd(qs);
      toast(`S’han afegit ${qs.length} preguntes generades per IA (${qs.filter((q) => q.needsReview).length} per revisar).`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error de la IA', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { to: `/assignatures/${section.subjectId}`, label: subject?.name ?? 'Assignatura' },
          { to: `/temes/${section.topicId}`, label: topic?.title ?? 'Tema' },
        ]}
        title={section.title}
        subtitle={`Apartat ${idx + 1} de ${siblings.length}${progress?.readAt ? ' · llegit' : ''}${progress?.practicedAt ? ` · pràctica ${Math.round((progress.practiceLast ?? 0) * 100)}%` : ''}`}
        actions={
          <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700" role="tablist">
            {(['theory', 'practice'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={cx('focus-ring rounded-md px-4 py-1.5 text-sm font-medium', mode === m ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-300')}
                onClick={() => setParams(m === 'practice' ? { mode: 'practica' } : {})}
              >
                {m === 'theory' ? 'Teoria' : 'Pràctica'}
              </button>
            ))}
          </div>
        }
      />

      {mode === 'theory' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Card className="sm:p-8">
            {editing ? (
              <TheoryEditor
                section={section}
                onCancel={() => setEditing(false)}
                onSave={async (theory) => {
                  await db.sections.update(section.id, { theory, theoryEdited: true, updatedAt: Date.now() });
                  setEditing(false);
                  toast('Teoria desada', 'success');
                }}
              />
            ) : (
              <TheoryView section={section} />
            )}
          </Card>
          <aside className="space-y-3 lg:sticky lg:top-8 lg:self-start">
            <Card className="space-y-2 p-4">
              {progress?.readAt ? (
                <Badge tone="blue">Marcat com a llegit</Badge>
              ) : (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={async () => {
                    await markRead(section);
                    toast('Apartat marcat com a llegit');
                  }}
                >
                  Marca com a llegit
                </Button>
              )}
              <Button
                className="w-full"
                onClick={async () => {
                  if (!progress?.readAt) await markRead(section);
                  setParams({ mode: 'practica' });
                }}
              >
                Comença la pràctica
              </Button>
              <div className="flex gap-2 pt-1">
                {prev && (
                  <LinkButton to={`/temes/${topicId}/apartats/${prev.id}`} variant="ghost" className="flex-1 px-2">
                    ‹ Anterior
                  </LinkButton>
                )}
                {next && (
                  <LinkButton to={`/temes/${topicId}/apartats/${next.id}`} variant="ghost" className="flex-1 px-2">
                    Següent ›
                  </LinkButton>
                )}
              </div>
            </Card>
            <Card className="space-y-2 p-4 text-sm">
              <div className="font-semibold">Material</div>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => setEditing(true)} disabled={editing}>
                Edita la teoria
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                disabled={section.isDemo}
                onClick={async () => {
                  const ok = await confirm({ title: 'Regenerar la teoria', message: 'Es tornarà a crear la teoria extractiva a partir del text del PDF. Es perdran les edicions manuals i la teoria generada per IA d’aquest apartat.', confirmLabel: 'Regenera' });
                  if (ok) await regenerateSectionTheory(section.id);
                }}
              >
                Regenera (sense IA)
              </Button>
              {ai.available ? (
                <>
                  <Button size="sm" variant="secondary" className="w-full" disabled={aiBusy} onClick={genAiTheory}>
                    Genera teoria amb IA
                  </Button>
                  <Button size="sm" variant="secondary" className="w-full" disabled={aiBusy} onClick={genAiQuestions}>
                    Afegeix preguntes amb IA
                  </Button>
                  {aiBusy && <Spinner label="Esperant la IA…" />}
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  IA no disponible: estàs fent servir el mode local. <Link to="/configuracio" className="underline">Configuració</Link>
                </p>
              )}
            </Card>
          </aside>
        </div>
      ) : (
        <Practice key={section.id} section={section} />
      )}
    </>
  );
}

// ---------------- Pràctica amb teoria disponible ----------------

function Practice({ section }: { section: Section }) {
  const questions = useLiveQuery(() => db.questions.where('sectionId').equals(section.id).filter((q) => !q.archived && q.pool === 'practice').toArray(), [section.id]);
  const [seed, setSeed] = useState(() => Date.now());
  const [onlyIds, setOnlyIds] = useState<string[] | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [value, setValue] = useState<AnswerValue | undefined>();
  const [results, setResults] = useState<Record<string, AttemptAnswer>>({});
  const [showTheory, setShowTheory] = useState(false);
  const [checking, setChecking] = useState(false);
  const [page, setPage] = useState<number | null>(null);
  const ai = useAiGate();
  const nav = useNavigate();

  const list: Question[] = useMemo(() => {
    if (!questions) return [];
    const base = onlyIds ? questions.filter((q) => onlyIds.includes(q.id)) : seededShuffle(questions, seed).slice(0, PRACTICE_SIZE);
    // primer les preguntes fàcils i mitjanes, després les difícils
    const rank = { easy: 0, medium: 1, hard: 2 };
    return base.slice().sort((a, b) => rank[a.difficulty] - rank[b.difficulty]);
  }, [questions, seed, onlyIds]);

  useEffect(() => {
    setValue(undefined);
    // en arribar al final (també saltant preguntes) es tanca l'intent i es registra la pràctica
    if (list.length && i >= list.length && attemptId) finishPractice(attemptId);
  }, [i, list.length, attemptId]);

  if (!questions) return <Loading />;
  if (!questions.length)
    return (
      <EmptyState title="Aquest apartat no té preguntes de pràctica">
        El text no conté prou definicions, enumeracions o dades concretes per generar preguntes fiables automàticament. Pots afegir-ne manualment al banc de preguntes{ai.available ? ' o generar-ne amb IA' : ''}.
      </EmptyState>
    );

  const q = list[i];
  const done = i >= list.length;
  const result = q ? results[q.id] : undefined;
  const answered = Object.values(results);
  const correct = answered.filter((r) => r.grade.correct).length;

  const check = async () => {
    if (!q || !value) return;
    setChecking(true);
    try {
      let id = attemptId;
      if (!id) {
        id = (await startAttempt({ subjectId: section.subjectId, topicId: section.topicId, sectionId: section.id, kind: 'practice', questionIds: list.map((x) => x.id) })).id;
        setAttemptId(id);
      }
      let override: AttemptAnswer['grade'] | undefined;
      if (['short', 'difference', 'case'].includes(q.type) && ai.available && value.type === 'text' && value.value.trim()) {
        try {
          override = await aiGrade(q, value.value);
        } catch {
          override = undefined; // es fa servir la correcció local per criteris
        }
      }
      const ans = await answerQuestion(id, q, value, override);
      setResults((r) => ({ ...r, [q.id]: ans }));
    } finally {
      setChecking(false);
    }
  };

  const restart = (ids: string[] | null) => {
    if (attemptId) finishPractice(attemptId);
    setOnlyIds(ids);
    setSeed(Date.now());
    setResults({});
    setAttemptId(null);
    setI(0);
  };

  const finish = () => setI(list.length);

  const theoryPanel = (
    <Card className={cx('overflow-auto lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)]', showTheory ? 'block' : 'hidden')}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Teoria de l’apartat</h2>
        <button className="text-sm text-brand-600 underline lg:hidden" onClick={() => setShowTheory(false)}>
          Amaga
        </button>
      </div>
      <TheoryView section={section} compact />
    </Card>
  );

  if (done) {
    const wrong = answered.filter((r) => !r.grade.correct).map((r) => r.questionId);
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <h2 className="text-xl font-semibold">Pràctica completada</h2>
        <p className="mt-2 text-4xl font-semibold tabular-nums">
          {correct}/{answered.length}
        </p>
        <p className="text-slate-600 dark:text-slate-400">respostes correctes amb la teoria disponible</p>
        <p className="mt-3 text-sm text-slate-500">Recorda: la pràctica amb apunts no demostra domini. Quan hagis practicat tots els apartats, fes l’examen del tema sense teoria.</p>
        {wrong.length > 0 && (
          <div className="mt-4 text-left">
            <h3 className="font-semibold">Preguntes a revisar</h3>
            <ul className="mt-1 ml-5 list-disc text-sm">
              {wrong.map((id) => (
                <li key={id}>{results[id].snapshot.prompt.slice(0, 160)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && <Button onClick={() => restart(wrong)}>Repeteix les incorrectes ({wrong.length})</Button>}
          <Button variant="secondary" onClick={() => restart(null)}>
            Nova ronda de pràctica
          </Button>
          <Button variant="secondary" onClick={() => nav(`/temes/${section.topicId}`)}>
            Torna al tema
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span>
            Pregunta {i + 1} de {list.length} · {correct} correctes
          </span>
          <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setShowTheory((s) => !s)}>
            {showTheory ? 'Amaga la teoria' : 'Consulta la teoria'}
          </Button>
        </div>
        <div className="mb-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
            <Badge>{DIFF_LABEL[q.difficulty]}</Badge>
            {q.origin === 'ai' && <Badge tone="amber">IA</Badge>}
            {q.needsReview && (
              <Badge tone="red" title={q.flags.join(' · ')}>
                Per revisar
              </Badge>
            )}
          </div>
          <p className="mb-4 text-lg leading-relaxed whitespace-pre-line text-slate-900 dark:text-white">{q.prompt}</p>
          <QuestionInput q={q} value={result ? result.response : value} onChange={setValue} disabled={!!result} />
          <div className="mt-4 flex flex-wrap gap-2">
            {!result ? (
              <>
                <Button onClick={check} disabled={!isAnswered(value) || checking}>
                  {checking ? 'Corregint…' : 'Comprova'}
                </Button>
                <Button variant="ghost" onClick={() => setI(i + 1)}>
                  Salta
                </Button>
              </>
            ) : i + 1 < list.length ? (
              <Button onClick={() => setI(i + 1)}>Següent pregunta</Button>
            ) : (
              <Button onClick={finish}>Mostra el resultat</Button>
            )}
          </div>
          {result && (
            <div className="mt-5">
              <Feedback q={result.snapshot} grade={result.grade} response={result.response} onOpenPage={section.documentId ? setPage : undefined} docName={section.docName} />
            </div>
          )}
        </Card>
        {q.needsReview && (
          <div className="mt-3">
            <Alert tone="warn">Aquesta pregunta està marcada per revisar: {q.flags.join(' · ')}</Alert>
          </div>
        )}
      </div>
      {theoryPanel}
      <PdfPageModal docId={section.documentId} docName={section.docName} page={page} onClose={() => setPage(null)} />
    </div>
  );
}
