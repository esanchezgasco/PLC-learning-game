import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useAllSummaries } from '../hooks/useStudyData';
import { Badge, Button, Card, EmptyState, Loading, Modal, PageHeader, ProgressBar, useConfirm, useToast } from '../components/ui';
import { deleteSubject } from '../services/study';
import { uid } from '../lib/text';
import type { Subject } from '../types';

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#475569'];

export function SubjectForm({ initial, open, onClose, onSaved }: { initial?: Subject; open: boolean; onClose: () => void; onSaved?: (id: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const toast = useToast();
  const save = async () => {
    if (!name.trim()) return;
    const now = Date.now();
    if (initial) {
      await db.subjects.update(initial.id, { name: name.trim(), description: description.trim(), color, updatedAt: now });
      toast('Assignatura actualitzada', 'success');
      onSaved?.(initial.id);
    } else {
      const id = uid('sub');
      await db.subjects.add({ id, name: name.trim(), description: description.trim(), color, createdAt: now, updatedAt: now });
      toast('Assignatura creada', 'success');
      onSaved?.(id);
    }
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edita l’assignatura' : 'Nova assignatura'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel·la
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            Desa
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label className="label" htmlFor="sub-name">
            Nom
          </label>
          <input id="sub-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ex. Dret Administratiu I" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="sub-desc">
            Descripció (opcional)
          </label>
          <textarea id="sub-desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${c === color ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function Subjects() {
  const summaries = useAllSummaries();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const nav = useNavigate();
  if (!summaries) return <Loading />;
  return (
    <>
      <PageHeader title="Assignatures" subtitle="Organitza els teus PDF per assignatura." actions={<Button onClick={() => setCreating(true)}>+ Nova assignatura</Button>} />
      {summaries.length === 0 ? (
        <EmptyState title="Cap assignatura" action={<Button onClick={() => setCreating(true)}>Crea la primera assignatura</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s) => (
            <Card key={s.subject.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/assignatures/${s.subject.id}`} className="flex items-center gap-2 font-semibold text-slate-900 hover:text-brand-600 dark:text-white">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.subject.color }} aria-hidden />
                  {s.subject.name}
                </Link>
                {s.subject.isDemo && <Badge tone="violet">Demo</Badge>}
              </div>
              {s.subject.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.subject.description}</p>}
              <div className="mt-3 space-y-2">
                <ProgressBar value={s.readPct} label="Teoria llegida" />
                <ProgressBar value={s.practicedPct} label="Practicat" tone="amber" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 pt-2">
                <Button size="sm" onClick={() => nav(`/assignatures/${s.subject.id}`)}>
                  Obre
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(s.subject)}>
                  Edita
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 dark:text-red-400"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Eliminar l’assignatura',
                      message: (
                        <>
                          S’eliminaran l’assignatura <strong>{s.subject.name}</strong>, els seus PDF, temes, preguntes, intents i dades de repàs. Aquesta acció no es pot desfer.
                        </>
                      ),
                      confirmLabel: 'Elimina',
                      danger: true,
                      typeToConfirm: s.subject.isDemo ? undefined : 'ELIMINAR',
                    });
                    if (ok) {
                      await deleteSubject(s.subject.id);
                      toast('Assignatura eliminada', 'success');
                    }
                  }}
                >
                  Elimina
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {creating && <SubjectForm open onClose={() => setCreating(false)} onSaved={(id) => nav(`/assignatures/${id}`)} />}
      {editing && <SubjectForm open initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
