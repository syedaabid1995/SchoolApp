import { api } from '../lib/api';

export type SubscriptionMetrics = {
  plan: {
    name: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    studentLimit: number;
    teacherLimit: number;
  } | null;
  usage: {
    students: number;
    teachers: number;
  };
  overLimit: {
    students: boolean;
    teachers: boolean;
  };
};

export const getSubscriptionMetrics = async (schoolId: string) => {
  const { data } = await api.get<SubscriptionMetrics>(`/admin/subscription-metrics/${schoolId}`);
  return data;
};
