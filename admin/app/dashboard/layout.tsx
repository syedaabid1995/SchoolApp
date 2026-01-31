import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { getServerEmail, getServerRole } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getServerRole();
  const email = await getServerEmail();
  return (
    <div className="flex min-h-screen bg-sand">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col">
        <Header role={role} email={email} />
        <main className="flex-1 p-6">{children}</main>
        <footer className="theme-footer border-t border-white/10 px-6 py-3 text-xs text-white/80">
          TechStage IT • School Management Console
        </footer>
      </div>
    </div>
  );
}
