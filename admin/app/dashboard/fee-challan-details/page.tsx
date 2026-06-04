'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function FeeChallanDetailsPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Fee Challan Details"
        subtitle="Manage bank logos, account details, branch address, and challan instructions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'System Setup' },
          { label: 'Fee Challan Details' },
        ]}
      />
      <SystemSetupTab section="fee-challan" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
