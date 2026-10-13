import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, Spinner, cx, useConfirm, useToast } from '../components/ui';
import { applyStructure } from '../services/study';
import { detectOutline } from '../lib/structure';
import { uid } from '../lib/text';
import type { OutlineNode } from '../types';

/** Revisió de l'estructura detectada (temes i apartats) abans de generar el material d'estudi. */
export default function StructureEditor() {
  const { docId } = useParams();
  const doc = useLiveQuery(() => db.documents.get(docId ?? ''), [docId]);
  const pages = useLiveQuery(() => db.pages.where('docId').equals(docId ?? '').sortBy('pageNumber'), [docId]);
  const [nodes, setNodes] = useState<OutlineNode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ page: number; lineIndex: number } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();

  useEffect(() => {
    if (doc && nodes === null) setNodes((doc.outline ?? []).map((n) => ({ ...n })));
  }, [doc, nodes]);

  const sorted = useMemo(() => (nodes ?? []).slice().sort((a, b) => a.page - b.page || a.lineIndex - b.lineIndex), [nodes]);
  if (doc === undefined || pages === undefined || nodes === null) return <Loading />;
  if (!doc) return <EmptyState title="Document no trobat" />;
  if (doc.status !== 'processed') return <Alert tone="warn">Aquest document encara no s’ha processat correctament ({doc.status}).</Alert>;

  const visible = showAll ? sorted : sorted.filter((n) => n.level !== 0);
  const l1 = sorted.filter((n) => n.level === 1).length;
  const l2 = sorted.filter((n) => n.level === 2).length;
  const update = (id: string, patch: Partial<OutlineNode>) => setNodes((ns) => ns!.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const apply = async () => {
    if (doc.structureApplied) {
      const ok = await confirm({
        title: 'Tornar a crear els temes',
        message: 'Els temes creats abans a partir d’aquest document se substituiran (també les edicions manuals de teoria i preguntes). L’historial d’intents es conserva.',
        confirmLabel: 'Substitueix',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const topics = await applyStructure(doc.id, nodes);
      toast(`S’han creat ${topics.length} temes amb teoria i preguntes.`, 'success');
      nav(`/assignatures/${doc.subjectId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error en crear els temes', 'error');
    } finally {
      setBusy(false);
    }
  };

  const previewPage = preview !== null ? pages.find((p) => p.pageNumber === preview) : undefined;

  return (
    <>
      <PageHeader
        crumbs={[
          { to: '/assignatures', label: 'Assignatures' },
          { to: `/assignatures/${doc.subjectId}`, label: 'Assignatura' },
        ]}
        title="Revisa l’estructura detectada"
        subtitle={`${doc.name} · ${doc.pageCount} pàgines · ${l1} temes i ${l2} apartats seleccionats`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setNodes(detectOutline(pages));
                toast('Estructura detectada de nou');
              }}
            >
              Restableix la detecció
            </Button>
            <Button onClick={apply} disabled={busy}>
              {busy ? <Spinner label="Generant material…" /> : 'Crea els temes i el material d’estudi'}
            </Button>
          </>
        }
      />
      <Alert tone="info">
        Marca cada títol com a <strong>Tema</strong>, <strong>Apartat</strong> (subtema) o <strong>Ignora</strong>. Pots corregir els títols i afegir-ne de nous des de la vista prèvia del text. Si no hi ha cap tema, es crearà un tema amb el nom del document. El material es genera sense IA a partir del text original.
      </Alert>
      {doc.textSource === 'ocr' && (
        <div className="mt-3">
          <Alert tone="warn">Aquest text s’ha obtingut per OCR i pot contenir errors.</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            <span className="text-sm font-medium">Títols ({visible.length})</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Mostra també els descartats
            </label>
          </div>
          {visible.length === 0 && <p className="p-4 text-sm text-slate-500">No s’ha detectat cap títol. Afegeix-ne des de la vista prèvia o crea els temes igualment (es dividirà per pàgines).</p>}
          <ul className="max-h-[65vh] divide-y divide-slate-200 overflow-auto dark:divide-slate-800">
            {visible.map((n) => (
              <li key={n.id} className={cx('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center', n.level === 2 && 'sm:pl-10', n.level === 0 && 'opacity-60')}>
                <select
                  aria-label={`Nivell de «${n.title}»`}
                  className="input w-full sm:w-32"
                  value={n.level}
                  onChange={(e) => update(n.id, { level: Number(e.target.value) as 0 | 1 | 2 })}
                >
                  <option value={1}>Tema</option>
                  <option value={2}>Apartat</option>
                  <option value={0}>Ignora</option>
                </select>
                <input aria-label="Títol" className="input flex-1" value={n.title} onChange={(e) => update(n.id, { title: e.target.value })} />
                <button className="shrink-0 text-xs text-brand-600 underline" onClick={() => setPreview(n.page)} title={n.reason}>
                  p. {n.page}
                </button>
                {n.confidence < 0.6 && <Badge tone="amber" title={n.reason}>Dubtós</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            <span className="text-sm font-medium">Vista prèvia del text extret</span>
            <select className="input w-32" aria-label="Pàgina" value={preview ?? pages[0]?.pageNumber ?? 1} onChange={(e) => setPreview(Number(e.target.value))}>
              {pages.map((p) => (
                <option key={p.pageNumber} value={p.pageNumber}>
                  Pàgina {p.pageNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[65vh] overflow-auto px-4 py-3 text-sm">
            {(previewPage ?? pages[0])?.lines.map((l, i) => {
              const pg = (previewPage ?? pages[0]).pageNumber;
              const node = sorted.find((n) => n.page === pg && n.lineIndex === i && n.level !== 0);
              return (
                <div key={i} className={cx('group flex items-start gap-2 rounded px-1', node && 'bg-brand-50 dark:bg-brand-900/30')}>
                  <span className={cx('flex-1', l.size > 12 && 'font-semibold', l.bold && 'font-semibold')}>{l.text}</span>
                  {!node && (
                    <button
                      className="shrink-0 text-xs text-brand-600 opacity-40 group-hover:opacity-100 focus:opacity-100"
                      onClick={() => setAdding({ page: pg, lineIndex: i })}
                      aria-label={`Marca «${l.text}» com a títol`}
                    >
                      + títol
                    </button>
                  )}
                  {adding && adding.page === pg && adding.lineIndex === i && (
                    <span className="flex gap-1">
                      {([1, 2] as const).map((lv) => (
                        <Button
                          key={lv}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setNodes((ns) => [...ns!, { id: uid('n'), title: l.text, level: lv, page: pg, lineIndex: i, confidence: 1, reason: 'Afegit manualment' }]);
                            setAdding(null);
                          }}
                        >
                          {lv === 1 ? 'Tema' : 'Apartat'}
                        </Button>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
            {(previewPage ?? pages[0])?.lines.length === 0 && <p className="text-slate-500">Aquesta pàgina no té text.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
