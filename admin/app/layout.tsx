import './globals.css';
import { QueryProvider } from '../components/QueryProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';

export const metadata = {
  title: 'TechStage Admin',
  description: 'TechStage IT Admin Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <QueryProvider>{children}</QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
