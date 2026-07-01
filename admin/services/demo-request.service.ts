import { api } from '../lib/api';

export type DemoRequestStatus = 'PENDING' | 'APPROVED';

export type DemoRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  schoolName: string;
  studentCount: number;
  staffCount: number;
  message: string | null;
  status: DemoRequestStatus;
  approvalTokenExpiresAt: string | null;
  approvedAt: string | null;
  emailDeliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
  approvedBy?: { id: string; email: string } | null;
};

export const listDemoRequests = async (params?: { status?: DemoRequestStatus | ''; search?: string }) => {
  const { data } = await api.get<{ items: DemoRequest[] }>('/admin/demo-requests', {
    params: Object.fromEntries(Object.entries(params ?? {}).filter(([, value]) => value)),
  });
  return data.items;
};

export const approveDemoRequest = async (id: string) => {
  const { data } = await api.post<DemoRequest>(`/admin/demo-requests/${id}/approve`);
  return data;
};
