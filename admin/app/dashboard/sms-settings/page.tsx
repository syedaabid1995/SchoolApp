'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function SmsSettingsPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="SMS Settings"
        subtitle="Select and configure the active school SMS provider."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'SMS Settings' },
        ]}
      />
      <SystemSetupTab section="sms" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
