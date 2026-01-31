import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';

export const getAttendanceSummary = async (params: {
  schoolId: string;
  dateFrom: Date;
  dateTo: Date;
  classId?: string;
}) => {
  const { schoolId, dateFrom, dateTo, classId } = params;

  const statusCounts = await prisma.attendanceRecord.groupBy({
    by: ['status'],
    where: {
      session: {
        schoolId,
        date: { gte: dateFrom, lte: dateTo },
      },
      ...(classId ? { student: { classId } } : {}),
    },
    _count: { _all: true },
  });

  const approvalCounts = await prisma.attendanceSession.groupBy({
    by: ['approvalStatus'],
    where: {
      schoolId,
      date: { gte: dateFrom, lte: dateTo },
    },
    _count: { _all: true },
  });

  const classFilter = classId ? Prisma.sql`AND st.class_id = ${classId}::uuid` : Prisma.empty;

  const daily = await prisma.$queryRaw<
    Array<{
      date: Date;
      total: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
    }>
  >`
    SELECT
      DATE(s.date) as date,
      COUNT(r.id)::int as total,
      SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END)::int as present,
      SUM(CASE WHEN r.status = 'LATE' THEN 1 ELSE 0 END)::int as late,
      SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END)::int as absent,
      SUM(CASE WHEN r.status = 'EXCUSED' THEN 1 ELSE 0 END)::int as excused
    FROM attendance_records r
    JOIN attendance_sessions s ON s.id = r.session_id
    JOIN students st ON st.id = r.student_id
    WHERE s.school_id = ${schoolId}::uuid
      AND s.date >= ${dateFrom}
      AND s.date <= ${dateTo}
      ${classFilter}
    GROUP BY DATE(s.date)
    ORDER BY DATE(s.date) ASC
  `;

  const byClass = await prisma.$queryRaw<
    Array<{
      class_id: string | null;
      total: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
    }>
  >`
    SELECT
      st.class_id,
      COUNT(r.id)::int as total,
      SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END)::int as present,
      SUM(CASE WHEN r.status = 'LATE' THEN 1 ELSE 0 END)::int as late,
      SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END)::int as absent,
      SUM(CASE WHEN r.status = 'EXCUSED' THEN 1 ELSE 0 END)::int as excused
    FROM attendance_records r
    JOIN attendance_sessions s ON s.id = r.session_id
    JOIN students st ON st.id = r.student_id
    WHERE s.school_id = ${schoolId}::uuid
      AND s.date >= ${dateFrom}
      AND s.date <= ${dateTo}
    GROUP BY st.class_id
    ORDER BY st.class_id ASC
  `;

  const statusMap = statusCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const approvalMap = approvalCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.approvalStatus] = row._count._all;
    return acc;
  }, {});

  return {
    totals: {
      total: Object.values(statusMap).reduce((sum, val) => sum + val, 0),
      present: statusMap.PRESENT ?? 0,
      late: statusMap.LATE ?? 0,
      absent: statusMap.ABSENT ?? 0,
      excused: statusMap.EXCUSED ?? 0,
    },
    approvals: {
      pending: approvalMap.PENDING ?? 0,
      approved: approvalMap.APPROVED ?? 0,
      rejected: approvalMap.REJECTED ?? 0,
    },
    daily,
    byClass: byClass.map((row) => ({
      classId: row.class_id,
      total: row.total,
      present: row.present,
      late: row.late,
      absent: row.absent,
      excused: row.excused,
    })),
  };
};
