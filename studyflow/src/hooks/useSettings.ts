import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { DEFAULT_SETTINGS, getSettings } from '../db/db';
import type { Settings } from '../types';

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS);
}

/** Aplica el tema (clar/fosc/sistema) al document */
export function useApplyTheme(theme: Settings['theme']) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem('sf-theme', theme === 'system' ? '' : theme);
      } catch {
        /* sense emmagatzematge */
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
