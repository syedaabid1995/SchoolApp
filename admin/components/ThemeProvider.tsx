'use client';

import { createContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../services/auth.service';
import { fetchActiveTheme, getStoredTheme, getStoredThemeLast } from '../services/theme.service';

const defaultTokens = {
  navbarBg: '#0f172a',
  headerBg: '#111827',
  footerBg: '#0f172a',
  buttonBg: '#2563eb',
  buttonText: '#ffffff',
  logoUrl: '',
};

type ThemeTokens = typeof defaultTokens;
const THEME_TOKEN_KEYS = Object.keys(defaultTokens) as Array<keyof ThemeTokens>;

export const ThemeContext = createContext<{ logoUrl: string }>({ logoUrl: '' });

const getSchoolIdSync = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )access_token=([^;]+)/);
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { schoolId?: string | null };
    return payload?.schoolId ?? null;
  } catch {
    return null;
  }
};

const toTokens = (theme: { tokens?: Record<string, string> } | null | undefined) => {
  if (!theme?.tokens) return null;
  return {
    navbarBg: theme.tokens.navbarBg ?? defaultTokens.navbarBg,
    headerBg: theme.tokens.headerBg ?? defaultTokens.headerBg,
    footerBg: theme.tokens.footerBg ?? defaultTokens.footerBg,
    buttonBg: theme.tokens.buttonBg ?? defaultTokens.buttonBg,
    buttonText: theme.tokens.buttonText ?? defaultTokens.buttonText,
    logoUrl: theme.tokens.logoUrl ?? defaultTokens.logoUrl,
  };
};

const readCachedTokens = (schoolId?: string | null): ThemeTokens | null =>
  toTokens(getStoredTheme(schoolId ?? undefined) || getStoredThemeLast());

const areTokensEqual = (left: ThemeTokens, right: ThemeTokens) =>
  THEME_TOKEN_KEYS.every((key) => left[key] === right[key]);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const [initialSchoolId] = useState(() => getSchoolIdSync());
  const [isHydrated, setIsHydrated] = useState(false);
  const schoolId = session?.schoolId ?? initialSchoolId ?? undefined;
  const hasCachedTheme = useMemo(() => Boolean(readCachedTokens(schoolId ?? initialSchoolId)), [schoolId, initialSchoolId]);
  const [tokens, setTokens] = useState<ThemeTokens>(() => readCachedTokens(initialSchoolId) ?? defaultTokens);

  const applyTokens = (nextTokens: ThemeTokens) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-navbar-bg', nextTokens.navbarBg);
    root.style.setProperty('--theme-header-bg', nextTokens.headerBg);
    root.style.setProperty('--theme-footer-bg', nextTokens.footerBg);
    root.style.setProperty('--theme-button-bg', nextTokens.buttonBg);
    root.style.setProperty('--theme-button-text', nextTokens.buttonText);
  };

  // Hydrate from cache immediately and re-check when school context becomes available.
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Hydrate from cache immediately and re-check when school context becomes available.
  useEffect(() => {
    const cachedTokens = readCachedTokens(schoolId ?? initialSchoolId);
    if (!cachedTokens) return;
    setTokens((prev) => (areTokensEqual(prev, cachedTokens) ? prev : cachedTokens));
  }, [schoolId, initialSchoolId]);

  // Revalidate with API in the background once schoolId is known.
  const { data: activeTheme, isPending } = useQuery({
    queryKey: ['theme-active', schoolId],
    queryFn: () => fetchActiveTheme(schoolId!),
    enabled: Boolean(schoolId),
    retry: false,
  });

  // API stores into localStorage. Re-read cache and update UI if changed.
  useEffect(() => {
    if (!activeTheme) return;
    const nextTokens = readCachedTokens(schoolId ?? initialSchoolId) ?? toTokens(activeTheme);
    if (!nextTokens) return;
    setTokens((prev) => (areTokensEqual(prev, nextTokens) ? prev : nextTokens));
  }, [activeTheme, schoolId, initialSchoolId]);

  useEffect(() => {
    if (!schoolId) {
      document.documentElement.classList.remove('theme-loading');
      return;
    }
    if (!hasCachedTheme && isPending) {
      document.documentElement.classList.add('theme-loading');
      return;
    }
    document.documentElement.classList.remove('theme-loading');
  }, [schoolId, hasCachedTheme, isPending]);

  // Apply CSS vars before paint when token state changes.
  useLayoutEffect(() => {
    applyTokens(tokens);
  }, [tokens]);

  return <ThemeContext.Provider value={{ logoUrl: isHydrated ? tokens.logoUrl : '' }}>{children}</ThemeContext.Provider>;
};
