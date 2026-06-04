'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function SessionsPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Sessions"
        subtitle="Manage active and historical school sessions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Sessions' },
        ]}
      />
      <SystemSetupTab section="sessions" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
