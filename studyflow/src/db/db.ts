// Base de dades local (IndexedDB via Dexie). Les dades no surten del navegador.
import Dexie, { type Table } from 'dexie';
import type {
  Attempt,
  DocumentBlob,
  DocumentPage,
  Question,
  ReviewState,
  Section,
  SectionProgress,
  Settings,
  StudyDocument,
  Subject,
  Topic,
} from '../types';
import { DEFAULT_SRS } from '../lib/srs';

export class StudyFlowDB extends Dexie {
  subjects!: Table<Subject, string>;
  documents!: Table<StudyDocument, string>;
  blobs!: Table<DocumentBlob, string>;
  pages!: Table<DocumentPage, string>;
  topics!: Table<Topic, string>;
  sections!: Table<Section, string>;
  questions!: Table<Question, string>;
  attempts!: Table<Attempt, string>;
  reviews!: Table<ReviewState, string>;
  progress!: Table<SectionProgress, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'studyflow') {
    super(name);
    this.version(1).stores({
      subjects: 'id, name, createdAt',
      documents: 'id, subjectId, status, createdAt',
      blobs: 'id',
      pages: 'id, docId, pageNumber',
      topics: 'id, subjectId, order, documentId',
      sections: 'id, topicId, subjectId, order, documentId',
      questions: 'id, subjectId, topicId, sectionId, pool, generation, archived',
      attempts: 'id, subjectId, topicId, sectionId, kind, startedAt',
      reviews: 'id, subjectId, topicId, due',
      progress: 'id, topicId, subjectId',
      settings: 'id',
    });
  }
}

export const db = new StudyFlowDB();

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  aiEnabled: false,
  aiProvider: 'anthropic',
  aiModel: '',
  aiConsent: false,
  srs: DEFAULT_SRS,
  examDefaults: { questionCount: 20, durationMinutes: null, difficulty: 'mixed' },
  demoSeeded: false,
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), srs: { ...DEFAULT_SRS, ...(s?.srs ?? {}) } };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'settings' });
}

/** Demana al navegador emmagatzematge persistent (evita que esborri les dades sota pressió d'espai). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* no suportat */
  }
  return false;
}
