'use client';

import { createContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../services/auth.service';
import { fetchActiveTheme } from '../services/theme.service';

const defaultTokens = {
  navbarBg: '#0f172a',
  headerBg: '#111827',
  footerBg: '#0f172a',
  buttonBg: '#2563eb',
  buttonText: '#ffffff',
  logoUrl: '',
};

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

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const [initialSchoolId] = useState(() => getSchoolIdSync());
  const schoolId = session?.schoolId ?? initialSchoolId ?? undefined;
  const [tokens, setTokens] = useState(defaultTokens);

  const applyTokens = (nextTokens: typeof defaultTokens) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-navbar-bg', nextTokens.navbarBg);
    root.style.setProperty('--theme-header-bg', nextTokens.headerBg);
    root.style.setProperty('--theme-footer-bg', nextTokens.footerBg);
    root.style.setProperty('--theme-button-bg', nextTokens.buttonBg);
    root.style.setProperty('--theme-button-text', nextTokens.buttonText);
  };

  useEffect(() => {
    document.documentElement.classList.add('theme-loading');
  }, []);

  // Fetch active theme in background
  const { data: activeTheme, isFetched } = useQuery({
    queryKey: ['theme-active', schoolId],
    queryFn: () => fetchActiveTheme(schoolId!),
    enabled: Boolean(schoolId),
    retry: false,
  });

  // Update tokens when API responds
  useEffect(() => {
    if (activeTheme?.tokens) {
      setTokens((prev) => {
        const nextTokens = {
          navbarBg: activeTheme.tokens.navbarBg ?? defaultTokens.navbarBg,
          headerBg: activeTheme.tokens.headerBg ?? defaultTokens.headerBg,
          footerBg: activeTheme.tokens.footerBg ?? defaultTokens.footerBg,
          buttonBg: activeTheme.tokens.buttonBg ?? defaultTokens.buttonBg,
          buttonText: activeTheme.tokens.buttonText ?? defaultTokens.buttonText,
          logoUrl: activeTheme.tokens.logoUrl ?? defaultTokens.logoUrl,
        };
        if (JSON.stringify(prev) === JSON.stringify(nextTokens)) return prev;
        applyTokens(nextTokens);
        document.documentElement.classList.remove('theme-loading');
        return nextTokens;
      });
    }
  }, [activeTheme]);

  useEffect(() => {
    if (isFetched) {
      document.documentElement.classList.remove('theme-loading');
    }
  }, [isFetched]);

  useEffect(() => {
    if (!schoolId) {
      document.documentElement.classList.remove('theme-loading');
    }
  }, [schoolId]);

  // Apply CSS variables
  useEffect(() => {
    applyTokens(tokens);
  }, [tokens]);

  return <ThemeContext.Provider value={{ logoUrl: tokens.logoUrl }}>{children}</ThemeContext.Provider>;
};
