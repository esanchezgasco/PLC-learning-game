import { useState } from 'react';
import type { Section, TheoryBlock, TheoryContent } from '../types';
import { uid } from '../lib/text';
import { Button, OriginBadge } from './ui';

const KIND_LABEL: Record<TheoryBlock['kind'], string> = {
  heading: 'Títol',
  paragraph: 'Paràgraf',
  definition: 'Definició',
  list: 'Llista',
  legal: 'Normativa',
  example: 'Exemple',
  comparison: 'Taula',
  note: 'Nota',
};

/** Editor manual de la teoria. Els blocs modificats passen a tenir origen «Editat per tu». */
export function TheoryEditor({ section, onSave, onCancel }: { section: Section; onSave: (t: TheoryContent) => void; onCancel: () => void }) {
  const [t, setT] = useState<TheoryContent>(() => structuredClone(section.theory));
  const setBlock = (id: string, patch: Partial<TheoryBlock>) =>
    setT((cur) => ({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? ({ ...b, ...patch, origin: 'manual' } as TheoryBlock) : b)) }));
  const move = (i: number, d: number) =>
    setT((cur) => {
      const blocks = cur.blocks.slice();
      const j = i + d;
      if (j < 0 || j >= blocks.length) return cur;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...cur, blocks };
    });
  const add = (kind: 'paragraph' | 'note' | 'heading') => setT((cur) => ({ ...cur, blocks: [...cur.blocks, { kind, id: uid('b'), text: '', origin: 'manual', pages: [] } as TheoryBlock] }));
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Objectius d’aprenentatge (un per línia)</label>
        <textarea className="input" rows={3} value={t.objectives.items.join('\n')} onChange={(e) => setT({ ...t, objectives: { items: lines(e.target.value), origin: 'manual' } })} />
      </div>
      {t.blocks.map((b, i) => (
        <div key={b.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">{KIND_LABEL[b.kind]}</span>
            <OriginBadge origin={b.origin} />
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Puja">
                ↑
              </Button>
              <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Baixa">
                ↓
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setT({ ...t, blocks: t.blocks.filter((x) => x.id !== b.id) })}>
                Elimina
              </Button>
            </span>
          </div>
          {b.kind === 'definition' && <input className="input mb-2" aria-label="Terme" value={b.term} onChange={(e) => setBlock(b.id, { term: e.target.value })} />}
          {b.kind === 'list' && (
            <>
              <input className="input mb-2" aria-label="Títol de la llista" placeholder="Títol (opcional)" value={b.title ?? ''} onChange={(e) => setBlock(b.id, { title: e.target.value })} />
              <textarea className="input" rows={Math.max(3, b.items.length)} aria-label="Elements (un per línia)" value={b.items.join('\n')} onChange={(e) => setBlock(b.id, { items: lines(e.target.value) })} />
            </>
          )}
          {b.kind === 'comparison' && (
            <textarea
              className="input font-mono text-xs"
              rows={Math.max(3, b.rows.length + 1)}
              aria-label="Taula (columnes separades per |)"
              value={[b.headers.join(' | '), ...b.rows.map((r) => r.join(' | '))].join('\n')}
              onChange={(e) => {
                const [h, ...rows] = lines(e.target.value).map((l) => l.split('|').map((c) => c.trim()));
                setBlock(b.id, { headers: h ?? [], rows });
              }}
            />
          )}
          {'text' in b && (
            <textarea className="input" rows={Math.min(10, Math.max(2, Math.ceil(b.text.length / 90)))} aria-label="Text" value={b.text} onChange={(e) => setBlock(b.id, { text: e.target.value })} />
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => add('heading')}>
          + Títol
        </Button>
        <Button size="sm" variant="secondary" onClick={() => add('paragraph')}>
          + Paràgraf
        </Button>
        <Button size="sm" variant="secondary" onClick={() => add('note')}>
          + Nota
        </Button>
      </div>
      <div>
        <label className="label">Resum (una idea per línia)</label>
        <textarea className="input" rows={4} value={t.summary.items.join('\n')} onChange={(e) => setT({ ...t, summary: { ...t.summary, items: lines(e.target.value), origin: 'manual' } })} />
      </div>
      <div>
        <label className="label">Conceptes clau (separats per comes)</label>
        <input
          className="input"
          value={t.keyConcepts.items.join(', ')}
          onChange={(e) => setT({ ...t, keyConcepts: { items: e.target.value.split(',').map((x) => x.trim()).filter(Boolean), origin: 'manual' } })}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave(t)}>Desa la teoria</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel·la
        </Button>
      </div>
    </div>
  );
}
