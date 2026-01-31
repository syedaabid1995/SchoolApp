export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type School = {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  subscriptionPlan: string;
  lastLoginAt: string | null;
  activeUsersCount: number;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherProfile = {
  id: string;
  userId: string;
  schoolId: string;
  employeeNo: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  status: string;
  classId: string | null;
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
};
