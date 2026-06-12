import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';
import { sendAccountCreatedWhatsapp } from './accountOnboardingWhatsapp.service';
import { timetableReadService } from '../modules/timetable/services/timetable-read.service';

type Actor = {
  userId: string;
  role?: string | null;
  schoolId?: string | null;
};

type TeacherReadinessFlags = {
  accountCreated: boolean;
  firstLoginCompleted: boolean;
  passwordChanged: boolean;
  profileCompleted: boolean;
  active: boolean;
  classAssigned: boolean;
  subjectAssigned: boolean;
  timetableAssigned: boolean;
  attendanceEnabled: boolean;
};

const ensureAccess = (schoolId: string, actor: Actor) => {
  if (actor.role === 'SUPER_ADMIN') return;
  if (actor.role !== 'SCHOOL_ADMIN' || actor.schoolId !== schoolId) throw new HttpError(403, 'Tenant scope violation');
};

const readinessStatus = (flags: TeacherReadinessFlags & { manualShareConfirmed: boolean }) => {
  const credentialsReady = flags.passwordChanged || flags.manualShareConfirmed;
  const assigned = flags.classAssigned || flags.subjectAssigned;
  const ready =
    flags.accountCreated &&
    flags.profileCompleted &&
    flags.active &&
    credentialsReady &&
    assigned &&
    flags.timetableAssigned &&
    flags.attendanceEnabled;
  return ready ? 'READY' : 'PENDING';
};

const teacherSelect = {
  id: true,
  schoolId: true,
  userId: true,
  firstName: true,
  lastName: true,
  employeeNo: true,
  phone: true,
  address: true,
  isActive: true,
  user: { select: { id: true, email: true, status: true, mustChangePassword: true } },
};

export const getTeacherForOnboarding = async (schoolId: string, teacherId: string) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId, OR: [{ id: teacherId }, { userId: teacherId }] },
    select: teacherSelect,
  });
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  return teacher;
};

const calculateFlags = async (schoolId: string, teacherId: string): Promise<TeacherReadinessFlags> => {
  const teacher = await getTeacherForOnboarding(schoolId, teacherId);
  const [classAssignments, subjectAssignments, timetable, selfAttendance] = await Promise.all([
    prisma.teacherClassAssignment.count({ where: { teacherId: teacher.id } }),
    prisma.teacherSubjectAssignment.count({ where: { teacherId: teacher.id } }),
    timetableReadService.getTeacherTimetable({ schoolId, teacherId: teacher.id }),
    prisma.teacherSelfAttendance.count({ where: { schoolId, teacherId: teacher.id } }),
  ]);

  const profileCompleted = Boolean(teacher.firstName && teacher.lastName && (teacher.phone || teacher.employeeNo));
  const timetableAssigned = timetable.slots.length > 0;
  const classAssigned = classAssignments > 0;
  const subjectAssigned = subjectAssignments > 0;

  return {
    accountCreated: Boolean(teacher.userId && teacher.user),
    firstLoginCompleted: !teacher.user.mustChangePassword,
    passwordChanged: !teacher.user.mustChangePassword,
    profileCompleted,
    active: teacher.isActive && teacher.user.status === 'ACTIVE',
    classAssigned,
    subjectAssigned,
    timetableAssigned,
    attendanceEnabled: selfAttendance > 0 || classAssigned,
  };
};

const mapOnboarding = (teacher: Awaited<ReturnType<typeof getTeacherForOnboarding>>, onboarding: any) => ({
  id: onboarding.id,
  schoolId: onboarding.schoolId,
  teacherId: onboarding.teacherId,
  teacher: {
    id: teacher.id,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    employeeNo: teacher.employeeNo,
    phone: teacher.phone,
    email: teacher.user.email,
    isActive: teacher.isActive,
  },
  accountCreated: onboarding.accountCreated,
  temporaryPasswordShared: onboarding.temporaryPasswordShared,
  manualShareConfirmed: onboarding.manualShareConfirmed,
  firstLoginCompleted: onboarding.firstLoginCompleted,
  passwordChanged: onboarding.passwordChanged,
  profileCompleted: onboarding.profileCompleted,
  active: onboarding.active,
  classAssigned: onboarding.classAssigned,
  subjectAssigned: onboarding.subjectAssigned,
  timetableAssigned: onboarding.timetableAssigned,
  attendanceEnabled: onboarding.attendanceEnabled,
  readinessStatus: onboarding.readinessStatus,
  note: onboarding.note,
  createdAt: onboarding.createdAt,
  updatedAt: onboarding.updatedAt,
});

export const recalculateTeacherOnboarding = async (schoolId: string, teacherId: string, actor: Actor) => {
  ensureAccess(schoolId, actor);
  const teacher = await getTeacherForOnboarding(schoolId, teacherId);
  const previous = await prisma.teacherOnboarding.findUnique({ where: { teacherId: teacher.id } });
  const flags = await calculateFlags(schoolId, teacher.id);
  const manualShareConfirmed = previous?.manualShareConfirmed ?? false;
  const temporaryPasswordShared = previous?.temporaryPasswordShared ?? manualShareConfirmed;
  const nextStatus = readinessStatus({ ...flags, manualShareConfirmed });

  const onboarding = await prisma.teacherOnboarding.upsert({
    where: { teacherId: teacher.id },
    create: {
      schoolId,
      teacherId: teacher.id,
      ...flags,
      temporaryPasswordShared,
      manualShareConfirmed,
      readinessStatus: nextStatus,
    },
    update: {
      ...flags,
      temporaryPasswordShared,
      manualShareConfirmed,
      readinessStatus: nextStatus,
    },
  });

  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'TeacherOnboarding',
    entityId: onboarding.id,
    action: 'TEACHER_ONBOARDING_RECALCULATED',
    beforeState: previous ? { readinessStatus: previous.readinessStatus } : null,
    afterState: { readinessStatus: onboarding.readinessStatus, teacherId: teacher.id },
  });

  return mapOnboarding(teacher, onboarding);
};

export const getTeacherOnboarding = async (schoolId: string, teacherId: string, actor: Actor) => {
  ensureAccess(schoolId, actor);
  const teacher = await getTeacherForOnboarding(schoolId, teacherId);
  const onboarding = await prisma.teacherOnboarding.findUnique({ where: { teacherId: teacher.id } });
  if (!onboarding) return recalculateTeacherOnboarding(schoolId, teacher.id, actor);
  return mapOnboarding(teacher, onboarding);
};

export const listTeacherOnboarding = async (schoolId: string, actor: Actor) => {
  ensureAccess(schoolId, actor);
  const teachers = await prisma.teacherProfile.findMany({
    where: { schoolId },
    select: teacherSelect,
    orderBy: { createdAt: 'desc' },
  });
  const rows = [];
  for (const teacher of teachers) {
    const onboarding = await prisma.teacherOnboarding.findUnique({ where: { teacherId: teacher.id } });
    rows.push(onboarding ? mapOnboarding(teacher, onboarding) : await recalculateTeacherOnboarding(schoolId, teacher.id, actor));
  }
  return { items: rows, total: rows.length };
};

export const updateTeacherOnboarding = async (
  schoolId: string,
  teacherId: string,
  payload: { readinessStatus?: 'PENDING' | 'READY' | 'BLOCKED'; note?: string | null },
  actor: Actor,
) => {
  ensureAccess(schoolId, actor);
  const current = await getTeacherOnboarding(schoolId, teacherId, actor);
  if (payload.readinessStatus === 'READY') {
    const status = readinessStatus({
      accountCreated: current.accountCreated,
      firstLoginCompleted: current.firstLoginCompleted,
      passwordChanged: current.passwordChanged,
      profileCompleted: current.profileCompleted,
      active: current.active,
      classAssigned: current.classAssigned,
      subjectAssigned: current.subjectAssigned,
      timetableAssigned: current.timetableAssigned,
      attendanceEnabled: current.attendanceEnabled,
      manualShareConfirmed: current.manualShareConfirmed,
    });
    if (status !== 'READY') throw new HttpError(409, 'Teacher is missing required readiness items');
  }

  const updated = await prisma.teacherOnboarding.update({
    where: { id: current.id },
    data: {
      readinessStatus: payload.readinessStatus ?? undefined,
      note: payload.note === undefined ? undefined : payload.note,
    },
  });
  const teacher = await getTeacherForOnboarding(schoolId, teacherId);

  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'TeacherOnboarding',
    entityId: updated.id,
    action: 'TEACHER_ONBOARDING_UPDATED',
    beforeState: { readinessStatus: current.readinessStatus, note: current.note },
    afterState: { readinessStatus: updated.readinessStatus, note: updated.note },
  });

  return mapOnboarding(teacher, updated);
};

export const confirmTeacherCredentialManualShare = async (
  schoolId: string,
  teacherId: string,
  note: string,
  actor: Actor,
) => {
  if (!note.trim()) throw new HttpError(400, 'Manual share confirmation note is required');
  const current = await getTeacherOnboarding(schoolId, teacherId, actor);
  const teacher = await getTeacherForOnboarding(schoolId, teacherId);
  const flags = await calculateFlags(schoolId, teacher.id);
  const updated = await prisma.teacherOnboarding.update({
    where: { id: current.id },
    data: {
      manualShareConfirmed: true,
      temporaryPasswordShared: true,
      note,
      ...flags,
      readinessStatus: readinessStatus({ ...flags, manualShareConfirmed: true }),
    },
  });

  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'TeacherOnboarding',
    entityId: updated.id,
    action: 'TEACHER_CREDENTIAL_MANUAL_SHARE_CONFIRMED',
    beforeState: { manualShareConfirmed: current.manualShareConfirmed },
    afterState: { manualShareConfirmed: true, note },
  });

  return mapOnboarding(teacher, updated);
};

export const resendTeacherCredentials = async (schoolId: string, teacherId: string, actor: Actor) => {
  ensureAccess(schoolId, actor);
  const teacher = await getTeacherForOnboarding(schoolId, teacherId);
  const result = await sendAccountCreatedWhatsapp({
    role: 'TEACHER',
    schoolId,
    email: teacher.user.email,
    mobile: teacher.phone,
    tempPassword: null,
    fullName: `${teacher.firstName} ${teacher.lastName}`.trim(),
  });
  const current = await getTeacherOnboarding(schoolId, teacher.id, actor);
  const updated = await prisma.teacherOnboarding.update({
    where: { id: current.id },
    data: {
      temporaryPasswordShared: current.temporaryPasswordShared || result.queued,
      note: result.manualShareRequired ? 'Credential delivery attempted; manual share required.' : current.note,
    },
  });

  await createAuditLog({
    schoolId,
    actorId: actor.userId,
    actorRole: actor.role ?? 'UNKNOWN',
    entityType: 'TeacherOnboarding',
    entityId: updated.id,
    action: 'TEACHER_CREDENTIAL_RESEND_ATTEMPTED',
    afterState: { teacherId: teacher.id, queued: result.queued, deliveries: result.deliveries, manualShareRequired: result.manualShareRequired },
  });

  return { onboarding: mapOnboarding(teacher, updated), delivery: result };
};
