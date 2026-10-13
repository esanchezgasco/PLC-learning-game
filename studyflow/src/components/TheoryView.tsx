import { useEffect, useRef, useState } from 'react';
import type { Section, TheoryBlock } from '../types';
import { renderPage } from '../services/pdf';
import { Alert, Badge, Modal, OriginBadge, Spinner, cx } from './ui';

/** Referència clicable a una pàgina del PDF original */
export function PageRefs({ pages, section, onOpen }: { pages: number[]; section?: Pick<Section, 'documentId' | 'docName'>; onOpen?: (p: number) => void }) {
  const valid = Array.from(new Set(pages.filter((p) => p > 0))).sort((a, b) => a - b);
  if (!valid.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      {valid.map((p) =>
        section?.documentId && onOpen ? (
          <button key={p} onClick={() => onOpen(p)} className="focus-ring rounded px-1 underline decoration-dotted hover:text-brand-600" title={`Obre la pàgina ${p} de ${section.docName ?? 'el PDF'}`}>
            p. {p}
          </button>
        ) : (
          <span key={p}>p. {p}</span>
        ),
      )}
    </span>
  );
}

export function PdfPageModal({ docId, docName, page, onClose }: { docId?: string; docName?: string; page: number | null; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [current, setCurrent] = useState(page ?? 1);
  useEffect(() => setCurrent(page ?? 1), [page]);
  useEffect(() => {
    if (!page || !docId || !ref.current) return;
    setState('loading');
    renderPage(docId, current, ref.current, Math.min(900, window.innerWidth - 60))
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [docId, current, page]);
  return (
    <Modal open={page !== null} onClose={onClose} title={`${docName ?? 'PDF original'} — pàgina ${current}`} wide>
      <div className="mb-3 flex gap-2">
        <button className="rounded border px-2 py-1 text-sm dark:border-slate-700" onClick={() => setCurrent((c) => Math.max(1, c - 1))}>
          ‹ Anterior
        </button>
        <button className="rounded border px-2 py-1 text-sm dark:border-slate-700" onClick={() => setCurrent((c) => c + 1)}>
          Següent ›
        </button>
      </div>
      {state === 'loading' && <Spinner label="Renderitzant la pàgina…" />}
      {state === 'error' && <Alert tone="error">No s’ha pogut mostrar la pàgina del PDF.</Alert>}
      <canvas ref={ref} className={cx('mx-auto max-w-full rounded border border-slate-200 bg-white', state !== 'ok' && 'hidden')} />
    </Modal>
  );
}

function BlockView({ b, section, onOpen }: { b: TheoryBlock; section: Section; onOpen: (p: number) => void }) {
  const meta = (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <OriginBadge origin={b.origin} />
      <PageRefs pages={b.pages} section={section} onOpen={onOpen} />
    </div>
  );
  switch (b.kind) {
    case 'heading':
      return <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">{b.text}</h3>;
    case 'paragraph':
      return (
        <div>
          <p>{b.text}</p>
          {b.origin !== 'pdf' ? meta : <PageRefs pages={b.pages} section={section} onOpen={onOpen} />}
        </div>
      );
    case 'definition':
      return (
        <div className="rounded-lg border-l-4 border-brand-500 bg-brand-50/60 px-4 py-3 dark:bg-brand-900/20">
          <div className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-200">Definició · {b.term}</div>
          <p className="mt-1">{b.text}</p>
          {meta}
        </div>
      );
    case 'list':
      return (
        <div>
          {b.title && <div className="font-medium text-slate-900 dark:text-white">{b.title}</div>}
          {b.ordered ? (
            <ol className="ml-6 list-decimal space-y-1">{b.items.map((it, i) => <li key={i}>{it}</li>)}</ol>
          ) : (
            <ul className="ml-6 list-disc space-y-1">{b.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
          )}
          {meta}
        </div>
      );
    case 'legal':
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex flex-wrap gap-1">
            {b.refs.map((r) => (
              <Badge key={r} tone="amber">
                {r}
              </Badge>
            ))}
          </div>
          <p className="mt-1">{b.text}</p>
          {meta}
        </div>
      );
    case 'example':
      return (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">Exemple</div>
          <p className="mt-1">{b.text}</p>
          {meta}
        </div>
      );
    case 'comparison':
      return (
        <div>
          <div className="font-medium text-slate-900 dark:text-white">{b.title}</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {b.headers.map((h) => (
                    <th key={h} className="border-b border-slate-300 px-2 py-1.5 text-left font-semibold dark:border-slate-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i} className="align-top">
                    {r.map((c, j) => (
                      <td key={j} className={cx('border-b border-slate-200 px-2 py-1.5 dark:border-slate-800', j === 0 && 'font-medium')}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta}
        </div>
      );
    case 'note':
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <p>{b.text}</p>
          {meta}
        </div>
      );
  }
}

/** Mostra la teoria d'un apartat amb l'origen de cada bloc i les referències de pàgina. */
export function TheoryView({ section, compact }: { section: Section; compact?: boolean }) {
  const [page, setPage] = useState<number | null>(null);
  const t = section.theory;
  return (
    <article className={cx('prose-study space-y-4', compact && 'text-[0.97rem]')}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={t.generator === 'ai' ? 'amber' : t.generator === 'demo' ? 'violet' : 'blue'}>
          {t.generator === 'extractive' && 'Teoria extractiva (sense IA): text original del PDF organitzat'}
          {t.generator === 'ai' && `Teoria generada amb IA${t.aiModel ? ` (${t.aiModel})` : ''}`}
          {t.generator === 'manual' && 'Teoria editada manualment'}
          {t.generator === 'demo' && 'Contingut de demostració (fictici)'}
        </Badge>
        {section.theoryEdited && <Badge tone="violet">Editada per tu</Badge>}
        {section.docName && (
          <span className="text-slate-500">
            Font: {section.docName}
            {section.pageStart ? `, pàg. ${section.pageStart}${section.pageEnd && section.pageEnd !== section.pageStart ? `–${section.pageEnd}` : ''}` : ''}
          </span>
        )}
      </div>
      {t.warnings && t.warnings.length > 0 && (
        <Alert tone="warn">
          <ul className="ml-4 list-disc">
            {t.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      {t.objectives.items.length > 0 && (
        <section className="rounded-lg bg-slate-100 px-4 py-3 dark:bg-slate-800/60">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300">Objectius d’aprenentatge</h3>
            <OriginBadge origin={t.objectives.origin} />
          </div>
          <ul className="mt-1 ml-5 list-disc text-[0.97rem]">
            {t.objectives.items.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}
      {t.blocks.map((b) => (
        <BlockView key={b.id} b={b} section={section} onOpen={setPage} />
      ))}
      {t.summary.items.length > 0 && (
        <section className="mt-6 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white">Resum final</h3>
            <OriginBadge origin={t.summary.origin} />
          </div>
          {t.summary.origin === 'extractive' && <p className="text-xs text-slate-500">Frases seleccionades literalment del document.</p>}
          <ul className="mt-2 ml-5 list-disc">
            {t.summary.items.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
          <PageRefs pages={t.summary.pages} section={section} onOpen={setPage} />
        </section>
      )}
      {t.keyConcepts.items.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-white">Conceptes clau</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.keyConcepts.items.map((c) => (
              <span key={c} className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-600">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
      <PdfPageModal docId={section.documentId} docName={section.docName} page={page} onClose={() => setPage(null)} />
    </article>
  );
}
