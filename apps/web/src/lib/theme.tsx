'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'loyalty.theme';

/**
 * Runs before first paint (injected in <head>) so a dark-mode visitor never
 * sees a white flash. Kept as a string because it must execute inline,
 * ahead of React hydration.
 */
export const themeScript = `(function(){try{
var t=localStorage.getItem('${STORAGE_KEY}')||'system';
var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;

interface ThemeValue {
  /** What the user chose — including "system". */
  theme: Theme;
  /** What is actually on screen right now. */
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(theme: Theme): 'light' | 'dark' {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  return dark ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // Adopt whatever the inline script already decided, without re-flashing.
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system';
    setThemeState(stored);
    setResolved(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // Following the OS means following it as it changes.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(apply('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    // Brief transition class so the swap eases instead of snapping.
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setResolved(apply(next));
    window.setTimeout(() => root.classList.remove('theme-transition'), 220);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
