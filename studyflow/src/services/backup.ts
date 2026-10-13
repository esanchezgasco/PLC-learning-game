// Exportació, importació i esborrat de dades locals.
import { db } from '../db/db';

const FORMAT = 'studyflow-backup';
const VERSION = 1;

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: 'application/pdf' });
}

const TABLES = ['subjects', 'documents', 'pages', 'topics', 'sections', 'questions', 'attempts', 'reviews', 'progress', 'settings'] as const;

export async function exportData(includePdfs: boolean): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
  const pdfs: { id: string; data: string }[] = [];
  if (includePdfs) for (const b of await db.blobs.toArray()) pdfs.push({ id: b.id, data: await blobToBase64(b.data) });
  const payload = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), includesPdfs: includePdfs, tables, pdfs };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

/** Exporta només els resultats (intents) en CSV per consultar-los en un full de càlcul. */
export async function exportResultsCsv(): Promise<Blob> {
  const [attempts, topics, subjects] = await Promise.all([db.attempts.toArray(), db.topics.toArray(), db.subjects.toArray()]);
  const tName = new Map(topics.map((t) => [t.id, t.title]));
  const sName = new Map(subjects.map((s) => [s.id, s.name]));
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['data', 'assignatura', 'tema', 'tipus', 'preguntes', 'correctes', 'nota_sobre_10'].join(',')];
  for (const a of attempts.sort((x, y) => x.startedAt - y.startedAt)) {
    const correct = a.answers.filter((x) => x.grade.correct).length;
    rows.push([new Date(a.startedAt).toISOString(), sName.get(a.subjectId), tName.get(a.topicId) ?? '(tema eliminat)', a.kind, a.answers.length, correct, a.grade ?? ''].map(esc).join(','));
  }
  return new Blob([rows.join('\n')], { type: 'text/csv' });
}

export interface ImportSummary {
  subjects: number;
  documents: number;
  attempts: number;
  pdfs: number;
}

export async function importData(file: File): Promise<ImportSummary> {
  let payload: { format?: string; version?: number; tables?: Record<string, unknown[]>; pdfs?: { id: string; data: string }[] };
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('El fitxer no és un JSON vàlid.');
  }
  if (payload.format !== FORMAT || !payload.tables) throw new Error('El fitxer no és una còpia de seguretat de StudyFlow.');
  if ((payload.version ?? 0) > VERSION) throw new Error('La còpia és d’una versió més nova de StudyFlow.');
  const tables = payload.tables;
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
    for (const name of TABLES) {
      const rows = tables[name];
      if (Array.isArray(rows) && rows.length) await db.table(name).bulkPut(rows);
    }
    for (const p of payload.pdfs ?? []) await db.blobs.put({ id: p.id, data: base64ToBlob(p.data) });
  });
  return {
    subjects: tables.subjects?.length ?? 0,
    documents: tables.documents?.length ?? 0,
    attempts: tables.attempts?.length ?? 0,
    pdfs: payload.pdfs?.length ?? 0,
  };
}

export async function wipeAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

export async function storageEstimate(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  try {
    const e = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return { usage: e?.usage, quota: e?.quota, persisted };
  } catch {
    return {};
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
