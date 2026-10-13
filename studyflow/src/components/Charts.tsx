// Gràfics senzills en SVG (una sola sèrie, sense dependències). Cada marca té un tooltip
// i un objectiu de hover més gran que la marca; les dades també es mostren en taules a la pàgina.
import { useState } from 'react';
import { formatDate } from '../lib/text';

/** Evolució de notes (0-10) al llarg dels intents. */
export function GradeLine({ points, height = 180 }: { points: { at: number; grade: number; label?: string }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="text-sm text-slate-500">Encara no hi ha cap examen fet.</p>;
  const W = 560;
  const H = height;
  const pad = { l: 32, r: 16, t: 14, b: 26 };
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (g: number) => pad.t + (1 - g / 10) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.grade)}`).join(' ');
  const last = points.length - 1;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Evolució de la nota en ${points.length} intents. Última nota ${points[last].grade}.`}>
        {[0, 5, 10].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className={g === 5 ? 'stroke-slate-400 dark:stroke-slate-500' : 'stroke-slate-200 dark:stroke-slate-800'} strokeDasharray={g === 5 ? '4 4' : undefined} strokeWidth={1} />
            <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {g}
            </text>
          </g>
        ))}
        <text x={W - pad.r} y={y(5) - 4} textAnchor="end" className="fill-slate-500 text-[10px]">
          aprovat
        </text>
        <path d={path} fill="none" className="stroke-brand-600 dark:stroke-brand-500" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <circle cx={x(i)} cy={y(p.grade)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(p.grade)} r={hover === i ? 6 : 4.5} className="fill-brand-600 stroke-white dark:fill-brand-500 dark:stroke-slate-900" strokeWidth={2} />
            <title>{`${p.label ?? `Intent ${i + 1}`} · ${formatDate(p.at)} · nota ${p.grade}`}</title>
          </g>
        ))}
        <text x={x(last)} y={y(points[last].grade) - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold dark:fill-slate-200">
          {points[last].grade}
        </text>
        {hover !== null && hover !== last && (
          <text x={x(hover)} y={y(points[hover].grade) - 10} textAnchor="middle" className="fill-slate-700 text-[11px] dark:fill-slate-200">
            {points[hover].grade}
          </text>
        )}
        {points.map((_, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
            {points.length <= 8 || i === 0 || i === last ? `#${i + 1}` : ''}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/** Barres horitzontals de percentatge (0-1), una sèrie. */
export function PercentBars({ rows }: { rows: { label: string; value: number; hint?: string }[] }) {
  if (!rows.length) return <p className="text-sm text-slate-500">Sense dades.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pct = Math.round(Math.max(0, Math.min(1, r.value)) * 100);
        return (
          <div key={r.label} title={`${r.label}: ${pct}%${r.hint ? ` · ${r.hint}` : ''}`}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="truncate text-slate-700 dark:text-slate-300">{r.label}</span>
              <span className="shrink-0 text-slate-600 tabular-nums dark:text-slate-400">
                {pct}%{r.hint ? <span className="ml-1 text-xs text-slate-500">({r.hint})</span> : null}
              </span>
            </div>
            <div className="h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-r-[4px] bg-brand-600 dark:bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
