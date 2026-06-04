'use client';

import PageHeader from '../../../components/PageHeader';
import SystemSetupTab from '../settings/system-setup';

export default function RolePermissionsPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Role Permissions"
        subtitle="Manage role permission shortcuts and open detailed access control."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Role Permissions' },
        ]}
      />
      <SystemSetupTab section="roles" showOverview={false} showSectionMenu={false} />
    </div>
  );
}
