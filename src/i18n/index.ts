import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type Lang, type TKey } from './translations';

let _lang: Lang = 'sr';
const listeners: Set<() => void> = new Set();

export async function initLang() {
  try {
    const stored = await AsyncStorage.getItem('hando_lang');
    if (stored === 'en' || stored === 'sr') _lang = stored;
  } catch {}
}

export function getLang(): Lang { return _lang; }

export async function setLang(l: Lang) {
  _lang = l;
  await AsyncStorage.setItem('hando_lang', l);
  listeners.forEach(fn => fn());
}

export function t(key: TKey): string {
  return translations[key]?.[_lang] ?? String(key);
}

export function useLanguage() {
  const [, rerender] = useState(0);
  const subscribe = useCallback(() => {
    const fn = () => rerender(n => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  // Subscribe on mount
  useState(() => { return subscribe(); });

  return {
    t: (key: TKey) => translations[key]?.[_lang] ?? String(key),
    lang: _lang,
    setLang,
  };
}
