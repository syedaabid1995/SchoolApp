import { api } from '../lib/api';

export type HealthStatus = 'healthy' | 'warning' | 'down' | 'unknown' | 'not_implemented';

export type ServiceHealth = {
  status: HealthStatus;
  latencyMs?: number;
  provider?: string;
  uptimeSeconds?: number;
  version?: string;
  environment?: string;
  description?: string;
};

export type QueueHealth = {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
};

export type SystemHealthResponse = {
  generatedAt: string;
  overallStatus: HealthStatus;
  services: {
    api?: ServiceHealth;
    database?: ServiceHealth;
    redis?: ServiceHealth;
    queues?: ServiceHealth & {
      pendingJobs?: number;
      activeJobs?: number;
      failedJobs?: number;
      queues?: QueueHealth[];
    };
    storage?: ServiceHealth;
    email?: ServiceHealth;
    sms?: ServiceHealth;
  };
  recentErrors?: Array<{
    id: string;
    type: string;
    message: string;
    severity?: string;
    schoolId?: string | null;
    schoolName?: string | null;
    createdAt: string;
  }>;
  backup?: {
    status: HealthStatus;
    lastBackupAt?: string | null;
    lastBackupStatus?: string | null;
    failedBackupJobs?: number;
    runningBackupJobs?: number;
  };
};

type ApiEnvelope<T> = T | { success?: boolean; data: T };

const unwrapData = <T>(payload: ApiEnvelope<T>) => {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data;
  }
  return payload as T;
};

export const getSystemHealth = async () => {
  const { data } = await api.get<ApiEnvelope<SystemHealthResponse>>('/admin/system-health');
  return unwrapData(data);
};
