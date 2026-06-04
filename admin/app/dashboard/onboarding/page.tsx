'use client';

import { useEffect, useState } from 'react';
import FullPageLoader from '../../../components/FullPageLoader';
import { getSession } from '../../../services/auth.service';
import SchoolOnboardingClient from './SchoolOnboardingClient';

export default function OnboardingPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((session) => setSchoolId(session.schoolId ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader label="Checking onboarding access..." />;
  if (!schoolId) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-700">School context is required for onboarding.</div>;
  return <SchoolOnboardingClient schoolId={schoolId} />;
}
