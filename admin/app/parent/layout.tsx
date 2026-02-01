'use client';

import { usePathname } from 'next/navigation';
import ParentPortalLayout from '../../components/ParentPortalLayout';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/parent/login') {
    return <>{children}</>;
  }
  return <ParentPortalLayout>{children}</ParentPortalLayout>;
}
