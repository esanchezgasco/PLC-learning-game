// Model de dades de StudyFlow. Tot es desa localment a IndexedDB (vegeu src/db).

export type ID = string;

/** Origen d'un contingut: permet separar clarament el text del PDF del que s'ha generat. */
export type ContentOrigin =
  | 'pdf' // text literal extret del PDF de l'usuari
  | 'extractive' // reorganització automàtica del text del PDF (sense IA, sense afegir contingut)
  | 'ai-textual' // generat per IA i declarat com a basat literalment en el document
  | 'ai-complement' // explicació complementària generada per IA (no és al document)
  | 'ai-unverified' // IA: informació que no es pot verificar amb el document
  | 'manual' // editat per l'usuari
  | 'demo'; // contingut fictici de demostració

export interface Subject {
  id: ID;
  name: string;
  description: string;
  color: string;
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DocStatus = 'pending' | 'processing' | 'processed' | 'needs_ocr' | 'error';

export interface PdfLine {
  text: string;
  /** Alçada de la font aproximada (punts) */
  size: number;
  bold: boolean;
  /** Posició vertical (per ordenar) */
  y: number;
  x: number;
}

export interface DocumentPage {
  id: string; // `${docId}:${pageNumber}`
  docId: ID;
  pageNumber: number;
  text: string;
  lines: PdfLine[];
  source: 'pdf' | 'ocr';
}

/** Node de l'estructura detectada (capítol/tema o subtema) */
export interface OutlineNode {
  id: ID;
  title: string;
  /** 1 = tema, 2 = subtema/apartat, 0 = ignorar */
  level: 0 | 1 | 2;
  page: number;
  /** Índex de línia dins la pàgina on comença */
  lineIndex: number;
  /** Confiança de la detecció (0-1) */
  confidence: number;
  reason: string;
}

export interface StudyDocument {
  id: ID;
  subjectId: ID;
  name: string;
  size: number;
  status: DocStatus;
  error?: string;
  pageCount?: number;
  textChars?: number;
  pagesWithoutText?: number[];
  outline?: OutlineNode[];
  /** Si s'ha aplicat l'estructura i s'han creat temes */
  structureApplied?: boolean;
  /** Mètode d'extracció */
  textSource?: 'pdf' | 'ocr' | 'mixed';
  createdAt: number;
  processedAt?: number;
}

export interface DocumentBlob {
  id: ID; // = docId
  data: Blob;
}

export interface PageRef {
  docId?: ID;
  docName?: string;
  page: number;
}

// ---------- Teoria ----------

export type TheoryBlock =
  | { kind: 'heading'; id: ID; text: string; origin: ContentOrigin; pages: number[] }
  | { kind: 'paragraph'; id: ID; text: string; origin: ContentOrigin; pages: number[] }
  | { kind: 'definition'; id: ID; term: string; text: string; origin: ContentOrigin; pages: number[] }
  | { kind: 'list'; id: ID; title?: string; items: string[]; ordered: boolean; origin: ContentOrigin; pages: number[] }
  | { kind: 'legal'; id: ID; text: string; refs: string[]; origin: ContentOrigin; pages: number[] }
  | { kind: 'example'; id: ID; text: string; origin: ContentOrigin; pages: number[] }
  | { kind: 'comparison'; id: ID; title: string; headers: string[]; rows: string[][]; origin: ContentOrigin; pages: number[] }
  | { kind: 'note'; id: ID; text: string; origin: ContentOrigin; pages: number[] };

export interface TheoryContent {
  objectives: { items: string[]; origin: ContentOrigin };
  blocks: TheoryBlock[];
  summary: { items: string[]; origin: ContentOrigin; pages: number[] };
  keyConcepts: { items: string[]; origin: ContentOrigin };
  /** Com s'ha generat aquesta teoria */
  generator: 'extractive' | 'ai' | 'manual' | 'demo';
  generatedAt: number;
  aiModel?: string;
  warnings?: string[];
}

export interface Topic {
  id: ID;
  subjectId: ID;
  title: string;
  order: number;
  documentId?: ID;
  pageStart?: number;
  pageEnd?: number;
  isDemo?: boolean;
  createdAt: number;
}

export interface Section {
  id: ID;
  topicId: ID;
  subjectId: ID;
  title: string;
  order: number;
  documentId?: ID;
  docName?: string;
  pageStart?: number;
  pageEnd?: number;
  /** Text original extret, amb marques de pàgina: línies "[[p:N]]" */
  sourceText: string;
  theory: TheoryContent;
  theoryEdited?: boolean;
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------- Preguntes ----------

export type QuestionType =
  | 'mcq' // test 4 opcions
  | 'truefalse'
  | 'cloze' // completar
  | 'short' // resposta curta (criteris)
  | 'matching' // relacionar
  | 'difference' // diferències entre conceptes (oberta)
  | 'case'; // cas pràctic

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionSource {
  sectionId: ID;
  pages: number[];
  docId?: ID;
  docName?: string;
  /** Fragment literal que justifica la resposta */
  excerpt: string;
  /** Si el fragment s'ha trobat literalment al text de la secció */
  verified: boolean;
}

export interface Question {
  id: ID;
  subjectId: ID;
  topicId: ID;
  sectionId: ID;
  type: QuestionType;
  prompt: string;
  /** mcq: opcions; matching: termes de l'esquerra */
  options?: string[];
  /** matching: parelles correctes (esquerra -> dreta) */
  pairs?: { left: string; right: string }[];
  /** mcq: índex correcte; truefalse: 'true'|'false'; cloze: text esperat; short/difference/case: resposta model */
  answer: string;
  /** Respostes alternatives acceptades (cloze) */
  acceptable?: string[];
  /** Criteris de correcció explícits (preguntes obertes) */
  criteria?: { text: string; keywords: string[] }[];
  explanation: string;
  source: QuestionSource;
  difficulty: Difficulty;
  /** Concepte avaluat (per al seguiment del domini) */
  concept: string;
  /** Plantilla de generació (per evitar variants massa semblants) */
  template: string;
  /** practice: per a la pràctica amb teoria; exam: reservada per a exàmens */
  pool: 'practice' | 'exam';
  origin: 'local' | 'ai' | 'manual' | 'demo';
  needsReview: boolean;
  flags: string[];
  /** Generació del banc (es regenera sense perdre intents) */
  generation: number;
  archived?: boolean;
  createdAt: number;
}

// ---------- Intents i resultats ----------

export type AnswerValue =
  | { type: 'choice'; index: number }
  | { type: 'bool'; value: boolean }
  | { type: 'text'; value: string }
  | { type: 'matching'; map: Record<string, string> }
  | { type: 'blank' };

export interface GradeResult {
  correct: boolean;
  /** 0..1 */
  score: number;
  feedback: string;
  /** La correcció és orientativa (preguntes obertes) */
  orientative: boolean;
  matchedCriteria?: string[];
  missedCriteria?: string[];
}

export interface AttemptAnswer {
  questionId: ID;
  /** Còpia de la pregunta en el moment de l'intent: l'historial sobreviu a regeneracions */
  snapshot: Pick<Question, 'type' | 'prompt' | 'options' | 'pairs' | 'answer' | 'explanation' | 'source' | 'concept' | 'sectionId' | 'difficulty' | 'criteria'>;
  response: AnswerValue;
  grade: GradeResult;
  answeredAt: number;
}

export interface Attempt {
  id: ID;
  subjectId: ID;
  topicId: ID;
  sectionId?: ID;
  kind: 'practice' | 'exam' | 'review';
  startedAt: number;
  finishedAt?: number;
  questionIds: ID[];
  answers: AttemptAnswer[];
  /** 0..10 (exàmens) */
  grade?: number;
  config?: ExamConfig;
  notes?: string[];
  /** Respostes provisionals d'un examen en curs (es poden reprendre) */
  draft?: Record<string, AnswerValue>;
  /** Hora límit (ms) si l'examen té durada */
  deadline?: number;
}

export interface ExamConfig {
  questionCount: number;
  durationMinutes: number | null;
  difficulty: 'mixed' | Difficulty;
}

/** Estat de repetició espaiada per pregunta */
export interface ReviewState {
  id: ID; // = questionId
  subjectId: ID;
  topicId: ID;
  concept: string;
  box: number;
  due: number;
  lastReviewed: number;
  lapses: number;
  correctStreak: number;
  totalSeen: number;
}

export interface SectionProgress {
  id: ID; // = sectionId
  topicId: ID;
  subjectId: ID;
  readAt?: number;
  practicedAt?: number;
  practiceBest?: number; // 0..1
  practiceLast?: number;
}

export interface Settings {
  id: 'settings';
  theme: 'light' | 'dark' | 'system';
  aiEnabled: boolean;
  aiProvider: string;
  aiModel: string;
  /** L'usuari ha acceptat explícitament enviar contingut a la IA */
  aiConsent: boolean;
  srs: SrsConfig;
  examDefaults: ExamConfig;
  demoSeeded: boolean;
  lastStudied?: { subjectId: ID; topicId: ID; sectionId?: ID; at: number };
}

export interface SrsConfig {
  /** Intervals en dies per a cada caixa de Leitner */
  intervals: number[];
  /** Llindar (0-1) per considerar una resposta oberta com a encertada */
  openAnswerThreshold: number;
  /** Màxim d'elements per sessió de repàs */
  sessionSize: number;
  /** Dies sense estudiar a partir dels quals un tema es considera "fa temps" */
  staleDays: number;
}

export type MasteryLevel = 'not_started' | 'not_achieved' | 'learning' | 'achieved' | 'mastered';
