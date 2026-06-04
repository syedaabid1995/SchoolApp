import SchoolOnboardingClient from '../../../onboarding/SchoolOnboardingClient';

export default async function SchoolOnboardingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SchoolOnboardingClient schoolId={id} reviewMode />;
}
