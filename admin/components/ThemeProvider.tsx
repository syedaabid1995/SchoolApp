'use client';

import { createContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../services/auth.service';
import { getActiveTheme } from '../services/theme.service';

const defaultTokens = {
  navbarBg: '#0f172a',
  headerBg: '#111827',
  footerBg: '#0f172a',
  buttonBg: '#2563eb',
  buttonText: '#ffffff',
  logoUrl: '',
};

export const ThemeContext = createContext<{ logoUrl: string }>({ logoUrl: '' });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: activeTheme } = useQuery({
    queryKey: ['theme-active', schoolId],
    queryFn: () => getActiveTheme({ schoolId }),
    enabled: Boolean(schoolId),
    retry: false,
  });

  const tokens = useMemo(() => {
    const raw = (activeTheme?.tokens ?? {}) as Record<string, string>;
    return {
      navbarBg: raw.navbarBg ?? defaultTokens.navbarBg,
      headerBg: raw.headerBg ?? defaultTokens.headerBg,
      footerBg: raw.footerBg ?? defaultTokens.footerBg,
      buttonBg: raw.buttonBg ?? defaultTokens.buttonBg,
      buttonText: raw.buttonText ?? defaultTokens.buttonText,
      logoUrl: raw.logoUrl ?? defaultTokens.logoUrl,
    };
  }, [activeTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-navbar-bg', tokens.navbarBg);
    root.style.setProperty('--theme-header-bg', tokens.headerBg);
    root.style.setProperty('--theme-footer-bg', tokens.footerBg);
    root.style.setProperty('--theme-button-bg', tokens.buttonBg);
    root.style.setProperty('--theme-button-text', tokens.buttonText);
  }, [tokens]);

  return <ThemeContext.Provider value={{ logoUrl: tokens.logoUrl }}>{children}</ThemeContext.Provider>;
};
