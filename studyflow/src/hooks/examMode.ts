// Estat global "examen en curs": amaga la navegació i l'accés a la teoria.
import { useSyncExternalStore } from 'react';

let running = false;
const listeners = new Set<() => void>();

export function setExamRunning(v: boolean) {
  running = v;
  listeners.forEach((l) => l());
}

export function useExamRunning(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => running,
  );
}
