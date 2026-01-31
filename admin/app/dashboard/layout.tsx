import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { getServerRole } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getServerRole();
  return (
    <div className="flex min-h-screen bg-sand">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col">
        <Header role={role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
