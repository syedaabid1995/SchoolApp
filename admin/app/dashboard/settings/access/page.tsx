'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EMPLOYEE_MANAGED_ROLES, type EmployeeManagedRole } from '../../../../config/employee-permissions';
import { getSession } from '../../../../services/auth.service';
import { getEmployeePermissions, updateEmployeePermissions } from '../../../../services/user.service';
import { useNotify } from '../../../../components/NotificationProvider';

type ManagedRole = EmployeeManagedRole | 'SCHOOL_ADMIN';

const roleLabels: Record<ManagedRole, string> = {
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  ACCOUNTANT: 'Accountant',
  LIBRARIAN: 'Librarian',
  STAFF: 'Other Staff',
};

export default function AccessControlPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<ManagedRole>('TEACHER');
  const [editedCodes, setEditedCodes] = useState<string[]>([]);

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const canManage = session?.role === 'SCHOOL_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['employee-permissions', selectedRole, schoolId],
    queryFn: () => getEmployeePermissions(selectedRole, schoolId),
    enabled: Boolean(canManage && schoolId),
  });

  const groupedPermissions = useMemo(() => {
    const source = data?.permissions ?? [];
    return source.reduce<Record<string, typeof source>>((acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    }, {});
  }, [data]);

  useEffect(() => {
    if (!data) return;
    setEditedCodes(data.permissions.filter((permission) => permission.enabled).map((permission) => permission.code));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateEmployeePermissions({
        roleName: selectedRole,
        enabledCodes: editedCodes,
        schoolId,
      }),
    onSuccess: async () => {
      notify.success('Permissions updated');
      await queryClient.invalidateQueries({ queryKey: ['employee-permissions', selectedRole, schoolId] });
    },
    onError: (error: unknown) => {
      notify.error(error instanceof Error ? error.message : 'Failed to update permissions');
    },
  });

  const toggleCode = (code: string) => {
    setEditedCodes((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  };

  const allCodes = data?.permissions.map((permission) => permission.code) ?? [];
  const isAllSelected = allCodes.length > 0 && allCodes.every((code) => editedCodes.includes(code));

  if (!canManage) {
    return (
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h1 className="text-xl font-semibold text-ink">Access Control</h1>
        <p className="mt-2 text-sm text-slate">Permission not available for your role.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink">Access Control</h1>
        <p className="mt-1 text-sm text-slate">
          Choose a role and control which sidebar items and URLs are available.
        </p>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-slate">Role</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as ManagedRole)}
              className="rounded-lg border border-slate/20 px-3 py-2"
            >
              {(['SCHOOL_ADMIN', ...EMPLOYEE_MANAGED_ROLES] as ManagedRole[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex items-end justify-end">
            <button
              type="button"
              onClick={() => setEditedCodes(isAllSelected ? [] : allCodes)}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm font-semibold"
            >
              {isAllSelected ? 'Clear All' : 'Select All'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Employees ({roleLabels[selectedRole]})</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-slate">Loading employees...</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand text-left text-slate">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {(data?.employees ?? []).map((employee) => (
                  <tr key={employee.id} className="border-b border-slate/10">
                    <td className="px-3 py-2">{employee.displayName}</td>
                    <td className="px-3 py-2">{employee.email}</td>
                    <td className="px-3 py-2">{employee.status}</td>
                    <td className="px-3 py-2">{new Date(employee.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!data?.employees.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-slate">
                      No employees found for this role.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Sidebar + URL Permissions</h2>
        <div className="mt-4 space-y-4">
          {Object.entries(groupedPermissions).map(([group, items]) => (
            <div key={group} className="rounded-xl border border-slate/10 p-4">
              <h3 className="text-sm font-semibold text-slate">{group}</h3>
              <div className="mt-3 space-y-2">
                {items.map((permission) => {
                  const enabled = editedCodes.includes(permission.code);
                  return (
                    <div key={permission.code} className="flex items-center justify-between gap-4 rounded-lg border border-slate/10 p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{permission.label}</p>
                        <p className="text-xs text-slate">{permission.path}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCode(permission.code)}
                        className={`h-6 w-11 rounded-full p-1 transition ${
                          enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`block h-4 w-4 rounded-full bg-white shadow transition ${
                            enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !schoolId}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </section>
    </div>
  );
}
