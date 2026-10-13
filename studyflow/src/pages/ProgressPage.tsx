import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllSummaries } from '../hooks/useStudyData';
import { MASTERY_LABEL } from '../lib/mastery';
import { formatDate } from '../lib/text';
import { Badge, Card, EmptyState, Loading, MASTERY_TONE, PageHeader, Stat } from '../components/ui';
import { GradeLine, PercentBars } from '../components/Charts';
import type { MasteryLevel } from '../types';

export default function ProgressPage() {
  const summaries = useAllSummaries();
  const [sel, setSel] = useState('');
  if (!summaries) return <Loading />;
  if (!summaries.length) return <EmptyState title="Encara no hi ha dades de progrés" />;
  const s = summaries.find((x) => x.subject.id === sel) ?? summaries[0];
  const exams = s.attempts.filter((a) => a.kind === 'exam' && a.finishedAt).sort((a, b) => a.finishedAt! - b.finishedAt!);
  const topicTitle = new Map(s.topics.map((t) => [t.topic.id, t.topic.title]));
  const levels: MasteryLevel[] = ['not_achieved', 'learning', 'achieved', 'mastered'];
  const failed = s.topics.reduce((n, t) => n + t.progress.failedQuestions, 0);

  return (
    <>
      <PageHeader
        title="Progrés"
        subtitle="Es diferencia entre haver llegit, haver practicat amb apunts i haver demostrat el coneixement sense apunts."
        actions={
          <select className="input w-64" aria-label="Assignatura" value={s.subject.id} onChange={(e) => setSel(e.target.value)}>
            {summaries.map((x) => (
              <option key={x.subject.id} value={x.subject.id}>
                {x.subject.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Temari llegit" value={`${Math.round(s.readPct * 100)}%`} />
        <Stat label="Temari practicat" value={`${Math.round(s.practicedPct * 100)}%`} />
        <Stat label="Exàmens superats" value={`${s.examsPassed}/${s.topics.length}`} hint="temes amb nota ≥ 5" />
        <Stat label="Preguntes fallades" value={failed} />
        <Stat label="Repàs pendent" value={s.dueReviews} />
        <Stat label="Última data d’estudi" value={<span className="text-lg">{formatDate(s.lastStudied)}</span>} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Evolució de les notes d’examen</h2>
          <GradeLine points={exams.map((a, i) => ({ at: a.finishedAt!, grade: a.grade ?? 0, label: `${topicTitle.get(a.topicId) ?? 'Tema'} (intent ${i + 1})` }))} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Domini dels conceptes</h2>
          {s.concepts.length === 0 ? (
            <p className="text-sm text-slate-500">Sense respostes encara.</p>
          ) : (
            <PercentBars rows={levels.map((l) => ({ label: MASTERY_LABEL[l], value: s.concepts.filter((c) => c.level === l).length / s.concepts.length, hint: `${s.concepts.filter((c) => c.level === l).length} conceptes` }))} />
          )}
          <p className="mt-3 text-xs text-slate-500">Basat en les respostes, no en la lectura. És una estimació orientativa.</p>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2 font-medium">Tema</th>
              <th className="px-4 py-2 font-medium">Llegit</th>
              <th className="px-4 py-2 font-medium">Practicat</th>
              <th className="px-4 py-2 font-medium">Examen</th>
              <th className="px-4 py-2 font-medium">Millor</th>
              <th className="px-4 py-2 font-medium">Última</th>
              <th className="px-4 py-2 font-medium">Intents</th>
              <th className="px-4 py-2 font-medium">Fallades</th>
              <th className="px-4 py-2 font-medium">Últim estudi</th>
            </tr>
          </thead>
          <tbody>
            {s.topics.map(({ topic, progress: p }) => (
              <tr key={topic.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-4 py-2">
                  <Link to={`/temes/${topic.id}`} className="font-medium hover:underline">
                    {topic.title}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums">{Math.round(p.readPct * 100)}%</td>
                <td className="px-4 py-2 tabular-nums">{Math.round(p.practicedPct * 100)}%</td>
                <td className="px-4 py-2">{p.examPassed ? <Badge tone="green">Superat</Badge> : p.examAttempts ? <Badge tone="amber">No superat</Badge> : <Badge>Pendent</Badge>}</td>
                <td className="px-4 py-2 tabular-nums">{p.bestGrade ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums">{p.lastGrade ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums">{p.examAttempts}</td>
                <td className="px-4 py-2 tabular-nums">{p.failedQuestions}</td>
                <td className="px-4 py-2">{formatDate(p.lastStudied)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {s.concepts.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-2 font-semibold">Conceptes</h2>
          <div className="space-y-3">
            {levels.map((l) => {
              const cs = s.concepts.filter((c) => c.level === l);
              if (!cs.length) return null;
              return (
                <div key={l}>
                  <div className="mb-1 text-sm font-medium">
                    {MASTERY_LABEL[l]} ({cs.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cs.map((c) => (
                      <Badge key={c.topicId + c.concept} tone={MASTERY_TONE[c.level]} title={`${c.correct}/${c.total} encerts`}>
                        {c.concept}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
