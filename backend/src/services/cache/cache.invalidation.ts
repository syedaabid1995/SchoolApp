import { deleteCacheByPattern, deleteCacheKeys } from './cache.service';
import { cacheKeys } from './cache.keys';

export const invalidateAdminDashboardCache = async (schoolId?: string | null) => {
  if (schoolId) {
    await deleteCacheKeys([cacheKeys.adminDashboard(schoolId), cacheKeys.weeklyAnalytics(schoolId), cacheKeys.performanceMetrics(schoolId)]);
    await deleteCacheByPattern(`cache:attendance:${schoolId}:summary:*`);
    await deleteCacheByPattern(`cache:marks:${schoolId}:*`);
    return;
  }
  await deleteCacheByPattern('cache:admin_dashboard:*');
  await deleteCacheByPattern('cache:analytics:*');
  await deleteCacheByPattern('cache:attendance:*:summary:*');
  await deleteCacheByPattern('cache:marks:*');
};

export const invalidateSchoolCache = async (schoolId?: string | null) => {
  await deleteCacheByPattern('cache:schools:list:*');
  if (schoolId) {
    await deleteCacheKeys([cacheKeys.schoolAdmins(schoolId)]);
    await invalidateAdminDashboardCache(schoolId);
    await deleteCacheKeys([cacheKeys.subscriptionBySchool(schoolId), cacheKeys.subscriptionMetrics(schoolId)]);
    await deleteCacheByPattern(`cache:notifications:summary:${schoolId}:*`);
  }
};

export const invalidateTeacherCache = async (schoolId: string, teacherId?: string) => {
  await deleteCacheByPattern(`cache:teachers:${schoolId}:list:*`);
  if (teacherId) {
    await deleteCacheKeys([cacheKeys.teacherDetail(schoolId, teacherId)]);
  } else {
    await deleteCacheByPattern(`cache:teachers:${schoolId}:detail:*`);
  }
  await invalidateAdminDashboardCache(schoolId);
};

export const invalidateStudentCache = async (schoolId: string, studentId?: string) => {
  await deleteCacheByPattern(`cache:students:${schoolId}:list:*`);
  if (studentId) {
    await deleteCacheKeys([cacheKeys.studentDetail(schoolId, studentId)]);
  } else {
    await deleteCacheByPattern(`cache:students:${schoolId}:detail:*`);
  }
  await invalidateAdminDashboardCache(schoolId);
};

export const invalidateAttendanceCache = async (schoolId: string) => {
  await deleteCacheByPattern(`cache:attendance:${schoolId}:summary:*`);
  await invalidateAdminDashboardCache(schoolId);
};

export const invalidateNotificationCache = async (schoolId?: string | null) => {
  await deleteCacheKeys([cacheKeys.notificationTemplates()]);
  if (schoolId) {
    await deleteCacheByPattern('cache:notifications:logs:*');
    await deleteCacheByPattern(`cache:notifications:summary:${schoolId}:*`);
    return;
  }
  await deleteCacheByPattern('cache:notifications:*');
};

export const invalidateSubscriptionCache = async (schoolId?: string | null) => {
  await deleteCacheKeys([cacheKeys.subscriptionPlansAll(), cacheKeys.subscriptionPlansActive()]);
  await deleteCacheByPattern('cache:subscription_metrics:*');
  if (schoolId) {
    await deleteCacheKeys([cacheKeys.subscriptionBySchool(schoolId), cacheKeys.subscriptionMetrics(schoolId)]);
    await deleteCacheByPattern(`cache:notifications:summary:${schoolId}:*`);
    await deleteCacheByPattern('cache:schools:list:*');
  }
};

export const invalidateThemeCache = async (schoolId: string) => {
  await deleteCacheKeys([cacheKeys.themesList(schoolId), cacheKeys.themesActive(schoolId)]);
};
