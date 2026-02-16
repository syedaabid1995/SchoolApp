import { api } from '../lib/api';

const THEME_KEY_PREFIX = 'school_theme_';
const THEME_ACTIVE_PREFIX = 'theme.active.';
const THEME_ACTIVE_KEY = 'theme.active';
const THEME_ACTIVE_LAST = 'theme.active.last';
const THEME_LEGACY_LAST = 'school_theme_last';

export interface Theme {
  tokens: Record<string, string>;
}

export const listThemes = async (params?: { schoolId?: string }) => {
  const { data } = await api.get('/themes', { params });
  return data;
};

export const createTheme = async (payload: { name: string; tokens: Record<string, string>; schoolId?: string }) => {
  const { data } = await api.post('/themes', payload);
  return data;
};

export const updateTheme = async (id: string, tokens: Record<string, string>, schoolId?: string) => {
  const { data } = await api.patch(`/themes/${id}`, { tokens, schoolId });
  return data;
};

export const publishTheme = async (id: string, schoolId?: string) => {
  const { data } = await api.post(`/themes/${id}/publish`, { schoolId });
  storeTheme(schoolId, data);
  return data;
};

export const rollbackTheme = async (id: string, targetId: string, schoolId?: string) => {
  const { data } = await api.post(`/themes/${id}/rollback`, { targetId, schoolId });
  return data;
};

export const getActiveTheme = async (params?: { schoolId?: string }) => {
  const { data } = await api.get('/themes/active', { params });
  return data;
};

const parseTheme = (raw: string | null): Theme | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Theme;
  } catch {
    return null;
  }
};

// Theme Service
export const getStoredTheme = (schoolId?: string): Theme | null => {
  if (typeof window === 'undefined') return null;
  try {
    const activeTheme =
      parseTheme(localStorage.getItem(THEME_ACTIVE_KEY)) ||
      parseTheme(localStorage.getItem(THEME_ACTIVE_LAST)) ||
      parseTheme(localStorage.getItem(THEME_LEGACY_LAST));
    if (activeTheme) return activeTheme;
    if (!schoolId) return null;
    return (
      parseTheme(localStorage.getItem(`${THEME_ACTIVE_PREFIX}${schoolId}`)) ||
      parseTheme(localStorage.getItem(`${THEME_KEY_PREFIX}${schoolId}`))
    );
  } catch {
    return null;
  }
};

export const getStoredThemeLast = (): Theme | null => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      parseTheme(localStorage.getItem(THEME_ACTIVE_KEY)) ||
      parseTheme(localStorage.getItem(THEME_ACTIVE_LAST)) ||
      parseTheme(localStorage.getItem(THEME_LEGACY_LAST))
    );
  } catch {
    return null;
  }
};

export const storeTheme = (schoolId: string | undefined, theme: Theme): void => {
  if (typeof window === 'undefined') return;
  try {
    const serializedTheme = JSON.stringify(theme);
    localStorage.setItem(THEME_ACTIVE_KEY, serializedTheme);
    localStorage.setItem(THEME_ACTIVE_LAST, serializedTheme);
    // Backward compatibility
    localStorage.setItem(THEME_LEGACY_LAST, serializedTheme);
    if (schoolId) {
      localStorage.setItem(`${THEME_ACTIVE_PREFIX}${schoolId}`, serializedTheme);
      localStorage.setItem(`${THEME_KEY_PREFIX}${schoolId}`, serializedTheme);
    }
  } catch {}
};

export const clearStoredThemes = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (
        key === THEME_ACTIVE_KEY ||
        key === THEME_ACTIVE_LAST ||
        key === THEME_LEGACY_LAST ||
        key.startsWith(THEME_ACTIVE_PREFIX) ||
        key.startsWith(THEME_KEY_PREFIX)
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

export const fetchActiveTheme = async (schoolId: string): Promise<Theme | null> => {
  try {
    const theme = await getActiveTheme({ schoolId });
    if (theme) storeTheme(schoolId, theme);
    return theme;
  } catch {
    return null;
  }
};

export const applyTheme = (theme: Theme | null): void => {
  if (typeof window === 'undefined' || !theme?.tokens) return;
  const root = document.documentElement;
  Object.entries(theme.tokens).forEach(([key, value]) => {
    root.style.setProperty(`--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
  });
};
