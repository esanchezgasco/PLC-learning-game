// Controls de qualitat sobre el banc de preguntes.

import type { Question } from '../types';
import { fragmentInSource, jaccard, normalize } from './text';

export interface QualityIssue {
  questionId: string;
  issue: string;
}

/** Aplica comprovacions i marca les preguntes que cal revisar. Retorna les preguntes (mutades) i la llista d'incidències. */
export function checkQuestions(questions: Question[], sourceBySection: Record<string, string>): { questions: Question[]; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  const add = (qq: Question, msg: string, review = true) => {
    if (!qq.flags.includes(msg)) qq.flags.push(msg);
    if (review) qq.needsReview = true;
    issues.push({ questionId: qq.id, issue: msg });
  };
  const kept: Question[] = [];
  for (const qq of questions) {
    // 1. Vinculació a font
    const src = sourceBySection[qq.sectionId];
    if (!qq.source?.excerpt) add(qq, 'Sense fragment de font que la justifiqui');
    else if (src !== undefined && qq.origin !== 'manual' && qq.origin !== 'demo') {
      const ok = fragmentInSource(src, qq.source.excerpt);
      qq.source.verified = ok;
      if (!ok) add(qq, 'El fragment citat no s’ha trobat literalment al text de l’apartat');
    }
    if (!qq.explanation?.trim()) add(qq, 'Sense justificació de la resposta');
    if (!qq.prompt || qq.prompt.trim().length < 12) add(qq, 'Enunciat massa curt o ambigu');

    // 2. Coherència per tipus
    if (qq.type === 'mcq') {
      const opts = qq.options ?? [];
      const idx = Number(qq.answer);
      if (opts.length < 2 || !(idx >= 0 && idx < opts.length)) add(qq, 'Opcions o resposta correcta no vàlides');
      const norm = opts.map(normalize);
      if (new Set(norm).size !== norm.length) add(qq, 'Opcions duplicades (possibles dues respostes correctes)');
      for (let i = 0; i < opts.length; i++)
        for (let j = i + 1; j < opts.length; j++)
          if (i !== j && norm[i] && norm[j] && (norm[i].includes(norm[j]) || norm[j].includes(norm[i])) && Math.min(norm[i].length, norm[j].length) > 3)
            add(qq, 'Dues opcions molt semblants: podrien ser correctes alhora');
      if (opts.some((o) => normalize(qq.prompt).includes(normalize(o)) && normalize(o).length > 8) && qq.template !== 'list-odd')
        add(qq, 'Una opció apareix a l’enunciat (pista evident)', false);
    }
    if (qq.type === 'cloze') {
      if (!qq.answer.trim()) add(qq, 'Resposta esperada buida');
      const promptN = normalize(qq.prompt);
      const ansN = normalize(qq.answer);
      if (ansN.length > 3 && promptN.includes(` ${ansN} `)) add(qq, 'La resposta apareix a l’enunciat', false);
    }
    if (qq.type === 'truefalse' && !['true', 'false'].includes(qq.answer)) add(qq, 'Resposta de vertader/fals no vàlida');
    if ((qq.type === 'short' || qq.type === 'difference' || qq.type === 'case') && !(qq.criteria && qq.criteria.length))
      add(qq, 'Pregunta oberta sense criteris de correcció');
    if (qq.type === 'matching') {
      const pairs = qq.pairs ?? [];
      if (pairs.length < 2) add(qq, 'Relacionar amb menys de dues parelles');
      if (new Set(pairs.map((p) => normalize(p.right))).size !== pairs.length) add(qq, 'Definicions repetides a l’exercici de relacionar');
    }

    // 3. Duplicats (mateix apartat, enunciat gairebé igual)
    const dup = kept.find((k) => k.sectionId === qq.sectionId && k.type === qq.type && (normalize(k.prompt) === normalize(qq.prompt) || jaccard(k.prompt, qq.prompt) > 0.92) && k.answer === qq.answer);
    if (dup) {
      issues.push({ questionId: qq.id, issue: 'Pregunta duplicada descartada' });
      continue;
    }
    kept.push(qq);
  }
  return { questions: kept, issues };
}
