import type { SchoolOnboardingStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

type ChecklistStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'BLOCKED';

type Actor = {
  userId: string;
  role?: string | null;
  schoolId?: string | null;
};

type ChecklistDefinition = {
  key: string;
  label: string;
  required: boolean;
  auto: (schoolId: string) => Promise<boolean>;
};

const count = async (delegate: { count: (args: any) => Promise<number> }, schoolId: string, extra: Record<string, unknown> = {}) =>
  delegate.count({ where: { schoolId, ...extra } });

export const SCHOOL_ONBOARDING_ITEMS: ChecklistDefinition[] = [
  {
    key: 'institute_profile_completed',
    label: 'Institute profile completed',
    required: true,
    auto: async (schoolId) => {
      const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, code: true } });
      return Boolean(school?.name && school.code);
    },
  },
  { key: 'academic_year_created', label: 'Academic year/session created', required: true, auto: (schoolId) => count(prisma.academicYear, schoolId).then(Boolean) },
  { key: 'classes_created', label: 'Classes created', required: true, auto: (schoolId) => count(prisma.class, schoolId).then(Boolean) },
  { key: 'sections_created', label: 'Sections created', required: true, auto: (schoolId) => count(prisma.section, schoolId).then(Boolean) },
  { key: 'subjects_created', label: 'Subjects created', required: true, auto: (schoolId) => count(prisma.subject, schoolId).then(Boolean) },
  { key: 'teachers_added', label: 'Teachers added', required: true, auto: (schoolId) => count(prisma.teacherProfile, schoolId, { isActive: true }).then(Boolean) },
  { key: 'class_teachers_assigned', label: 'Class teachers assigned', required: true, auto: (schoolId) => count(prisma.classTeacher, schoolId).then(Boolean) },
  { key: 'teacher_subject_assignments_completed', label: 'Teacher-subject assignments completed', required: true, auto: (schoolId) => count(prisma.assignSubject, schoolId).then(Boolean) },
  { key: 'attendance_mode_configured', label: 'Attendance mode configured', required: true, auto: (schoolId) => count(prisma.attendancePeriod, schoolId).then(Boolean) },
  { key: 'timetable_rooms_configured', label: 'Timetable rooms configured', required: true, auto: (schoolId) => count(prisma.classRoom, schoolId).then(Boolean) },
  { key: 'time_periods_configured', label: 'Time periods configured', required: true, auto: (schoolId) => count(prisma.timePeriod, schoolId).then(Boolean) },
  { key: 'messaging_configured_or_manual', label: 'Messaging/email/SMS configured or manual mode accepted', required: true, auto: (schoolId) => count(prisma.schoolMessagingConfig, schoolId, { isEnabled: true }).then(Boolean) },
  {
    key: 'first_admin_password_changed',
    label: 'First school admin password changed',
    required: true,
    auto: async (schoolId) => {
      const admin = await prisma.user.findFirst({
        where: { schoolId, roles: { some: { role: { name: 'SCHOOL_ADMIN' } } } },
        orderBy: { createdAt: 'asc' },
        select: { mustChangePassword: true },
      });
      return Boolean(admin && !admin.mustChangePassword);
    },
  },
  { key: 'student_import_or_admission_started', label: 'Student import/admission started or skipped', required: true, auto: (schoolId) => count(prisma.student, schoolId).then(Boolean) },
  {
    key: 'parent_portal_configured_or_skipped',
    label: 'Parent portal configured or skipped',
    required: false,
    auto: async (schoolId) => prisma.studentParent.count({ where: { student: { schoolId } } }).then(Boolean),
  },
];

const ensureSchool = async (schoolId: string) => {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, code: true, onboardingStatus: true },
  });
  if (!school) throw new HttpError(404, 'School not found');
  return school;
};

const ensureAccess = (schoolId: string, actor: Actor, review = false) => {
  if (actor.role === 'SUPER_ADMIN') return;
  if (review) throw new HttpError(403, 'Super Admin review permission required');
  if (actor.role !== 'SCHOOL_ADMIN' || actor.schoolId !== schoolId) throw new HttpError(403, 'Tenant scope violation');
};

const summarize = (items: Array<{ status: string; required: boolean }>) => {
  const total = items.length;
  const completed = items.filter((item) => item.status === 'COMPLETED' || item.status === 'SKIPPED').length;
  const requiredIncomplete = items.filter((item) => item.required && !['COMPLETED', 'SKIPPED'].includes(item.status)).length;
  return { total, completed, pending: total - completed, requiredIncomplete, percent: total ? Math.round((completed / total) * 100) : 0 };
};

export const recalculateSchoolOnboarding = async (schoolId: string, actor: Actor) => {
  ensureAccess(schoolId, actor);
  const school = await ensureSchool(schoolId);
  const existing = await prisma.schoolOnboardingChecklist.findMany({ where: { schoolId } });
  const existingByKey = new Map(existing.map((item) => [item.key, item]));
  const now = new Date();

  const rows = [];
  for (const definition of SCHOOL_ONBOARDING_ITEMS) {
    const previous = existingByKey.get(definition.key);
    const autoCompleted = await definition.auto(schoolId);
    const preserveManual = previous && ['SKIPPED', 'BLOCKED'].includes(previous.status);
    const status: ChecklistStatus = preserveManual ? previous.status as ChecklistStatus : autoCompleted ? 'COMPLETED' : 'PENDING';

    const row = await prisma.schoolOnboardingChecklist.upsert({
      where: { schoolId_key: { schoolId, key: definition.key } },
      create: {
        schoolId,
        key: definition.key,
        label: definition.label,
        required: definition.required,
        status,
        completedAt: status === 'COMPLETED' ? now : null,
        completedById: status === 'COMPLETED' ? actor.userId : null,
      },
      update: {
        label: definition.label,
        required: definition.required,
        status,
        completedAt: status === 'COMPLETED' ? previous?.completedAt ?? now : status === 'SKIPPED' ? previous?.completedAt ?? now : null,
        completedById: status === 'COMPLETED' || status === 'SKIPPED' ? previous?.completedById ?? actor.userId : null,
      },
    });
    rows.push(row);
  }

  const summary = summarize(rows);
  const nextStatus: SchoolOnboardingStatus =
    school.onboardingStatus === 'ACTIVE' || school.onboardingStatus === 'BLOCKED'
      ? school.onboardingStatus
      : summary.requiredIncomplete === 0
        ? 'READY_FOR_REVIEW'
        : summary.completed > 0
          ? 'SETUP_IN_PROGRESS'
          : 'DRAFT';

  const updatedSchool = await prisma.school.update({
    where: { id: schoolId },
    data: { onboardingStatus: nextStatus },
    select: { id: true, name: true, code: true, onboardingStatus: true },
  });

  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'SchoolOnboarding',
    entityId: schoolId,
    action: 'SCHOOL_ONBOARDING_RECALCULATED',
    beforeState: { onboardingStatus: school.onboardingStatus },
    afterState: { onboardingStatus: updatedSchool.onboardingStatus, summary },
  });

  return { school: updatedSchool, checklist: rows, summary };
};

export const getSchoolOnboarding = async (schoolId: string, actor: Actor) => {
  ensureAccess(schoolId, actor);
  await ensureSchool(schoolId);
  const existing = await prisma.schoolOnboardingChecklist.findMany({ where: { schoolId }, orderBy: { createdAt: 'asc' } });
  if (existing.length < SCHOOL_ONBOARDING_ITEMS.length) return recalculateSchoolOnboarding(schoolId, actor);
  const school = await ensureSchool(schoolId);
  return { school, checklist: existing, summary: summarize(existing) };
};

export const updateSchoolOnboardingChecklist = async (
  schoolId: string,
  key: string,
  payload: { status: ChecklistStatus; note?: string | null },
  actor: Actor,
) => {
  ensureAccess(schoolId, actor);
  const definition = SCHOOL_ONBOARDING_ITEMS.find((item) => item.key === key);
  if (!definition) throw new HttpError(404, 'Checklist item not found');
  if (!['COMPLETED', 'SKIPPED', 'BLOCKED', 'PENDING'].includes(payload.status)) throw new HttpError(400, 'Invalid checklist status');
  if (payload.status === 'SKIPPED' && definition.required && !payload.note?.trim()) throw new HttpError(400, 'Skip reason is required');
  if (payload.status === 'BLOCKED' && !payload.note?.trim()) throw new HttpError(400, 'Block reason is required');

  const previous = await prisma.schoolOnboardingChecklist.findUnique({ where: { schoolId_key: { schoolId, key } } });
  const completed = ['COMPLETED', 'SKIPPED'].includes(payload.status);
  const updated = await prisma.schoolOnboardingChecklist.upsert({
    where: { schoolId_key: { schoolId, key } },
    create: {
      schoolId,
      key,
      label: definition.label,
      required: definition.required,
      status: payload.status,
      note: payload.note ?? null,
      completedAt: completed ? new Date() : null,
      completedById: completed ? actor.userId : null,
    },
    update: {
      status: payload.status,
      note: payload.note ?? null,
      completedAt: completed ? new Date() : null,
      completedById: completed ? actor.userId : null,
    },
  });

  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'SchoolOnboardingChecklist',
    entityId: updated.id,
    action: 'SCHOOL_ONBOARDING_CHECKLIST_UPDATED',
    beforeState: previous ? { status: previous.status, note: previous.note } : null,
    afterState: { key, status: updated.status, note: updated.note },
  });

  return getSchoolOnboarding(schoolId, actor);
};

export const requestSchoolOnboardingReview = async (schoolId: string, actor: Actor) => {
  const current = await recalculateSchoolOnboarding(schoolId, actor);
  if (current.summary.requiredIncomplete > 0) throw new HttpError(409, 'Required checklist items are incomplete');
  const school = await prisma.school.update({ where: { id: schoolId }, data: { onboardingStatus: 'READY_FOR_REVIEW' }, select: { id: true, name: true, code: true, onboardingStatus: true } });
  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'SchoolOnboarding',
    entityId: schoolId,
    action: 'SCHOOL_ONBOARDING_REVIEW_REQUESTED',
    afterState: { onboardingStatus: school.onboardingStatus },
  });
  return getSchoolOnboarding(schoolId, actor);
};

export const activateSchoolOnboarding = async (schoolId: string, actor: Actor, reason?: string | null, override = false) => {
  ensureAccess(schoolId, actor, true);
  const current = await recalculateSchoolOnboarding(schoolId, actor);
  if (current.summary.requiredIncomplete > 0 && (!override || !reason?.trim())) {
    throw new HttpError(409, 'Required incomplete items block go-live unless override reason is provided');
  }
  const school = await prisma.school.update({ where: { id: schoolId }, data: { onboardingStatus: 'ACTIVE' }, select: { id: true, name: true, code: true, onboardingStatus: true } });
  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'SchoolOnboarding',
    entityId: schoolId,
    action: override ? 'SCHOOL_ONBOARDING_GO_LIVE_OVERRIDDEN' : 'SCHOOL_ONBOARDING_GO_LIVE_APPROVED',
    beforeState: { onboardingStatus: current.school.onboardingStatus },
    afterState: { onboardingStatus: school.onboardingStatus, reason: reason ?? null },
  });
  return getSchoolOnboarding(schoolId, actor);
};

export const blockSchoolOnboarding = async (schoolId: string, actor: Actor, reason: string) => {
  ensureAccess(schoolId, actor, true);
  if (!reason.trim()) throw new HttpError(400, 'Block reason is required');
  const previous = await ensureSchool(schoolId);
  const school = await prisma.school.update({ where: { id: schoolId }, data: { onboardingStatus: 'BLOCKED', statusReason: reason }, select: { id: true, name: true, code: true, onboardingStatus: true } });
  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'SchoolOnboarding',
    entityId: schoolId,
    action: 'SCHOOL_ONBOARDING_BLOCKED',
    beforeState: { onboardingStatus: previous.onboardingStatus },
    afterState: { onboardingStatus: school.onboardingStatus, reason },
  });
  return getSchoolOnboarding(schoolId, actor);
};
