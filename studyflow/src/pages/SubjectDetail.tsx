import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useSubjectSummary } from '../hooks/useStudyData';
import { Alert, Badge, Button, Card, EmptyState, LinkButton, Loading, PageHeader, ProgressBar, Spinner, cx, useConfirm, useToast } from '../components/ui';
import { addDocument, ocrDocument, processDocument } from '../services/pdf';
import { deleteDocument, deleteSubject } from '../services/study';
import { formatBytes, formatDate } from '../lib/text';
import { SubjectForm } from './Subjects';
import type { DocStatus, StudyDocument } from '../types';

const STATUS: Record<DocStatus, { label: string; tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' }> = {
  pending: { label: 'Pendent', tone: 'slate' },
  processing: { label: 'Processant…', tone: 'blue' },
  processed: { label: 'Text extret', tone: 'green' },
  needs_ocr: { label: 'Sense text (escanejat)', tone: 'amber' },
  error: { label: 'Error', tone: 'red' },
};

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const summary = useSubjectSummary(subjectId);
  const docs = useLiveQuery(() => db.documents.where('subjectId').equals(subjectId ?? '').sortBy('createdAt'), [subjectId]);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();

  if (summary === undefined || docs === undefined) return <Loading />;
  if (summary === null)
    return (
      <EmptyState title="Assignatura no trobada" action={<LinkButton to="/assignatures">Torna a les assignatures</LinkButton>}>
        Potser s’ha eliminat.
      </EmptyState>
    );
  const { subject, topics } = summary;

  const run = async (doc: StudyDocument, fn: typeof processDocument) => {
    try {
      const d = await fn(doc.id, (msg) => setProgress((p) => ({ ...p, [doc.id]: msg })));
      if (d.status === 'processed') toast(`«${d.name}»: text extret (${d.pageCount} pàgines). Revisa l’estructura detectada.`, 'success');
      else if (d.status === 'needs_ocr') toast(`«${d.name}» no té text seleccionable: sembla un PDF escanejat.`, 'error');
    } catch (e) {
      toast(`«${doc.name}»: ${e instanceof Error ? e.message : 'error'}`, 'error');
    } finally {
      setProgress((p) => {
        const { [doc.id]: _, ...rest } = p;
        void _;
        return rest;
      });
    }
  };

  const onFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const f of list) {
      try {
        const d = await addDocument(subject.id, f);
        await run(d, processDocument);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'No s’ha pogut afegir el fitxer', 'error');
      }
    }
  };

  const ocr = async (d: StudyDocument) => {
    const ok = await confirm({
      title: 'Aplicar OCR al document',
      message: (
        <div className="space-y-2">
          <p>El reconeixement òptic de caràcters (OCR) s’executa al teu navegador amb Tesseract.js. <strong>El document no s’envia a cap servidor.</strong></p>
          <p>La primera vegada es descarregaran els models d’idioma (català, castellà i anglès, uns 10–20 MB) des d’un CDN públic. Pot trigar uns minuts en documents llargs.</p>
          <p>El text obtingut per OCR pot contenir errors: revisa’l abans d’estudiar.</p>
        </div>
      ),
      confirmLabel: 'Aplica OCR',
    });
    if (ok) run(d, (id, cb) => ocrDocument(id, 'cat+spa+eng', cb));
  };

  return (
    <>
      <PageHeader
        crumbs={[{ to: '/assignatures', label: 'Assignatures' }]}
        title={
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: subject.color }} aria-hidden />
            {subject.name}
            {subject.isDemo && <Badge tone="violet">Demostració · contingut fictici</Badge>}
          </span>
        }
        subtitle={subject.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edita
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 dark:text-red-400"
              onClick={async () => {
                const ok = await confirm({ title: 'Eliminar l’assignatura', message: `S’eliminaran «${subject.name}» i totes les seves dades (PDF, temes, intents, repàs).`, confirmLabel: 'Elimina', danger: true, typeToConfirm: subject.isDemo ? undefined : 'ELIMINAR' });
                if (ok) {
                  await deleteSubject(subject.id);
                  nav('/assignatures');
                }
              }}
            >
              Elimina
            </Button>
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Documents PDF</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cx('rounded-xl border-2 border-dashed p-6 text-center transition-colors', dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 dark:border-slate-700')}
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">Arrossega aquí un o diversos PDF, o</p>
          <Button className="mt-2" onClick={() => fileRef.current?.click()}>
            Puja PDF des de l’ordinador
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            data-testid="pdf-input"
            onChange={(e) => {
              if (e.target.files) onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="mt-2 text-xs text-slate-500">Els PDF es processen al teu navegador i es desen localment. No s’envien a cap servidor.</p>
        </div>

        {docs.length > 0 && (
          <div className="mt-4 space-y-3">
            {docs.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900 dark:text-white" title={d.name}>
                      {d.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatBytes(d.size)}</span>
                      {d.pageCount !== undefined && <span>· {d.pageCount} pàgines</span>}
                      <span>· pujat el {formatDate(d.createdAt)}</span>
                      <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                      {d.textSource === 'ocr' && <Badge tone="amber">OCR</Badge>}
                      {d.structureApplied && <Badge tone="green">Temes creats</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.status === 'processed' && (
                      <LinkButton to={`/documents/${d.id}/estructura`} variant={d.structureApplied ? 'secondary' : 'primary'}>
                        {d.structureApplied ? 'Revisa l’estructura' : 'Revisa l’estructura i crea els temes'}
                      </LinkButton>
                    )}
                    {d.status === 'needs_ocr' && <Button onClick={() => ocr(d)}>Aplica OCR</Button>}
                    <Button variant="secondary" size="sm" disabled={!!progress[d.id]} onClick={() => run(d, processDocument)}>
                      Torna a processar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 dark:text-red-400"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Eliminar el document',
                          message: d.structureApplied ? 'S’eliminarà el PDF i també els temes creats a partir d’aquest document (incloent-hi els intents).' : 'S’eliminarà el PDF i el text extret.',
                          confirmLabel: 'Elimina',
                          danger: true,
                        });
                        if (ok) await deleteDocument(d.id, true);
                      }}
                    >
                      Elimina
                    </Button>
                  </div>
                </div>
                {progress[d.id] && (
                  <div className="mt-2">
                    <Spinner label={progress[d.id]} />
                  </div>
                )}
                {d.error && (
                  <div className="mt-3">
                    <Alert tone={d.status === 'error' ? 'error' : 'warn'}>{d.error}</Alert>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Temes</h2>
        {topics.length === 0 ? (
          <EmptyState title="Encara no hi ha temes">Puja un PDF, revisa l’estructura detectada i crea els temes per començar a estudiar.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {topics.map(({ topic, sections, progress: p }) => (
              <Link key={topic.id} to={`/temes/${topic.id}`} className="focus-ring block rounded-xl">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{topic.title}</h3>
                    {p.examPassed ? <Badge tone="green">Examen superat</Badge> : p.examAttempts ? <Badge tone="amber">Examen no superat</Badge> : <Badge>Sense examen</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {sections.length} apartats
                    {topic.pageStart ? ` · pàg. ${topic.pageStart}–${topic.pageEnd}` : ''}
                    {p.bestGrade !== undefined ? ` · millor nota ${p.bestGrade}` : ''}
                  </p>
                  <div className="mt-3 space-y-2">
                    <ProgressBar value={p.readPct} label="Llegit" />
                    <ProgressBar value={p.practicedPct} label="Practicat amb apunts" tone="amber" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      {editing && <SubjectForm open initial={subject} onClose={() => setEditing(false)} />}
    </>
  );
}
