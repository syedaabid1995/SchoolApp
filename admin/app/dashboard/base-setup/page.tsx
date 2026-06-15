'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function BaseSetupPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Base Setup"
        subtitle="Manage gender, religion, blood group, and caste master data."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Base Setup' },
        ]}
      />
      <SystemSetupTab section="base" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
