'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EMPLOYEE_MANAGED_ROLES, type EmployeeManagedRole } from '../../../../config/employee-permissions';
import { getSession } from '../../../../services/auth.service';
import { getEmployeePermissions, updateEmployeePermissions } from '../../../../services/user.service';
import { useNotify } from '../../../../components/NotificationProvider';

// Icons as simple SVG components
const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type ManagedRole = EmployeeManagedRole | 'SCHOOL_ADMIN';

const roleLabels: Record<ManagedRole, string> = {
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  ACCOUNTANT: 'Accountant',
  LIBRARIAN: 'Librarian',
  STAFF: 'Other Staff',
};

const roleColors: Record<ManagedRole, string> = {
  SCHOOL_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  TEACHER: 'bg-blue-100 text-blue-800 border-blue-200',
  ACCOUNTANT: 'bg-green-100 text-green-800 border-green-200',
  LIBRARIAN: 'bg-orange-100 text-orange-800 border-orange-200',
  STAFF: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function AccessControlPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<ManagedRole>('TEACHER');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [editedCodes, setEditedCodes] = useState<string[]>([]);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const schoolId = session?.schoolId ?? undefined;

  const canManage = session?.role === 'SCHOOL_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['employee-permissions', selectedRole, schoolId, selectedEmployeeId],
    queryFn: () => getEmployeePermissions(selectedRole, schoolId, selectedEmployeeId || undefined),
    enabled: Boolean(canManage && schoolId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
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
        userId: selectedEmployeeId || undefined,
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl border border-red-200 bg-red-50">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldIcon />
          </div>
          <h1 className="text-xl font-semibold text-red-800 mb-2">Access Restricted</h1>
          <p className="text-red-600">You don't have permission to manage access controls.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <section className="relative overflow-hidden rounded-2xl border border-slate/10 bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <ShieldIcon />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Access Control
            </h1>
          </div>
          <p className="text-slate-600 text-lg">
            Manage role-based permissions and control access to different parts of the system.
          </p>
        </div>
      </section>

      {/* Role Selection & Controls */}
      <section className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <label className="flex flex-col gap-3">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <UsersIcon />
                Select Role to Manage
              </span>
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(event) => {
                    setSelectedRole(event.target.value as ManagedRole);
                    setSelectedEmployeeId('');
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors appearance-none cursor-pointer"
                >
                  {(EMPLOYEE_MANAGED_ROLES as ManagedRole[]).map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border w-fit ${roleColors[selectedRole]}`}>
                <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
                {roleLabels[selectedRole]}
              </div>
            </label>

            <label className="flex flex-col gap-3">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <UsersIcon />
                Select Employee (optional)
              </span>
              <div className="relative">
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors appearance-none cursor-pointer"
                >
                  <option value="">All {roleLabels[selectedRole]} (role default)</option>
                  {(data?.employees ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.displayName} · {employee.email}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {selectedEmployeeId ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 w-fit">
                  Override active for selected employee
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 w-fit">
                  Role default permissions (applies to all)
                </div>
              )}
            </label>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => setEditedCodes(isAllSelected ? [] : allCodes)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isAllSelected 
                  ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
              }`}
            >
              {isAllSelected ? (
                <span className="flex items-center gap-2">
                  <XIcon />
                  Clear All
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckIcon />
                  Select All
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Employees Section */}
      <section className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${roleColors[selectedRole].replace('text-', 'text-').replace('bg-', 'bg-').replace('border-', 'border-')}`}>
            <UsersIcon />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {roleLabels[selectedRole]} Employees
            </h2>
            <p className="text-sm text-slate-500">
              {data?.employees?.length || 0} employee{(data?.employees?.length || 0) !== 1 ? 's' : ''} with this role
            </p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-slate-600">Loading employees...</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {(data?.employees ?? []).map((employee, index) => (
                    <tr key={employee.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                            {employee.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-slate-900">{employee.displayName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{employee.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {new Date(employee.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                  {!data?.employees.length ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center text-slate-400">
                          <UsersIcon />
                          <p className="mt-2 text-sm">No employees found for this role.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Permissions Section */}
      <section className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
            <SettingsIcon />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Permission Settings</h2>
            <p className="text-sm text-slate-500">Control access to sidebar items and URL endpoints</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([group, items]) => {
            const groupEnabledCount = items.filter(item => editedCodes.includes(item.code)).length;
            const groupProgress = (groupEnabledCount / items.length) * 100;
            
            return (
              <div key={group} className="rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">{group}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">
                        {groupEnabledCount}/{items.length} enabled
                      </span>
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                          style={{ width: `${groupProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {items.map((permission) => {
                    const enabled = editedCodes.includes(permission.code);
                    return (
                      <div key={permission.code} className={`group flex items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-200 hover:shadow-sm ${
                        enabled 
                          ? 'border-green-200 bg-green-50/50' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`font-medium transition-colors ${
                              enabled ? 'text-green-800' : 'text-slate-800'
                            }`}>
                              {permission.label}
                            </p>
                            {enabled && (
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <CheckIcon />
                              </div>
                            )}
                          </div>
                          <p className={`text-xs font-mono transition-colors ${
                            enabled ? 'text-green-600' : 'text-slate-500'
                          }`}>
                            {permission.path}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCode(permission.code)}
                          className={`relative h-6 w-11 rounded-full p-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            enabled
                              ? 'bg-green-500 focus:ring-green-500'
                              : 'bg-gray-500 focus:ring-gray-500'
                          }`}
                        >
                          <span
                            className={`block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200 ${
                              enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            {editedCodes.length} of {allCodes.length} permissions enabled
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !schoolId}
            className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              saveMutation.isPending || !schoolId
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500 shadow-lg hover:shadow-xl'
            }`}
          >
            {saveMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving Changes...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckIcon />
                Save Permissions
              </span>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
