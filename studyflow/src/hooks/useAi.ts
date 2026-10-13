import { createElement, useEffect, useState } from 'react';
import { updateSettings } from '../db/db';
import { fetchAiStatus, type AiStatus } from '../services/ai';
import { useConfirm } from '../components/ui';
import { useSettings } from './useSettings';

let cached: Promise<AiStatus> | null = null;
export function useAiStatus(refreshKey = 0): AiStatus | null {
  const [s, setS] = useState<AiStatus | null>(null);
  useEffect(() => {
    if (refreshKey || !cached) cached = fetchAiStatus();
    cached.then(setS);
  }, [refreshKey]);
  return s;
}

/**
 * Retorna si la IA es pot fer servir i una funció que demana confirmació explícita
 * abans d'enviar contingut del document a un servei extern.
 */
export function useAiGate() {
  const settings = useSettings();
  const status = useAiStatus();
  const confirm = useConfirm();
  const available = !!status?.configured && settings.aiEnabled;
  const ensureConsent = async (what: string): Promise<boolean> => {
    if (!available) return false;
    const ok = await confirm({
      title: 'Enviar contingut a un servei d’IA extern',
      message: createElement(
        'div',
        { className: 'space-y-2' },
        createElement('p', null, `Per ${what}, s’enviarà el text extret d’aquest apartat al proveïdor d’IA configurat al servidor (${settings.aiProvider}${settings.aiModel ? `, model ${settings.aiModel}` : ''}).`),
        createElement('p', null, 'No s’envia el fitxer PDF complet ni cap altra dada. El proveïdor pot aplicar les seves pròpies polítiques de retenció de dades.'),
        createElement('p', null, 'El resultat es marcarà com a generat per IA i se’n verificaran les cites contra el document.'),
      ),
      confirmLabel: 'Envia',
    });
    if (ok && !settings.aiConsent) await updateSettings({ aiConsent: true });
    return ok;
  };
  return { available, status, ensureConsent };
}
