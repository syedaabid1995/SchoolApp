import { prisma } from '../config/db';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';
import type { StudentDailyAttendance } from '../modules/attendance/models/attendance-read-model';

const blankCounts = () => ({ total: 0, present: 0, late: 0, absent: 0, excused: 0 });

const applyStatus = (counts: ReturnType<typeof blankCounts>, status: string) => {
  counts.total += 1;
  if (status === 'PRESENT') counts.present += 1;
  if (status === 'LATE') counts.late += 1;
  if (status === 'ABSENT') counts.absent += 1;
  if (status === 'EXCUSED') counts.excused += 1;
};

const dateFromKey = (date: string) => new Date(`${date}T00:00:00.000Z`);

const groupDaily = (records: StudentDailyAttendance[]) => {
  const grouped = new Map<string, ReturnType<typeof blankCounts>>();
  records.forEach((record) => {
    const counts = grouped.get(record.date) ?? blankCounts();
    applyStatus(counts, record.status);
    grouped.set(record.date, counts);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date: dateFromKey(date), ...counts }));
};

const groupByClass = (records: StudentDailyAttendance[]) => {
  const grouped = new Map<string | null, ReturnType<typeof blankCounts>>();
  records.forEach((record) => {
    const classId = record.classId ?? null;
    const counts = grouped.get(classId) ?? blankCounts();
    applyStatus(counts, record.status);
    grouped.set(classId, counts);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => String(a ?? '').localeCompare(String(b ?? '')))
    .map(([classId, counts]) => ({ classId, ...counts }));
};

export const getAttendanceSummary = async (params: {
  schoolId: string;
  dateFrom: Date;
  dateTo: Date;
  classId?: string;
}) => {
  const { schoolId, dateFrom, dateTo, classId } = params;

  const [records, byClassRecords] = await Promise.all([
    attendanceReadService.getStudentAttendance({
      schoolId,
      classId,
      fromDate: dateFrom,
      toDate: dateTo,
      source: 'period-attendance',
    }),
    attendanceReadService.getStudentAttendance({
      schoolId,
      fromDate: dateFrom,
      toDate: dateTo,
      source: 'period-attendance',
    }),
  ]);

  const approvalCounts = await prisma.attendanceSession.groupBy({
    by: ['approvalStatus'],
    where: {
      schoolId,
      date: { gte: dateFrom, lte: dateTo },
    },
    _count: { _all: true },
  });

  const totals = records.reduce((acc, record) => {
    applyStatus(acc, record.status);
    return acc;
  }, blankCounts());

  const approvalMap = approvalCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.approvalStatus] = row._count._all;
    return acc;
  }, {});

  return {
    totals: {
      total: totals.total,
      present: totals.present,
      late: totals.late,
      absent: totals.absent,
      excused: totals.excused,
    },
    approvals: {
      pending: approvalMap.PENDING ?? 0,
      approved: approvalMap.APPROVED ?? 0,
      rejected: approvalMap.REJECTED ?? 0,
    },
    daily: groupDaily(records),
    byClass: groupByClass(byClassRecords),
  };
};
