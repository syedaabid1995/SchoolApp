import { api } from '../lib/api';

const THEME_KEY_PREFIX = 'school_theme_';
const THEME_ACTIVE_PREFIX = 'theme.active.';
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
  if (schoolId) storeTheme(schoolId, data);
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

// Theme Service
export const getStoredTheme = (schoolId: string): Theme | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored =
      localStorage.getItem(`${THEME_ACTIVE_PREFIX}${schoolId}`) ||
      localStorage.getItem(`${THEME_KEY_PREFIX}${schoolId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const getStoredThemeLast = (): Theme | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_ACTIVE_LAST) || localStorage.getItem(THEME_LEGACY_LAST);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const storeTheme = (schoolId: string, theme: Theme): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${THEME_ACTIVE_PREFIX}${schoolId}`, JSON.stringify(theme));
    localStorage.setItem(THEME_ACTIVE_LAST, JSON.stringify(theme));
    // Backward compatibility
    localStorage.setItem(`${THEME_KEY_PREFIX}${schoolId}`, JSON.stringify(theme));
    localStorage.setItem(THEME_LEGACY_LAST, JSON.stringify(theme));
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
