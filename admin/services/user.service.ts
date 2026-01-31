import { api } from '../lib/api';

export type UserProfile = {
  id: string;
  email: string;
  schoolId: string | null;
  role: string | null;
  displayName: string;
  teacherProfile?: { firstName: string; lastName: string; phone: string | null; address: string | null } | null;
  parentProfiles?: Array<{ firstName: string; lastName: string; phone: string | null; email: string | null; schoolId: string }>;
  createdAt: string;
};

export const getUserById = async (id: string) => {
  const { data } = await api.get<UserProfile>(`/users/${id}`);
  return data;
};
