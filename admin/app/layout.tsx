import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { QueryProvider } from '../components/QueryProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider } from '../components/ThemeProvider';
import { NotificationProvider } from '../components/NotificationProvider';
import { PlatformBrandEffect } from '../components/PlatformBrandEffect';
import { getPlatformBrandForHost } from '../lib/platform-brand';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const brand = getPlatformBrandForHost(
    requestHeaders.get('x-forwarded-host') ??
      requestHeaders.get('host'),
  );

  return {
    title: brand.title,
    description: brand.description,
    applicationName: brand.appName,
    appleWebApp: {
      title: brand.appName,
    },
    icons: {
      icon: brand.faviconUrl,
      shortcut: brand.faviconUrl,
      apple: brand.faviconUrl,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning />
      <body suppressHydrationWarning>
        <PlatformBrandEffect />
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
