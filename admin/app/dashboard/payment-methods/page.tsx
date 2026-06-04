'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function PaymentMethodsPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Payment Methods"
        subtitle="Configure payment gateways and gateway credentials."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payment Methods' },
        ]}
      />
      <SystemSetupTab section="payments" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
