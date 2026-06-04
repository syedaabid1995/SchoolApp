'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function InstitutionSetupPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="General Settings"
        subtitle="Manage institution identity, contact details, session, language, currency, and address."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'System Setup' },
          { label: 'General' },
        ]}
      />
      <SystemSetupTab section="general" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
