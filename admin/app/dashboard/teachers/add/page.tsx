'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FullPageLoader from '../../../../components/FullPageLoader';

export default function AddTeacherPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/staff/add?type=teacher');
  }, [router]);

  return <FullPageLoader label="Opening employee setup..." />;
}
