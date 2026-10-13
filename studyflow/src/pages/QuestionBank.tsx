import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { checkQuestions } from '../lib/quality';
import { uid } from '../lib/text';
import { Alert, Badge, Button, Card, EmptyState, Loading, Modal, PageHeader, useConfirm, useToast } from '../components/ui';
import { DIFF_LABEL, TYPE_LABEL } from '../components/QuestionView';
import type { Difficulty, Question, QuestionType, Section } from '../types';

function QuestionForm({ initial, sections, onClose }: { initial: Question; sections: Section[]; onClose: () => void }) {
  const [q, setQ] = useState<Question>(() => structuredClone(initial));
  const toast = useToast();
  const isNew = !initial.prompt;
  const set = (p: Partial<Question>) => setQ((x) => ({ ...x, ...p }));
  const save = async () => {
    const sec = sections.find((s) => s.id === q.sectionId);
    const cleaned: Question = { ...q, flags: q.flags.filter((f) => f !== 'Editada manualment'), needsReview: false, origin: q.origin === 'local' || q.origin === 'ai' ? q.origin : 'manual' };
    if (!isNew) cleaned.flags.push('Editada manualment');
    cleaned.source = { ...cleaned.source, sectionId: q.sectionId, docId: sec?.documentId, docName: sec?.docName };
    const { questions } = checkQuestions([cleaned], sec ? { [sec.id]: sec.sourceText } : {});
    const checked = questions[0] ?? cleaned;
    // Les edicions manuals no es descarten automàticament: només s'avisa
    if (checked.source.excerpt && !checked.source.verified) checked.flags = checked.flags.filter((f) => !f.startsWith('El fragment citat'));
    if (checked.source.excerpt && !checked.source.verified) {
      checked.flags.push('Fragment de font editat manualment: no coincideix literalment amb el document');
    }
    checked.needsReview = checked.flags.some((f) => f.startsWith('Opcions') || f.startsWith('Dues opcions') || f.startsWith('Resposta'));
    await db.questions.put(checked);
    toast('Pregunta desada', 'success');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nova pregunta' : 'Edita la pregunta'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel·la
          </Button>
          <Button onClick={save} disabled={!q.prompt.trim() || !q.explanation.trim()}>
            Desa
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Tipus</label>
          <select className="input" value={q.type} onChange={(e) => set({ type: e.target.value as QuestionType, answer: '' })} disabled={!isNew}>
            {(['mcq', 'truefalse', 'cloze', 'short', 'difference', 'case'] as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
            {q.type === 'matching' && <option value="matching">{TYPE_LABEL.matching}</option>}
          </select>
        </div>
        <div>
          <label className="label">Dificultat</label>
          <select className="input" value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFF_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ús</label>
          <select className="input" value={q.pool} onChange={(e) => set({ pool: e.target.value as Question['pool'] })}>
            <option value="practice">Pràctica</option>
            <option value="exam">Reservada per a examen</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="label">Apartat</label>
          <select className="input" value={q.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="label">Enunciat</label>
          <textarea className="input" rows={3} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} />
        </div>
        {q.type === 'mcq' && (
          <div className="space-y-2 sm:col-span-3">
            <span className="label">Opcions (marca la correcta)</span>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name="correct" aria-label={`Opció ${k + 1} correcta`} checked={q.answer === String(k)} onChange={() => set({ answer: String(k) })} />
                <input
                  className="input"
                  aria-label={`Opció ${k + 1}`}
                  value={q.options?.[k] ?? ''}
                  onChange={(e) => {
                    const o = [...(q.options ?? ['', '', '', ''])];
                    o[k] = e.target.value;
                    set({ options: o });
                  }}
                />
              </div>
            ))}
          </div>
        )}
        {q.type === 'truefalse' && (
          <div className="sm:col-span-3">
            <label className="label">Resposta correcta</label>
            <select className="input" value={q.answer} onChange={(e) => set({ answer: e.target.value })}>
              <option value="">—</option>
              <option value="true">Vertader</option>
              <option value="false">Fals</option>
            </select>
          </div>
        )}
        {q.type === 'matching' && (
          <div className="sm:col-span-3">
            <label className="label">Parelles (concepte | definició, una per línia)</label>
            <textarea
              className="input"
              rows={5}
              value={(q.pairs ?? []).map((p) => `${p.left} | ${p.right}`).join('\n')}
              onChange={(e) => {
                const pairs = e.target.value
                  .split('\n')
                  .map((l) => l.split('|').map((x) => x.trim()))
                  .filter((p) => p[0] && p[1])
                  .map(([left, right]) => ({ left, right }));
                set({ pairs, options: pairs.map((p) => p.left) });
              }}
            />
          </div>
        )}
        {['cloze', 'short', 'difference', 'case'].includes(q.type) && (
          <div className="sm:col-span-3">
            <label className="label">{q.type === 'cloze' ? 'Resposta exacta' : 'Resposta de referència'}</label>
            <textarea className="input" rows={q.type === 'cloze' ? 1 : 3} value={q.answer} onChange={(e) => set({ answer: e.target.value })} />
          </div>
        )}
        {['short', 'difference', 'case'].includes(q.type) && (
          <div className="sm:col-span-3">
            <label className="label">Criteris de correcció (un per línia: «criteri | paraula clau, paraula clau»)</label>
            <textarea
              className="input"
              rows={4}
              value={(q.criteria ?? []).map((c) => `${c.text} | ${c.keywords.join(', ')}`).join('\n')}
              onChange={(e) =>
                set({
                  criteria: e.target.value
                    .split('\n')
                    .map((l) => l.split('|'))
                    .filter((p) => p[0]?.trim())
                    .map(([text, kw]) => ({ text: text.trim(), keywords: (kw ?? text).split(',').map((x) => x.trim()).filter(Boolean) })),
                })
              }
            />
          </div>
        )}
        <div className="sm:col-span-3">
          <label className="label">Justificació / explicació</label>
          <textarea className="input" rows={3} value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Fragment de la font que la justifica</label>
          <textarea className="input" rows={2} value={q.source.excerpt} onChange={(e) => set({ source: { ...q.source, excerpt: e.target.value } })} />
        </div>
        <div>
          <label className="label">Pàgines (separades per comes)</label>
          <input
            className="input"
            value={q.source.pages.join(', ')}
            onChange={(e) => set({ source: { ...q.source, pages: e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => n > 0) } })}
          />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Concepte avaluat</label>
          <input className="input" value={q.concept} onChange={(e) => set({ concept: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

export default function QuestionBank() {
  const { topicId } = useParams();
  const data = useLiveQuery(async () => {
    const topic = await db.topics.get(topicId ?? '');
    if (!topic) return null;
    const [sections, questions] = await Promise.all([db.sections.where('topicId').equals(topic.id).sortBy('order'), db.questions.where('topicId').equals(topic.id).toArray()]);
    return { topic, sections, questions };
  }, [topicId]);
  const [filter, setFilter] = useState<'active' | 'review' | 'archived'>('active');
  const [editing, setEditing] = useState<Question | null>(null);
  const confirm = useConfirm();
  if (data === undefined) return <Loading />;
  if (data === null) return <EmptyState title="Tema no trobat" />;
  const { topic, sections, questions } = data;
  const list = questions.filter((q) => (filter === 'archived' ? q.archived : !q.archived && (filter === 'active' || q.needsReview)));
  const newQ = (): Question => ({
    id: uid('q'),
    subjectId: topic.subjectId,
    topicId: topic.id,
    sectionId: sections[0]?.id ?? '',
    type: 'mcq',
    prompt: '',
    options: ['', '', '', ''],
    answer: '0',
    explanation: '',
    source: { sectionId: sections[0]?.id ?? '', pages: [], excerpt: '', verified: false },
    difficulty: 'medium',
    concept: '',
    template: 'manual',
    pool: 'practice',
    origin: 'manual',
    needsReview: false,
    flags: [],
    generation: 1,
    createdAt: Date.now(),
  });

  return (
    <>
      <PageHeader
        crumbs={[{ to: `/temes/${topic.id}`, label: topic.title }]}
        title="Banc de preguntes"
        subtitle={`${questions.filter((q) => !q.archived).length} actives · ${questions.filter((q) => q.needsReview && !q.archived).length} per revisar · ${questions.filter((q) => q.archived).length} arxivades`}
        actions={<Button onClick={() => setEditing(newQ())} disabled={!sections.length}>+ Nova pregunta</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['active', 'Actives'],
            ['review', 'Per revisar'],
            ['archived', 'Arxivades (regeneracions anteriors)'],
          ] as const
        ).map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? 'primary' : 'secondary'} onClick={() => setFilter(k)}>
            {l}
          </Button>
        ))}
      </div>
      {filter === 'review' && (
        <div className="mb-4">
          <Alert tone="warn">Les preguntes per revisar no s’inclouen als exàmens fins que les corregeixis o les validis.</Alert>
        </div>
      )}
      {sections.map((s) => {
        const qs = list.filter((q) => q.sectionId === s.id);
        if (!qs.length) return null;
        return (
          <section key={s.id} className="mb-6">
            <h2 className="mb-2 font-semibold">{s.title}</h2>
            <div className="space-y-2">
              {qs.map((q) => (
                <Card key={q.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
                        <Badge>{DIFF_LABEL[q.difficulty]}</Badge>
                        <Badge tone={q.pool === 'exam' ? 'violet' : 'slate'}>{q.pool === 'exam' ? 'Examen' : 'Pràctica'}</Badge>
                        {q.origin === 'ai' && <Badge tone="amber">IA</Badge>}
                        {q.origin === 'manual' && <Badge tone="violet">Manual</Badge>}
                        {q.needsReview && <Badge tone="red">Per revisar</Badge>}
                        {!q.source.verified && q.origin !== 'manual' && <Badge tone="red">Font no verificada</Badge>}
                      </div>
                      <p className="text-sm whitespace-pre-line">{q.prompt}</p>
                      {q.flags.length > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{q.flags.join(' · ')}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(q)}>
                        Edita
                      </Button>
                      {q.needsReview && (
                        <Button size="sm" variant="secondary" onClick={() => db.questions.update(q.id, { needsReview: false, flags: [...q.flags, 'Validada manualment'] })}>
                          Valida
                        </Button>
                      )}
                      {q.archived ? (
                        <Button size="sm" variant="ghost" onClick={() => db.questions.update(q.id, { archived: false })}>
                          Recupera
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => db.questions.update(q.id, { archived: true })}>
                          Arxiva
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={async () => {
                          if (await confirm({ title: 'Eliminar la pregunta', message: 'L’historial d’intents en conserva una còpia.', confirmLabel: 'Elimina', danger: true })) {
                            await db.questions.delete(q.id);
                            await db.reviews.delete(q.id);
                          }
                        }}
                      >
                        Elimina
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
      {list.length === 0 && <EmptyState title="Cap pregunta en aquesta vista" />}
      {editing && <QuestionForm initial={editing} sections={sections} onClose={() => setEditing(null)} />}
    </>
  );
}
