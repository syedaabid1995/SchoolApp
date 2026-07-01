import { api } from '../lib/api';

export type DemoRequestStatus = 'PENDING' | 'APPROVED';

export type DemoRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  schoolName: string;
  role: string | null;
  studentCount: number;
  staffCount: number;
  preferredDate: string | null;
  message: string | null;
  selectedPlanId: string | null;
  selectedPlanName: string | null;
  status: DemoRequestStatus;
  approvalTokenExpiresAt: string | null;
  approvedAt: string | null;
  emailDeliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
  selectedPlan?: { id: string; name: string } | null;
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
