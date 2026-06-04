'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function HolidaysPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Holidays"
        subtitle="Manage school holidays and calendar exceptions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Holidays' },
        ]}
      />
      <SystemSetupTab section="holidays" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
