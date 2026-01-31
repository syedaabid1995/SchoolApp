import './globals.css';
import { QueryProvider } from '../components/QueryProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider } from '../components/ThemeProvider';

export const metadata = {
  title: 'TechStage Admin',
  description: 'TechStage IT Admin Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
