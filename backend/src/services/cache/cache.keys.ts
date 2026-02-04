const sanitize = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) return 'na';
  return String(value).trim().replace(/[\s:/]+/g, '_');
};

export const buildCacheKey = (...parts: Array<string | number | boolean | null | undefined>) => {
  return parts.map((part) => sanitize(part)).join(':');
};

const normalizeForFingerprint = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => normalizeForFingerprint(item));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, [key, item]) => {
        acc[key] = normalizeForFingerprint(item);
        return acc;
      }, {});
  }
  return value;
};

export const buildQueryFingerprint = (params: Record<string, unknown>) => {
  const normalized = normalizeForFingerprint(params);
  return Buffer.from(JSON.stringify(normalized)).toString('base64url');
};

export const cacheKeys = {
  adminDashboard: (schoolId: string) => buildCacheKey('cache', 'admin_dashboard', schoolId),
  weeklyAnalytics: (schoolId: string) => buildCacheKey('cache', 'analytics', 'weekly', schoolId),
  performanceMetrics: (schoolId: string) => buildCacheKey('cache', 'analytics', 'performance', schoolId),
  marksList: (schoolId: string, queryFingerprint: string) => buildCacheKey('cache', 'marks', schoolId, 'list', queryFingerprint),
  schoolsList: (queryFingerprint: string) => buildCacheKey('cache', 'schools', 'list', queryFingerprint),
  schoolAdmins: (schoolId: string) => buildCacheKey('cache', 'schools', schoolId, 'admins'),
  teachersList: (schoolId: string, queryFingerprint: string) =>
    buildCacheKey('cache', 'teachers', schoolId, 'list', queryFingerprint),
  teacherDetail: (schoolId: string, teacherId: string) => buildCacheKey('cache', 'teachers', schoolId, 'detail', teacherId),
  studentsList: (schoolId: string, queryFingerprint: string) =>
    buildCacheKey('cache', 'students', schoolId, 'list', queryFingerprint),
  studentDetail: (schoolId: string, studentId: string) => buildCacheKey('cache', 'students', schoolId, 'detail', studentId),
  attendanceSummary: (schoolId: string, queryFingerprint: string) =>
    buildCacheKey('cache', 'attendance', schoolId, 'summary', queryFingerprint),
  notificationTemplates: () => buildCacheKey('cache', 'notifications', 'templates'),
  notificationLogs: (queryFingerprint: string) => buildCacheKey('cache', 'notifications', 'logs', queryFingerprint),
  auditLogs: (queryFingerprint: string) => buildCacheKey('cache', 'audit_logs', queryFingerprint),
  notificationSummary: (schoolId: string | null, role: string | null, userId: string) =>
    buildCacheKey('cache', 'notifications', 'summary', schoolId, role, userId),
  subscriptionPlansAll: () => buildCacheKey('cache', 'subscription_plans', 'all'),
  subscriptionPlansActive: () => buildCacheKey('cache', 'subscription_plans', 'active'),
  subscriptionMetrics: (schoolId: string) => buildCacheKey('cache', 'subscription_metrics', schoolId),
  subscriptionBySchool: (schoolId: string) => buildCacheKey('cache', 'subscription', schoolId),
  themesList: (schoolId: string) => buildCacheKey('cache', 'themes', schoolId, 'list'),
  themesActive: (schoolId: string) => buildCacheKey('cache', 'themes', schoolId, 'active'),
};
