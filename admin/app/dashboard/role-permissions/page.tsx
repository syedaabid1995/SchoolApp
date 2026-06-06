'use client';

import PageHeader from '../../../components/PageHeader';
import AccessControlPage from '../settings/access/page';

export default function RolePermissionsPage() {
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Role Permissions"
        subtitle="Manage school role and employee permissions. Subscription plan modules remain the hard access limit."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Role Permissions' },
        ]}
      />
      <AccessControlPage />
    </div>
  );
}
