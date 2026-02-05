import { api } from '../lib/api';
import type { EmployeeManagedRole } from '../config/employee-permissions';

export type UserProfile = {
  id: string;
  email: string;
  schoolId: string | null;
  role: string | null;
  displayName: string;
  teacherProfile?: { firstName: string; lastName: string; phone: string | null; address: string | null } | null;
  parentProfiles?: Array<{ firstName: string; lastName: string; phone: string | null; email: string | null }>;
  createdAt: string;
};

export const getUserById = async (id: string) => {
  const { data } = await api.get<UserProfile>(`/users/${id}`);
  return data;
};

export const createSchoolUser = async (payload: {
  email: string;
  roleName: 'SCHOOL_ADMIN' | 'TEACHER' | 'ACCOUNTANT' | 'LIBRARIAN' | 'STAFF';
  firstName?: string;
  lastName?: string;
  employeeNo?: string | null;
  phone?: string | null;
  address?: string | null;
  bankDetails?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    accountType?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    panNumber?: string | null;
  };
  schoolId?: string;
}) => {
  const { data } = await api.post<{
    user: {
      id: string;
      email: string;
      schoolId: string;
      status: string;
      roleName: string;
    };
    tempPassword: string;
    whatsappSentTo?: string | null;
    manualShareRequired?: boolean;
    manualShareText?: string | null;
    manualShareUrl?: string | null;
  }>('/users/school-users', payload);
  return data;
};

export type EmployeePermissionItem = {
  code: string;
  label: string;
  path: string;
  group: string;
  enabled: boolean;
};

export type EmployeePermissionPayload = {
  roleName: EmployeeManagedRole | 'SCHOOL_ADMIN';
  employees: Array<{
    id: string;
    email: string;
    status: string;
    createdAt: string;
    displayName: string;
  }>;
  permissions: EmployeePermissionItem[];
};

export const getEmployeePermissions = async (roleName: EmployeeManagedRole | 'SCHOOL_ADMIN', schoolId?: string) => {
  const { data } = await api.get<EmployeePermissionPayload>('/users/employee-permissions', {
    params: { roleName, ...(schoolId ? { schoolId } : {}) },
  });
  return data;
};

export const updateEmployeePermissions = async (payload: {
  roleName: EmployeeManagedRole | 'SCHOOL_ADMIN';
  enabledCodes: string[];
  schoolId?: string;
}) => {
  const { data } = await api.put<{ success: boolean }>('/users/employee-permissions', payload);
  return data;
};
