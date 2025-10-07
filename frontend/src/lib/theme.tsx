import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { settingsApi } from '../services/api';

export type ThemeSetting = 'light' | 'dark' | 'auto';

type ThemeContextType = {
  theme: ThemeSetting; // user preference
  actualTheme: 'light' | 'dark'; // applied theme after resolving 'auto'
  setTheme: (t: ThemeSetting) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(setting: ThemeSetting): 'light' | 'dark' {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved: 'light' | 'dark' = setting === 'auto' ? (prefersDark ? 'dark' : 'light') : setting;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  return resolved;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeSetting>('light');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  // Initialize from localStorage, then try backend settings
  useEffect(() => {
    const init = async () => {
      const saved = (localStorage.getItem('theme') as ThemeSetting | null) || undefined;
      let initial: ThemeSetting = saved || 'auto';
      try {
        const resp = await settingsApi.getDict();
        const dict = resp.data as Record<string, string>;
        if (dict && typeof dict.theme === 'string') {
          const t = dict.theme as ThemeSetting;
          if (t === 'light' || t === 'dark' || t === 'auto') {
            initial = t;
          }
        }
      } catch {
        // ignore if offline or API not ready
      }
      setThemeState(initial);
      setActualTheme(applyTheme(initial));
    };
    init();
  }, []);

  // Listen to system theme when in auto
  useEffect(() => {
    if (!window.matchMedia) return;
    const mm = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'auto') {
        setActualTheme(applyTheme('auto'));
      }
    };
    mm.addEventListener?.('change', handler);
    return () => mm.removeEventListener?.('change', handler);
  }, [theme]);

  const setTheme = (t: ThemeSetting) => {
    setThemeState(t);
    const resolved = applyTheme(t);
    setActualTheme(resolved);
    try {
      localStorage.setItem('theme', t);
    } catch {}
    // Persist to backend asynchronously; ignore failures
    settingsApi.updateBulk({ theme: t }).catch(() => void 0);
  };

  const value = useMemo(() => ({ theme, actualTheme, setTheme }), [theme, actualTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
