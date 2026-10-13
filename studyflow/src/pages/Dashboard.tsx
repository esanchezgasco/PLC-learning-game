import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { useAllSummaries } from '../hooks/useStudyData';
import { Badge, Card, EmptyState, LinkButton, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';
import { formatDateTime } from '../lib/text';

export default function Dashboard() {
  const summaries = useAllSummaries();
  const settings = useSettings();
  const last = useLiveQuery(async () => {
    const ls = settings.lastStudied;
    if (!ls) return null;
    const [topic, section, subject] = await Promise.all([db.topics.get(ls.topicId), ls.sectionId ? db.sections.get(ls.sectionId) : undefined, db.subjects.get(ls.subjectId)]);
    return topic && subject ? { topic, section, subject, at: ls.at } : null;
  }, [settings.lastStudied?.at]);

  if (!summaries) return <Loading />;
  const due = summaries.reduce((s, x) => s + x.dueReviews, 0);
  const pendingExams = summaries.flatMap((s) => s.topics.filter((t) => t.progress.practicedPct > 0 && !t.progress.examPassed).map((t) => ({ s, t })));

  return (
    <>
      <PageHeader title="Inici" subtitle="Llegeix → practica amb ajuda → recorda sense ajuda → corregeix errors → repassa." actions={<LinkButton to="/assignatures">Gestiona les assignatures</LinkButton>} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Continua on ho vas deixar</h2>
          {last ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">{last.subject.name}</div>
                <div className="text-lg font-medium">{last.topic.title}</div>
                {last.section && <div className="text-sm text-slate-600 dark:text-slate-400">Apartat: {last.section.title}</div>}
                <div className="text-xs text-slate-500">Última activitat: {formatDateTime(last.at)}</div>
              </div>
              <LinkButton to={last.section ? `/temes/${last.topic.id}/apartats/${last.section.id}` : `/temes/${last.topic.id}`}>Reprèn l’estudi</LinkButton>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Encara no has estudiat cap tema. Obre una assignatura per començar (pots provar l’assignatura de demostració).</p>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900 dark:text-white">Repàs pendent</h2>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{due}</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">preguntes que toca repassar avui</p>
          <LinkButton to="/repas" variant={due ? 'primary' : 'secondary'} className="mt-3 w-full">
            {due ? 'Comença el repàs' : 'Veure el repàs'}
          </LinkButton>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Assignatures" value={summaries.length} />
        <Stat label="Temes" value={summaries.reduce((s, x) => s + x.topics.length, 0)} />
        <Stat label="Exàmens superats" value={summaries.reduce((s, x) => s + x.examsPassed, 0)} hint="Temes amb nota ≥ 5 sense apunts" />
        <Stat label="Exàmens pendents" value={pendingExams.length} hint="Temes practicats sense examen superat" />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-white">Les teves assignatures</h2>
      {summaries.length === 0 ? (
        <EmptyState title="Encara no tens cap assignatura" action={<LinkButton to="/assignatures">Crea una assignatura</LinkButton>}>
          Crea una assignatura i puja-hi els PDF de la matèria.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s) => (
            <Link key={s.subject.id} to={`/assignatures/${s.subject.id}`} className="focus-ring block rounded-xl">
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.subject.color }} aria-hidden />
                    <h3 className="font-semibold text-slate-900 dark:text-white">{s.subject.name}</h3>
                  </div>
                  {s.subject.isDemo && <Badge tone="violet">Demo</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {s.topics.length} temes · {s.examsPassed} exàmens superats{s.dueReviews ? ` · ${s.dueReviews} per repassar` : ''}
                </p>
                <div className="mt-4 space-y-2">
                  <ProgressBar value={s.readPct} label="Teoria llegida" />
                  <ProgressBar value={s.practicedPct} label="Pràctica completada" tone="amber" />
                  <ProgressBar value={s.topics.length ? s.examsPassed / s.topics.length : 0} label="Examen superat (sense apunts)" tone="green" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {pendingExams.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-white">Temes pendents de demostrar sense apunts</h2>
          <Card className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {pendingExams.slice(0, 6).map(({ s, t }) => (
              <div key={t.topic.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <div className="font-medium">{t.topic.title}</div>
                  <div className="text-xs text-slate-500">
                    {s.subject.name} · practicat {Math.round(t.progress.practicedPct * 100)}%{t.progress.lastGrade !== undefined ? ` · última nota ${t.progress.lastGrade}` : ''}
                  </div>
                </div>
                <LinkButton to={`/temes/${t.topic.id}/examen`} variant="secondary">
                  Fes l’examen
                </LinkButton>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
