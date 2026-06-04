import TeacherOnboardingClient from '../../onboarding/TeacherOnboardingClient';

export default async function TeacherOnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherOnboardingClient teacherId={id} />;
}
