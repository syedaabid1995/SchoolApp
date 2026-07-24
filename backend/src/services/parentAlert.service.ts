import type {
  AttendanceStatus,
  AttendanceUnitType,
  StudentAttendanceStatus,
} from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { sendNotification } from './notification.service';

type ParentRecipient = {
  userId: string;
  parentName: string;
  studentId: string;
  studentName: string;
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const parentName = (parent: { firstName: string; lastName: string }) =>
  `${parent.firstName} ${parent.lastName}`.trim() || 'Parent';

const studentName = (student: { firstName: string; lastName: string }) =>
  `${student.firstName} ${student.lastName}`.trim() || 'Student';

const uniqueRecipients = (recipients: ParentRecipient[]) => {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const key = `${recipient.userId}:${recipient.studentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveParentRecipientsForStudents = async (
  studentIds: string[],
): Promise<ParentRecipient[]> => {
  if (!studentIds.length) return [];
  const links = await prisma.studentParent.findMany({
    where: { studentId: { in: Array.from(new Set(studentIds)) } },
    include: {
      parent: { select: { userId: true, firstName: true, lastName: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return uniqueRecipients(
    links
      .filter((link) => Boolean(link.parent.userId))
      .map((link) => ({
        userId: link.parent.userId!,
        parentName: parentName(link.parent),
        studentId: link.studentId,
        studentName: studentName(link.student),
      })),
  );
};

const sendParentPush = async (params: {
  schoolId: string;
  actorId?: string | null;
  recipient: ParentRecipient;
  subject: string;
  body: string;
  category: 'exam' | 'attendance';
  priority?: 'normal' | 'high' | 'urgent';
  data: Record<string, unknown>;
}) => {
  try {
    await sendNotification({
      schoolId: params.schoolId,
      userId: params.actorId ?? null,
      channel: 'PUSH',
      data: {
        to: params.recipient.userId,
        subject: params.subject,
        body: params.body,
        recipientName: params.recipient.parentName,
        recipientType: 'PARENT',
        targetMode: 'STUDENT',
        recipientGroups: ['GUARDIANS'],
        route: '/alerts',
        module: 'alerts',
        category: params.category,
        priority: params.priority ?? 'high',
        childId: params.recipient.studentId,
        childName: params.recipient.studentName,
        ...params.data,
      },
    });
  } catch (error) {
    logger.warn({ err: error, childId: params.recipient.studentId }, 'parent alert push failed');
  }
};

export const sendExamParentAlerts = async (params: {
  schoolId: string;
  actorId?: string | null;
  examId: string;
  event: 'EXAM_CREATED' | 'EXAM_PUBLISHED';
}) => {
  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, schoolId: params.schoolId },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      papers: {
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: { scheduledAt: 'asc' },
      },
    },
  });
  if (!exam?.classId) return;

  const students = await prisma.student.findMany({
    where: {
      schoolId: params.schoolId,
      status: 'ENROLLED',
      classId: exam.classId,
      ...(exam.sectionId ? { sectionId: exam.sectionId } : {}),
    },
    select: { id: true },
  });
  const recipients = await resolveParentRecipientsForStudents(students.map((student) => student.id));
  if (!recipients.length) return;

  const subjects = exam.papers.map((paper) => ({
    id: paper.subjectId,
    name: paper.subject?.name ?? 'Subject',
    code: paper.subject?.code ?? null,
    date: paper.scheduledAt?.toISOString() ?? null,
    maxMarks: paper.maxMarks,
    passMarks: paper.passMarks,
  }));
  const subjectNames = subjects.map((subject) => subject.name).join(', ');
  const firstPaperDate = exam.papers.find((paper) => paper.scheduledAt)?.scheduledAt ?? exam.scheduledAt;
  const title =
    params.event === 'EXAM_PUBLISHED'
      ? `Exam published: ${exam.name}`
      : `New exam created: ${exam.name}`;
  const classLabel = [exam.class?.name, exam.section?.name].filter(Boolean).join(' ');
  const scheduleText = firstPaperDate ? ` from ${formatDateTime(firstPaperDate)}` : '';

  await Promise.all(
    recipients.map((recipient) =>
      sendParentPush({
        schoolId: params.schoolId,
        actorId: params.actorId,
        recipient,
        subject: title,
        body: `${exam.name} for ${recipient.studentName}${classLabel ? ` (${classLabel})` : ''}${scheduleText}. Subjects: ${subjectNames || 'Not listed'}.`,
        category: 'exam',
        data: {
          alertType: params.event,
          examId: exam.id,
          examName: exam.name,
          examStatus: exam.status,
          examType: exam.type,
          classId: exam.classId,
          className: exam.class?.name ?? '',
          sectionId: exam.sectionId ?? '',
          sectionName: exam.section?.name ?? '',
          scheduledAt: firstPaperDate?.toISOString() ?? '',
          resultPublishAt: exam.resultPublishAt?.toISOString() ?? '',
          subjects: JSON.stringify(subjects),
        },
      }),
    ),
  );
};

export const sendAttendanceAbsenceParentAlerts = async (params: {
  schoolId: string;
  actorId?: string | null;
  date: Date | string;
  unitLabel: string;
  sessionId: string;
  source: 'legacy-attendance' | 'attendance-sheet';
  absentRecords: Array<{
    studentId: string;
    status: AttendanceStatus | StudentAttendanceStatus;
    previousStatus?: AttendanceStatus | StudentAttendanceStatus | null;
    remarks?: string | null;
  }>;
}) => {
  const newlyAbsent = params.absentRecords.filter(
    (record) => record.status === 'ABSENT' && record.previousStatus !== 'ABSENT',
  );
  if (!newlyAbsent.length) return;

  const recipients = await resolveParentRecipientsForStudents(
    newlyAbsent.map((record) => record.studentId),
  );
  if (!recipients.length) return;

  const recordByStudent = new Map(newlyAbsent.map((record) => [record.studentId, record]));
  const dateLabel = formatDate(params.date);
  await Promise.all(
    recipients.map((recipient) => {
      const record = recordByStudent.get(recipient.studentId);
      return sendParentPush({
        schoolId: params.schoolId,
        actorId: params.actorId,
        recipient,
        subject: 'Attendance alert',
        body: `${recipient.studentName} was marked absent${params.unitLabel ? ` for ${params.unitLabel}` : ''}${dateLabel ? ` on ${dateLabel}` : ''}.`,
        category: 'attendance',
        priority: 'urgent',
        data: {
          alertType: 'ATTENDANCE_ABSENT',
          attendanceSource: params.source,
          attendanceSessionId: params.sessionId,
          attendanceDate: params.date instanceof Date ? params.date.toISOString() : String(params.date),
          attendanceUnit: params.unitLabel,
          attendanceStatus: 'ABSENT',
          remarks: record?.remarks ?? '',
        },
      });
    }),
  );
};

export const attendanceUnitLabel = (params: {
  unitType?: AttendanceUnitType | null;
  label?: string | null;
  slotType?: string | null;
  fallback?: string | null;
}) => {
  if (params.label?.trim()) return params.label.trim();
  if (params.slotType === 'MORNING') return 'Morning Session';
  if (params.slotType === 'AFTERNOON') return 'Afternoon Session';
  if (params.unitType === 'DAY') return 'Daily Session';
  if (params.unitType === 'PERIOD') return 'Period';
  if (params.unitType === 'TIMETABLE_ENTRY') return 'Timetable Period';
  return params.fallback?.trim() || 'Attendance Session';
};
