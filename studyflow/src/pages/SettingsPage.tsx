import { useEffect, useRef, useState } from 'react';
import { updateSettings } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { useAiStatus } from '../hooks/useAi';
import { DEFAULT_SRS } from '../lib/srs';
import { formatBytes } from '../lib/text';
import { download, exportData, exportResultsCsv, importData, storageEstimate, wipeAll } from '../services/backup';
import { seedDemo } from '../services/demo';
import { Alert, Badge, Button, Card, PageHeader, useConfirm, useToast } from '../components/ui';

export default function SettingsPage() {
  const settings = useSettings();
  const [refresh, setRefresh] = useState(0);
  const status = useAiStatus(refresh);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const [withPdfs, setWithPdfs] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const [intervals, setIntervals] = useState('');

  useEffect(() => {
    storageEstimate().then(setStorage);
  }, []);
  useEffect(() => setIntervals(settings.srs.intervals.join(', ')), [settings.srs.intervals]);

  const provider = status?.providers.find((p) => p.id === settings.aiProvider) ?? status?.providers.find((p) => p.configured);

  return (
    <>
      <PageHeader title="Configuració i dades" subtitle="Aparença, intel·ligència artificial opcional, repàs, còpies de seguretat i privacitat." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Aparença</h2>
          <div className="mt-3 flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <Button key={t} variant={settings.theme === t ? 'primary' : 'secondary'} onClick={() => updateSettings({ theme: t })}>
                {t === 'light' ? 'Clar' : t === 'dark' ? 'Fosc' : 'Segons el sistema'}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Intel·ligència artificial (opcional)</h2>
            {status === null ? <Badge>Comprovant…</Badge> : status.configured ? <Badge tone="green">Servidor configurat</Badge> : <Badge tone="amber">No configurada</Badge>}
          </div>
          {status && !status.reachable && (
            <div className="mt-3">
              <Alert tone="warn">No s’ha pogut contactar amb la capa de servidor d’IA. Si serveixes l’aplicació com a fitxers estàtics, la IA no està disponible.</Alert>
            </div>
          )}
          {status?.reachable && !status.configured && (
            <div className="mt-3">
              <Alert tone="info">
                No hi ha cap clau API al servidor. Per activar-la, copia <code>.env.example</code> a <code>.env</code>, defineix <code>ANTHROPIC_API_KEY</code> i reinicia l’aplicació. Totes les funcions locals (PDF, teoria extractiva, preguntes, exàmens, repàs) funcionen igualment.
              </Alert>
            </div>
          )}
          {status?.configured && (
            <div className="mt-3 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => updateSettings({ aiEnabled: e.target.checked })} /> Activa les funcions d’IA
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Proveïdor</label>
                  <select className="input" value={settings.aiProvider} onChange={(e) => updateSettings({ aiProvider: e.target.value, aiModel: '' })}>
                    {status.providers.map((p) => (
                      <option key={p.id} value={p.id} disabled={!p.configured}>
                        {p.label}
                        {p.configured ? '' : ' (no configurat)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Model</label>
                  <select className="input" value={settings.aiModel} onChange={(e) => updateSettings({ aiModel: e.target.value })}>
                    <option value="">Per defecte ({provider?.defaultModel || '—'})</option>
                    {provider?.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {status.limits && (
                <p className="text-xs text-slate-500">
                  Límits del servidor: {status.limits.ratePerMin} peticions/min, {status.limits.maxPerDay} per dia (avui {status.limits.usedToday}), màx. {status.limits.maxInputChars.toLocaleString('ca')} caràcters per petició. Cost estimat d’aquesta sessió del servidor: {status.estimatedCostUsd?.toFixed(4)} USD.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Abans de cada enviament es demana confirmació. Consentiment registrat: {settings.aiConsent ? 'sí' : 'no'}.{' '}
                {settings.aiConsent && (
                  <button className="underline" onClick={() => updateSettings({ aiConsent: false })}>
                    Revoca’l
                  </button>
                )}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setRefresh((r) => r + 1)}>
                Torna a comprovar
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Repàs espaiat</h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="srs-int">
                Intervals de les caixes (dies)
              </label>
              <input
                id="srs-int"
                className="input"
                value={intervals}
                onChange={(e) => setIntervals(e.target.value)}
                onBlur={() => {
                  const v = intervals
                    .split(',')
                    .map((x) => Number(x.trim()))
                    .filter((n) => Number.isFinite(n) && n >= 0);
                  if (v.length >= 2) updateSettings({ srs: { ...settings.srs, intervals: v } });
                  else setIntervals(settings.srs.intervals.join(', '));
                }}
              />
              <p className="mt-1 text-xs text-slate-500">Caixa 0 = preguntes fallades. Per defecte: {DEFAULT_SRS.intervals.join(', ')}.</p>
            </div>
            <div>
              <label className="label">Preguntes per sessió</label>
              <input type="number" min={5} className="input" value={settings.srs.sessionSize} onChange={(e) => updateSettings({ srs: { ...settings.srs, sessionSize: Math.max(5, Number(e.target.value) || 20) } })} />
            </div>
            <div>
              <label className="label">Tema «estudiat fa temps» (dies)</label>
              <input type="number" min={1} className="input" value={settings.srs.staleDays} onChange={(e) => updateSettings({ srs: { ...settings.srs, staleDays: Math.max(1, Number(e.target.value) || 10) } })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Llindar d’encert en preguntes obertes: {Math.round(settings.srs.openAnswerThreshold * 100)}% dels criteris</label>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                className="w-full"
                value={settings.srs.openAnswerThreshold}
                onChange={(e) => updateSettings({ srs: { ...settings.srs, openAnswerThreshold: Number(e.target.value) } })}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Examen per defecte</h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <label className="label">Preguntes per tema</label>
              <input
                type="number"
                min={1}
                className="input"
                value={settings.examDefaults.questionCount}
                onChange={(e) => updateSettings({ examDefaults: { ...settings.examDefaults, questionCount: Math.max(1, Number(e.target.value) || 20) } })}
              />
            </div>
            <div>
              <label className="label">Durada (minuts, buit = sense límit)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={settings.examDefaults.durationMinutes ?? ''}
                onChange={(e) => updateSettings({ examDefaults: { ...settings.examDefaults, durationMinutes: e.target.value ? Number(e.target.value) : null } })}
              />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Còpia de seguretat i dades</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Espai utilitzat: {storage.usage !== undefined ? formatBytes(storage.usage) : '—'}
            {storage.quota ? ` de ${formatBytes(storage.quota)} disponibles` : ''} · Emmagatzematge persistent: {storage.persisted ? 'sí' : 'no (el navegador podria esborrar-lo si li falta espai: fes còpies de seguretat)'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={async () => {
                download(await exportData(withPdfs), `studyflow-copia-${new Date().toISOString().slice(0, 10)}.json`);
                toast('Còpia exportada', 'success');
              }}
            >
              Exporta totes les dades
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withPdfs} onChange={(e) => setWithPdfs(e.target.checked)} /> Inclou els PDF
            </label>
            <Button variant="secondary" onClick={async () => download(await exportResultsCsv(), 'studyflow-resultats.csv')}>
              Exporta resultats (CSV)
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Importa una còpia…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="import-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const ok = await confirm({ title: 'Importar còpia de seguretat', message: 'Les dades actuals d’aquest navegador se substituiran per les de la còpia. Vols continuar?', confirmLabel: 'Importa', danger: true });
                if (!ok) return;
                try {
                  const r = await importData(f);
                  toast(`Importades ${r.subjects} assignatures, ${r.documents} documents i ${r.attempts} intents.`, 'success');
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Error en importar', 'error');
                }
              }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button
              variant="secondary"
              onClick={async () => {
                await seedDemo();
                toast('S’ha afegit l’assignatura de demostració', 'success');
              }}
            >
              Afegeix l’assignatura de demostració
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar totes les dades',
                  message: 'S’eliminaran totes les assignatures, PDF, temes, preguntes, intents i configuració d’aquest navegador. Fes abans una còpia de seguretat si la necessites.',
                  confirmLabel: 'Elimina-ho tot',
                  danger: true,
                  typeToConfirm: 'ELIMINAR TOT',
                });
                if (ok) {
                  await wipeAll();
                  await updateSettings({ demoSeeded: true });
                  toast('Dades eliminades', 'success');
                }
              }}
            >
              Elimina totes les dades
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Privacitat: què es desa i què s’envia</h2>
          <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <h3 className="font-medium">Es desa localment (IndexedDB d’aquest navegador)</h3>
              <ul className="mt-1 ml-5 list-disc text-slate-600 dark:text-slate-400">
                <li>Els fitxers PDF que puges i el text extret de cada pàgina.</li>
                <li>Assignatures, temes, apartats, teoria i preguntes (incloses les edicions).</li>
                <li>Intents, respostes, notes, estat del repàs i progrés.</li>
                <li>La configuració (tema, IA, repàs). No hi ha comptes d’usuari.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium">S’envia a serveis externs</h3>
              <ul className="mt-1 ml-5 list-disc text-slate-600 dark:text-slate-400">
                <li>
                  <strong>Res, per defecte.</strong> L’extracció de text i la generació local funcionen sense connexió.
                </li>
                <li>Només si actives la IA i confirmes l’enviament: el text de l’apartat (o la pregunta i la teva resposta, per a la correcció) passa pel servidor de StudyFlow cap al proveïdor configurat.</li>
                <li>OCR: el PDF no s’envia; només es descarreguen els models d’idioma de Tesseract des d’un CDN públic.</li>
                <li>Les claus API són al servidor (variables d’entorn) i mai arriben al navegador.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
