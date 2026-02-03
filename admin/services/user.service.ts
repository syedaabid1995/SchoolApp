import { api } from '../lib/api';

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
  }>('/users/school-users', payload);
  return data;
};
