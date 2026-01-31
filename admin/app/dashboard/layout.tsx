import { getServerEmail, getServerRole } from '../../lib/auth';
import DashboardClientLayout from '../../components/DashboardClientLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getServerRole();
  const email = await getServerEmail();
  
  return (
    <DashboardClientLayout role={role} email={email}>
      {children}
    </DashboardClientLayout>
  );
}
