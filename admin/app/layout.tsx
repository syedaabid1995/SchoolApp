import './globals.css';
import { QueryProvider } from '../components/QueryProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider } from '../components/ThemeProvider';
import { NotificationProvider } from '../components/NotificationProvider';

export const metadata = {
  title: 'Akademify',
  description: 'SAAPT Admin Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning />
      <body suppressHydrationWarning>
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
