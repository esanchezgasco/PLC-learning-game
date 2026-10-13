import { useMemo } from 'react';
import type { AnswerValue, AttemptAnswer, GradeResult, Question } from '../types';
import { hashString, seededShuffle } from '../lib/text';
import { Alert, Badge, cx } from './ui';
import { PageRefs } from './TheoryView';

export const TYPE_LABEL: Record<Question['type'], string> = {
  mcq: 'Test',
  truefalse: 'Vertader o fals',
  cloze: 'Completar',
  short: 'Resposta curta',
  matching: 'Relacionar',
  difference: 'Diferències',
  case: 'Cas pràctic',
};
export const DIFF_LABEL = { easy: 'Fàcil', medium: 'Mitjana', hard: 'Difícil' } as const;

type Q = Pick<Question, 'id' | 'type' | 'prompt' | 'options' | 'pairs'>;

/** Camp de resposta segons el tipus de pregunta. */
export function QuestionInput({ q, value, onChange, disabled }: { q: Q; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  const rights = useMemo(() => seededShuffle((q.pairs ?? []).map((p) => p.right), hashString(q.id)), [q.id, q.pairs]);
  switch (q.type) {
    case 'mcq':
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">Opcions</legend>
          {(q.options ?? []).map((o, i) => {
            const checked = value?.type === 'choice' && value.index === i;
            return (
              <label
                key={i}
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  checked ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                  disabled && 'cursor-default',
                )}
              >
                <input type="radio" name={`q-${q.id}`} className="mt-1" checked={checked} onChange={() => onChange({ type: 'choice', index: i })} />
                <span>
                  <span className="mr-2 font-semibold text-slate-500">{String.fromCharCode(65 + i)}.</span>
                  {o}
                </span>
              </label>
            );
          })}
        </fieldset>
      );
    case 'truefalse':
      return (
        <div className="flex gap-3" role="radiogroup" aria-label="Vertader o fals">
          {[true, false].map((v) => {
            const checked = value?.type === 'bool' && value.value === v;
            return (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange({ type: 'bool', value: v })}
                className={cx(
                  'focus-ring flex-1 rounded-lg border px-4 py-3 font-medium',
                  checked ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                )}
              >
                {v ? 'Vertader' : 'Fals'}
              </button>
            );
          })}
        </div>
      );
    case 'cloze':
      return (
        <input
          className="input text-base"
          aria-label="Resposta"
          placeholder="Escriu la paraula o expressió que falta"
          disabled={disabled}
          value={value?.type === 'text' ? value.value : ''}
          onChange={(e) => onChange({ type: 'text', value: e.target.value })}
        />
      );
    case 'matching': {
      const map = value?.type === 'matching' ? value.map : {};
      return (
        <div className="space-y-3">
          {(q.pairs ?? []).map((p) => (
            <div key={p.left} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center">
              <div className="font-medium">{p.left}</div>
              <select
                className="input"
                aria-label={`Definició per a ${p.left}`}
                disabled={disabled}
                value={map[p.left] ?? ''}
                onChange={(e) => onChange({ type: 'matching', map: { ...map, [p.left]: e.target.value } })}
              >
                <option value="">— Tria una definició —</option>
                {rights.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }
    default:
      return (
        <textarea
          className="input min-h-32 text-base"
          aria-label="Resposta"
          placeholder="Escriu la teva resposta"
          disabled={disabled}
          value={value?.type === 'text' ? value.value : ''}
          onChange={(e) => onChange({ type: 'text', value: e.target.value })}
        />
      );
  }
}

/** Correcció detallada d'una pregunta: resultat, explicació, resposta esperada i font. */
export function Feedback({
  q,
  grade,
  response,
  onOpenPage,
  docName,
}: {
  q: AttemptAnswer['snapshot'];
  grade: GradeResult;
  response?: AnswerValue;
  onOpenPage?: (p: number) => void;
  docName?: string;
}) {
  const blank = !response || response.type === 'blank' || (response.type === 'text' && !response.value.trim());
  const tone = blank ? 'warn' : grade.correct ? 'success' : grade.score > 0 ? 'warn' : 'error';
  const title = blank ? 'Sense resposta' : grade.correct ? (grade.orientative ? 'Resposta adequada (avaluació orientativa)' : 'Correcte') : grade.score > 0 ? 'Parcialment correcte' : 'Incorrecte';
  return (
    <div className="space-y-3">
      <Alert tone={tone} title={title}>
        {grade.feedback}
      </Alert>
      {q.type === 'mcq' && (
        <p className="text-sm">
          <strong>Resposta correcta:</strong> {String.fromCharCode(65 + Number(q.answer))}. {q.options?.[Number(q.answer)]}
        </p>
      )}
      {q.type === 'truefalse' && (
        <p className="text-sm">
          <strong>Resposta correcta:</strong> {q.answer === 'true' ? 'Vertader' : 'Fals'}
        </p>
      )}
      {q.type === 'cloze' && (
        <p className="text-sm">
          <strong>Resposta esperada:</strong> {q.answer}
        </p>
      )}
      {q.type === 'matching' && (
        <div className="text-sm">
          <strong>Parelles correctes:</strong>
          <ul className="mt-1 ml-5 list-disc">
            {(q.pairs ?? []).map((p) => {
              const given = response?.type === 'matching' ? response.map[p.left] : undefined;
              const ok = given === p.right;
              return (
                <li key={p.left} className={ok ? '' : 'text-red-700 dark:text-red-300'}>
                  <strong>{p.left}</strong> → {p.right} {ok ? '✓' : given ? `(has triat: ${given})` : '(sense resposta)'}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(q.type === 'short' || q.type === 'difference' || q.type === 'case') && (
        <div className="space-y-2 text-sm">
          <div>
            <strong>Resposta de referència:</strong> {q.answer}
          </div>
          {q.criteria && q.criteria.length > 0 && (
            <div>
              <strong>Criteris de correcció:</strong>
              <ul className="mt-1 ml-5 list-disc">
                {q.criteria.map((c) => {
                  const ok = grade.matchedCriteria?.includes(c.text);
                  return (
                    <li key={c.text}>
                      {ok ? '✓ ' : '○ '}
                      {c.text}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-500">La correcció de preguntes obertes és orientativa. Compara la teva resposta amb la referència i els criteris.</p>
        </div>
      )}
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
        <div className="font-semibold">Explicació</div>
        <p className="mt-1 whitespace-pre-line">{q.explanation}</p>
      </div>
      {q.source?.excerpt && (
        <blockquote className="border-l-4 border-slate-300 pl-3 text-sm text-slate-600 italic dark:border-slate-600 dark:text-slate-400">
          {q.source.excerpt.split(' … ').map((x, i) => (
            <span key={i} className="block">
              «{x}»
            </span>
          ))}
          <div className="mt-1 flex flex-wrap items-center gap-2 not-italic">
            {!q.source.verified && <Badge tone="red">Font no verificada</Badge>}
            {docName && <span className="text-xs">{docName}</span>}
            <PageRefs pages={q.source.pages} section={onOpenPage ? { documentId: q.source.docId, docName } : undefined} onOpen={onOpenPage} />
          </div>
        </blockquote>
      )}
    </div>
  );
}
