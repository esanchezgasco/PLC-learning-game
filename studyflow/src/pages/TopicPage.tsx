import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { topicProgress, conceptStats, MASTERY_LABEL } from '../lib/mastery';
import { Alert, Badge, Button, Card, EmptyState, LinkButton, Loading, MASTERY_TONE, PageHeader, Stat, useConfirm, useToast } from '../components/ui';
import { GradeLine } from '../components/Charts';
import { deleteTopic, regenerateTopicQuestions } from '../services/study';
import { formatDate, formatDateTime } from '../lib/text';

export default function TopicPage() {
  const { topicId } = useParams();
  const data = useLiveQuery(async () => {
    const topic = await db.topics.get(topicId ?? '');
    if (!topic) return null;
    const [subject, sections, progress, attempts, questions] = await Promise.all([
      db.subjects.get(topic.subjectId),
      db.sections.where('topicId').equals(topic.id).sortBy('order'),
      db.progress.where('topicId').equals(topic.id).toArray(),
      db.attempts.where('topicId').equals(topic.id).toArray(),
      db.questions.where('topicId').equals(topic.id).filter((q) => !q.archived).toArray(),
    ]);
    return { topic, subject, sections, progress, attempts, questions };
  }, [topicId]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const nav = useNavigate();

  if (data === undefined) return <Loading />;
  if (data === null) return <EmptyState title="Tema no trobat" action={<LinkButton to="/assignatures">Assignatures</LinkButton>} />;
  const { topic, subject, sections, progress, attempts, questions } = data;
  const tp = topicProgress(sections, progress, attempts);
  const concepts = conceptStats(attempts).sort((a, b) => ['not_achieved', 'learning', 'not_started', 'achieved', 'mastered'].indexOf(a.level) - ['not_achieved', 'learning', 'not_started', 'achieved', 'mastered'].indexOf(b.level));
  const exams = attempts.filter((a) => a.kind === 'exam' && a.finishedAt).sort((a, b) => b.startedAt - a.startedAt);
  const allPracticed = tp.sectionsPracticed === tp.sectionsTotal && tp.sectionsTotal > 0;
  const flagged = questions.filter((q) => q.needsReview).length;

  return (
    <>
      <PageHeader
        crumbs={[
          { to: '/assignatures', label: 'Assignatures' },
          { to: `/assignatures/${topic.subjectId}`, label: subject?.name ?? 'Assignatura' },
        ]}
        title={
          renaming !== null ? (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (renaming.trim()) await db.topics.update(topic.id, { title: renaming.trim() });
                setRenaming(null);
              }}
            >
              <input className="input text-lg" value={renaming} onChange={(e) => setRenaming(e.target.value)} autoFocus aria-label="Títol del tema" />
              <Button type="submit">Desa</Button>
            </form>
          ) : (
            topic.title
          )
        }
        subtitle={`${sections.length} apartats · ${questions.length} preguntes disponibles${topic.pageStart ? ` · pàg. ${topic.pageStart}–${topic.pageEnd}` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRenaming(topic.title)}>
              Canvia el nom
            </Button>
            <LinkButton to={`/temes/${topic.id}/preguntes`} variant="secondary">
              Banc de preguntes
            </LinkButton>
          </>
        }
      />
      {topic.isDemo && (
        <div className="mb-4">
          <Alert tone="info" title="Tema de demostració">
            Contingut fictici creat per provar l’aplicació. No prové de cap PDF.
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Teoria llegida" value={`${Math.round(tp.readPct * 100)}%`} hint={`${tp.sectionsRead}/${tp.sectionsTotal} apartats`} />
        <Stat label="Pràctica amb apunts" value={`${Math.round(tp.practicedPct * 100)}%`} hint={`${tp.sectionsPracticed}/${tp.sectionsTotal} apartats`} />
        <Stat label="Examen sense apunts" value={tp.bestGrade !== undefined ? tp.bestGrade : '—'} hint={tp.examAttempts ? `millor nota · ${tp.examAttempts} intents` : 'cap intent'} />
        <Stat label="Preguntes fallades" value={tp.failedQuestions} hint="última resposta incorrecta" />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-white">1. Estudia i practica per apartats</h2>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Llegeix la teoria de cada apartat i fes-ne el qüestionari de pràctica. Durant la pràctica pots consultar la teoria en tot moment.</p>
      <div className="space-y-3">
        {sections.map((s, i) => {
          const p = progress.find((x) => x.id === s.id);
          const nq = questions.filter((q) => q.sectionId === s.id && q.pool === 'practice').length;
          return (
            <Card key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500 tabular-nums">{i + 1}.</span>
                  <Link to={`/temes/${topic.id}/apartats/${s.id}`} className="font-medium text-slate-900 hover:text-brand-600 dark:text-white">
                    {s.title}
                  </Link>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {p?.readAt ? <Badge tone="blue">Llegit</Badge> : <Badge>No llegit</Badge>}
                  {p?.practicedAt ? (
                    <Badge tone={(p.practiceLast ?? 0) >= 0.7 ? 'green' : 'amber'}>Pràctica: {Math.round((p.practiceLast ?? 0) * 100)}% (millor {Math.round((p.practiceBest ?? 0) * 100)}%)</Badge>
                  ) : (
                    <Badge>Sense practicar</Badge>
                  )}
                  <span className="text-slate-500">{nq} preguntes de pràctica</span>
                  {s.pageStart ? <span className="text-slate-500">· pàg. {s.pageStart}–{s.pageEnd}</span> : null}
                </div>
              </div>
              <div className="flex gap-2">
                <LinkButton to={`/temes/${topic.id}/apartats/${s.id}`} variant="secondary">
                  Teoria
                </LinkButton>
                <LinkButton to={`/temes/${topic.id}/apartats/${s.id}?mode=practica`}>Practica</LinkButton>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-white">2. Examen global sense teoria</h2>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-prose text-sm text-slate-600 dark:text-slate-400">
            Barreja preguntes de tots els apartats, prioritza preguntes que no has practicat i no mostra cap correcció fins que el lliuris. La teoria queda amagada durant l’examen.
            {!allPracticed && (
              <div className="mt-2">
                <Badge tone="amber">Recomanació: completa abans la pràctica de tots els apartats ({tp.sectionsPracticed}/{tp.sectionsTotal}).</Badge>
              </div>
            )}
            {flagged > 0 && <div className="mt-2 text-xs">{flagged} preguntes marcades per revisar no s’inclouran a l’examen.</div>}
          </div>
          <LinkButton to={`/temes/${topic.id}/examen`} variant={allPracticed ? 'primary' : 'secondary'}>
            {exams.length ? 'Repeteix l’examen amb preguntes noves' : 'Comença l’examen'}
          </LinkButton>
        </div>
        {exams.length > 0 && (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Evolució de la nota</h3>
              <GradeLine points={exams.slice().reverse().map((a, i) => ({ at: a.finishedAt!, grade: a.grade ?? 0, label: `Intent ${i + 1}` }))} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Historial d’intents</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 font-medium">Data</th>
                    <th className="py-1 font-medium">Preguntes</th>
                    <th className="py-1 font-medium">Nota</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {exams.map((a) => (
                    <tr key={a.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-1.5">{formatDateTime(a.finishedAt)}</td>
                      <td className="py-1.5 tabular-nums">{a.answers.length}</td>
                      <td className="py-1.5 font-semibold tabular-nums">{a.grade}</td>
                      <td className="py-1.5 text-right">
                        <Link className="text-brand-600 underline" to={`/intents/${a.id}`}>
                          Revisa
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-white">3. Domini dels conceptes</h2>
      {concepts.length === 0 ? (
        <EmptyState title="Encara no hi ha dades de domini">El nivell de domini es calcula a partir de les teves respostes (no només de la lectura). Fes la pràctica o l’examen per veure’l.</EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {concepts.map((c) => (
              <li key={c.concept} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="font-medium">{c.concept}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  pràctica {c.practiceCorrect}/{c.practiceTotal} · sense apunts {c.closedCorrect}/{c.closedTotal}
                  <Badge tone={MASTERY_TONE[c.level]}>{MASTERY_LABEL[c.level]}</Badge>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-200 px-5 py-2 text-xs text-slate-500 dark:border-slate-800">
            Estimació orientativa: «Assolit» requereix encerts sense apunts (examen o repàs); «Ben dominat», encerts sense apunts repetits en dies diferents.
          </p>
        </Card>
      )}

      <div className="mt-10 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Button
          variant="secondary"
          onClick={async () => {
            const ok = await confirm({ title: 'Regenerar el qüestionari', message: 'Es crearà un banc de preguntes nou per a aquest tema. Les preguntes actuals s’arxivaran (no es perd l’historial d’intents). Les preguntes editades manualment es conserven.', confirmLabel: 'Regenera' });
            if (ok) toast(`S’han generat ${await regenerateTopicQuestions(topic.id)} preguntes noves.`, 'success');
          }}
        >
          Regenera les preguntes
        </Button>
        <Button
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          onClick={async () => {
            const ok = await confirm({ title: 'Eliminar el tema', message: 'S’eliminarà el tema, els seus apartats, preguntes i intents.', confirmLabel: 'Elimina', danger: true });
            if (ok) {
              await deleteTopic(topic.id);
              nav(`/assignatures/${topic.subjectId}`);
            }
          }}
        >
          Elimina el tema
        </Button>
        <span className="ml-auto self-center text-xs text-slate-500">Creat el {formatDate(topic.createdAt)}</span>
      </div>
    </>
  );
}
