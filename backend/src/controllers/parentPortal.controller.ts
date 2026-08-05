import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { requireAuth } from '../middlewares/rbac.middleware';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';
import * as attendanceSheetService from '../services/attendanceSheet.service';
import {
  calculateGrade,
  evaluateFailCriteria,
  getExamGradingSettings,
} from '../services/grade.service';
import {
  computeStudentLeaveDays,
  findParentProfileForChild,
  sendStudentLeaveRequestTeacherAlerts,
  studentLeaveTypes,
} from '../services/studentLeave.service';
import { parseLimit } from '../utils/pagination';
import { noticeAudienceMatchesRole } from '../utils/noticeAudience';
import { getSchoolProfilesByIds } from '../services/schoolProfile.service';
import { createLedgerEntry } from '../services/feeLedger.service';
import { getNextNumber } from '../services/numberSequence.service';
import {
  getRazorpayConfig,
  razorpayRequest,
  verifyRazorpaySignature,
} from '../services/subscription.service';

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string | number | boolean | null | undefined>;
};

type RazorpayPayment = {
  id: string;
  order_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  captured?: boolean;
  method?: string | null;
};

const resolveParentProfiles = async (userId: string) => {
  return prisma.parentProfile.findMany({
    where: { userId },
  });
};

const resolveChildren = async (userId: string) => {
  const parents = await resolveParentProfiles(userId);
  if (!parents.length) return [];
  const parentIds = parents.map((parent) => parent.id);
  const links = await prisma.studentParent.findMany({
    where: { parentId: { in: parentIds } },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true, academicYearId: true } },
          section: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
        },
      },
    },
  });

  const unique = new Map<string, (typeof links)[number]>();
  links.forEach((link) => {
    if (!unique.has(link.studentId)) unique.set(link.studentId, link);
  });

  return Array.from(unique.values()).map((link) => {
    const className = link.student.class?.name ?? 'Class';
    const sectionName = link.student.section?.name;
    const classLabel = sectionName ? `${className} ${sectionName}` : className;
    return {
      id: link.student.id,
      name: `${link.student.firstName} ${link.student.lastName}`.trim(),
      classLabel,
      classId: link.student.classId ?? null,
      sectionId: link.student.sectionId ?? null,
      rollNo: link.student.admissionNo,
      schoolId: link.student.schoolId,
      schoolName: link.student.school?.name ?? '',
      academicYearId: link.student.class?.academicYearId ?? null,
    };
  });
};

const requireChildAccess = async (userId: string, childId?: string) => {
  const children = await resolveChildren(userId);
  if (!children.length) {
    throw new HttpError(404, 'No linked children');
  }
  if (!childId) return { child: children[0], children };
  const child = children.find((entry) => entry.id === childId);
  if (!child) {
    throw new HttpError(403, 'Child not linked to parent');
  }
  return { child, children };
};

const payloadRecord = (payload: unknown) =>
  payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : {};

const payloadString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
};

const payloadStringFrom = (
  payload: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    const value = payloadString(payload, key).trim();
    if (value) return value;
  }
  return '';
};

const alertFingerprint = (item: { title: string; summary: string }) =>
  `${item.title.trim().toLowerCase()}::${item.summary.trim().toLowerCase()}`;

const parentPushAlertVisibleForChild = (params: {
  payload: Record<string, unknown>;
  parentUserId: string;
  childId: string;
}) => {
  const to = payloadString(params.payload, 'to');
  if (to !== params.parentUserId) return false;

  const payloadChildId = payloadString(params.payload, 'childId');
  if (payloadChildId && payloadChildId !== params.childId) return false;

  return true;
};

const parseJsonPayload = (value: unknown) => {
  if (Array.isArray(value) || (value && typeof value === 'object'))
    return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const studentLeaveSchema = z.object({
  childId: z.string().uuid(),
  leaveType: z.enum(studentLeaveTypes).or(z.string().trim().min(1).max(80)),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(1000),
});

const parentHomeworkQuerySchema = z.object({
  childId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const dateRange = (value: string) => {
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const parentProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(32).optional().nullable(),
});

const parentFeeCheckoutSchema = z.object({
  childId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive().max(100000000),
});

const parentFeeCheckoutVerifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

const moneyDecimal = (value: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(value).toDecimalPlaces(2);

const moneyToPaise = (value: Prisma.Decimal | number | string) =>
  moneyDecimal(value).mul(100).toDecimalPlaces(0).toNumber();

const paiseToMoney = (value: number) =>
  new Prisma.Decimal(value).div(100).toDecimalPlaces(2);

const parentFeeReceipt = () => `FEE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

const paymentModeFromRazorpayMethod = (method?: string | null) => {
  const normalized = (method ?? '').toLowerCase();
  if (normalized === 'upi') return 'UPI';
  if (normalized === 'card') return 'CARD';
  if (normalized === 'netbanking') return 'BANK_TRANSFER';
  return 'ONLINE_GATEWAY';
};

const skippedDaysArray = (value: Prisma.JsonValue) =>
  Array.isArray(value)
    ? value
        .filter(
          (item) =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        )
        .map((item) => ({
          date:
            typeof (item as Record<string, unknown>).date === 'string'
              ? String((item as Record<string, unknown>).date)
              : '',
          reason:
            typeof (item as Record<string, unknown>).reason === 'string'
              ? String((item as Record<string, unknown>).reason)
              : 'Non-working day',
          type:
            typeof (item as Record<string, unknown>).type === 'string'
              ? String((item as Record<string, unknown>).type)
              : 'HOLIDAY',
        }))
    : [];

const formatStudentLeaveRequest = (request: any) => {
  const childName =
    request.student?.fullName ||
    `${request.student?.firstName ?? ''} ${request.student?.lastName ?? ''}`.trim() ||
    'Student';
  const classLabel = [
    request.student?.class?.name,
    request.student?.section?.name,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    id: request.id,
    childId: request.studentId,
    childName,
    classLabel,
    leaveType: request.leaveType,
    fromDate: request.fromDate,
    toDate: request.toDate,
    requestedDays: request.requestedDays,
    workingDays: request.workingDays,
    skippedDays: skippedDaysArray(request.skippedDays),
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

export const listParentChildren = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const children = await resolveChildren(auth.userId);
  res.status(200).json(children);
};

export const getParentChildDetail = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { child } = await requireChildAccess(auth.userId, req.params.childId);

  const student = await prisma.student.findFirst({
    where: { id: child.id, schoolId: child.schoolId },
    include: {
      school: { select: { id: true, name: true } },
      academicSession: { select: { id: true, name: true, isActive: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      studentGroup: { select: { id: true, name: true } },
      studentCategory: { select: { id: true, name: true } },
      guardians: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      parentLinks: { include: { parent: true } },
      siblings: {
        include: {
          sibling: {
            select: {
              id: true,
              admissionNo: true,
              rollNo: true,
              fullName: true,
              photoUrl: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      },
      siblingOf: {
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              rollNo: true,
              fullName: true,
              photoUrl: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      },
      enrollments: {
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: { enrolledAt: 'desc' },
      },
      promotionHistories: { orderBy: { createdAt: 'desc' }, take: 25 },
      documents: { orderBy: { createdAt: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' } },
      timelines: { orderBy: { timelineDate: 'desc' } },
      statusEvents: { orderBy: { changedAt: 'desc' } },
      transferRequests: { orderBy: { createdAt: 'desc' }, take: 25 },
      leaveRequests: { orderBy: { createdAt: 'desc' }, take: 25 },
      faceProfile: {
        include: { samples: { orderBy: { createdAt: 'desc' } } },
      },
      marks: {
        include: {
          examPaper: {
            include: {
              subject: { select: { id: true, name: true, code: true } },
              exam: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  status: true,
                  scheduledAt: true,
                  resultPublishAt: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
      examSeatingAllocations: {
        include: {
          exam: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              scheduledAt: true,
            },
          },
          center: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, name: true, code: true, floor: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      },
      feeAssignments: {
        where: { deletedAt: null },
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          feeStructure: { select: { id: true, name: true, status: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          transportRoute: { select: { id: true, title: true, fare: true } },
        },
        orderBy: { assignedAt: 'desc' },
        take: 50,
      },
      feeGroupAssignments: {
        where: { deletedAt: null },
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          feeGroup: { select: { id: true, name: true, status: true } },
        },
        orderBy: { assignedAt: 'desc' },
        take: 50,
      },
      feeInvoices: {
        where: { deletedAt: null },
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          feeType: { select: { id: true, name: true, schedule: true } },
          feeGroup: { select: { id: true, name: true, status: true } },
          feeStructure: { select: { id: true, name: true, status: true } },
          items: { orderBy: { sortOrder: 'asc' } },
          payments: { orderBy: { paidAt: 'desc' }, take: 20 },
          receipts: { orderBy: { receiptDate: 'desc' }, take: 20 },
        },
        orderBy: { issueDate: 'desc' },
        take: 50,
      },
      feeDiscounts: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      feeLedgers: { orderBy: { entryDate: 'desc' }, take: 50 },
      feeCarryForwards: { orderBy: { createdAt: 'desc' }, take: 20 },
      transportAssignments: {
        include: {
          route: { select: { id: true, title: true, fare: true } },
          vehicle: {
            select: {
              id: true,
              vehicleNumber: true,
              vehicleModel: true,
              driverName: true,
              driverContact: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      },
      dormitoryAssignments: {
        include: {
          dormitory: {
            select: { id: true, name: true, type: true, address: true },
          },
          room: {
            select: {
              id: true,
              roomNumber: true,
              bedCount: true,
              costPerBed: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      },
      libraryMemberships: {
        include: {
          issues: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  authorName: true,
                  bookNumber: true,
                  isbnNumber: true,
                  category: { select: { name: true } },
                  subject: { select: { name: true } },
                },
              },
              createdBy: { select: { email: true } },
              returnedBy: { select: { email: true } },
            },
            orderBy: { issueDate: 'desc' },
            take: 50,
          },
        },
      },
    },
  });

  if (!student) throw new HttpError(404, 'Student not found');

  const name =
    student.fullName || `${student.firstName} ${student.lastName}`.trim();
  const classLabel = [student.class?.name, student.section?.name]
    .filter(Boolean)
    .join(' ');
  const summary = {
    id: student.id,
    name,
    admissionNo: student.admissionNo,
    rollNo: student.rollNo,
    classLabel,
    classId: student.classId,
    sectionId: student.sectionId,
    schoolId: student.schoolId,
    schoolName: student.school?.name ?? child.schoolName,
    status: student.status,
    gender: student.gender,
    dob: student.dob,
    photoUrl: student.photoUrl ?? student.photos[0]?.url ?? null,
  };

  res.status(200).json({
    child: summary,
    tabs: {
      profile: {
        admission: {
          admissionNo: student.admissionNo,
          admissionDate: student.admissionDate,
          academicSession: student.academicSession,
          class: student.class,
          section: student.section,
          group: student.studentGroup,
          category: student.studentCategory,
          status: student.status,
        },
        personal: {
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: student.fullName,
          dob: student.dob,
          gender: student.gender,
          bloodGroup: student.bloodGroup,
          religion: student.religion,
          caste: student.caste,
          category: student.category,
          height: student.height,
          weight: student.weight,
          email: student.email,
          phone: student.phone,
        },
        address: {
          presentAddress: student.presentAddress,
          permanentAddress: student.permanentAddress,
          addressLine1: student.addressLine1,
          addressLine2: student.addressLine2,
          city: student.city,
          state: student.state,
          pincode: student.pincode,
        },
        medical: {
          emergencyContact: student.emergencyContact,
          medicalConditions: student.medicalConditions,
          allergies: student.allergies,
          doctorContact: student.doctorContact,
        },
        siblings: [
          ...student.siblings.map((entry) => ({
            relation: entry.relation,
            student: entry.sibling,
          })),
          ...student.siblingOf.map((entry) => ({
            relation: entry.relation,
            student: entry.student,
          })),
        ],
      },
      parents: {
        father: {
          name: student.fatherName,
          occupation: student.fatherOccupation,
          phone: student.fatherPhone,
          photoUrl: student.fatherPhotoUrl,
        },
        mother: {
          name: student.motherName,
          occupation: student.motherOccupation,
          phone: student.motherPhone,
          photoUrl: student.motherPhotoUrl,
        },
        guardian: {
          name: student.guardianName,
          relationship: student.guardianRelationship,
          phone: student.parentPhone,
          email: student.parentEmail,
          photoUrl: student.guardianPhotoUrl,
        },
        linkedParents: student.parentLinks.map((link) => ({
          createdAt: link.createdAt,
          parent: link.parent,
        })),
        guardians: student.guardians,
      },
      fees: {
        invoices: student.feeInvoices,
        assignments: student.feeAssignments,
        groups: student.feeGroupAssignments,
        discounts: student.feeDiscounts,
        ledger: student.feeLedgers,
        carryForwards: student.feeCarryForwards,
      },
      transport: { assignments: student.transportAssignments },
      library: { memberships: student.libraryMemberships },
      dormitory: { assignments: student.dormitoryAssignments },
      exam: { marks: student.marks, seating: student.examSeatingAllocations },
      documents: {
        uploadedDocuments: student.documents,
        studentPhotos: student.photos,
        admissionDocuments: {
          birthCertificate: student.docBirthCert,
          transferCertificate: student.docTransferCert,
          aadhaar: student.docAadhaar,
          reportCard: student.docReportCard,
        },
        faceProfile: student.faceProfile,
      },
      timeline: {
        timelines: student.timelines,
        statusEvents: student.statusEvents,
        enrollments: student.enrollments,
        promotions: student.promotionHistories,
        transferRequests: student.transferRequests,
        leaveRequests: student.leaveRequests,
      },
    },
  });
};

export const listParentLeaveRequests = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const childId =
    typeof req.query.childId === 'string' ? req.query.childId : undefined;
  const { child, children } = await requireChildAccess(auth.userId, childId);
  const childIds = childId ? [child.id] : children.map((entry) => entry.id);
  const rows = await prisma.studentLeaveRequest.findMany({
    where: { studentId: { in: childIds } },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });

  const now = new Date();
  const month = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(now);
  res.status(200).json({
    items: rows.map(formatStudentLeaveRequest),
    total: rows.length,
    currentMonth: month,
    leaveTypes: studentLeaveTypes,
  });
};

export const createParentLeaveRequest = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = studentLeaveSchema.parse(req.body);
  const { child } = await requireChildAccess(auth.userId, payload.childId);
  const parent = await findParentProfileForChild({
    userId: auth.userId,
    childId: child.id,
  });

  const calculation = await computeStudentLeaveDays({
    schoolId: child.schoolId,
    classId: child.classId,
    sectionId: child.sectionId,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
  });
  if (calculation.workingDays <= 0) {
    throw new HttpError(
      400,
      'Selected dates only include weekends or holidays',
    );
  }

  const overlap = await prisma.studentLeaveRequest.findFirst({
    where: {
      schoolId: child.schoolId,
      studentId: child.id,
      status: { in: ['PENDING', 'APPROVED'] },
      fromDate: { lte: calculation.toDate },
      toDate: { gte: calculation.fromDate },
    },
    select: { id: true },
  });
  if (overlap)
    throw new HttpError(
      409,
      'Leave request already exists for this date range',
    );

  const request = await prisma.studentLeaveRequest.create({
    data: {
      schoolId: child.schoolId,
      studentId: child.id,
      parentId: parent.id,
      leaveType: payload.leaveType,
      fromDate: calculation.fromDate,
      toDate: calculation.toDate,
      requestedDays: calculation.requestedDays,
      workingDays: calculation.workingDays,
      skippedDays: calculation.skippedDays as Prisma.InputJsonValue,
      reason: payload.reason,
    },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });

  await sendStudentLeaveRequestTeacherAlerts({
    schoolId: child.schoolId,
    actorId: auth.userId,
    child,
    leaveType: payload.leaveType,
    fromDate: calculation.fromDate,
    toDate: calculation.toDate,
    workingDays: calculation.workingDays,
    reason: payload.reason,
    requestId: request.id,
  });

  res.status(201).json(formatStudentLeaveRequest(request));
};

export const getParentProfile = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, mustChangePassword: true },
  });
  const parents = await resolveParentProfiles(auth.userId);
  const profile = parents[0];
  const children = await resolveChildren(auth.userId);
  const schoolProfiles = await getSchoolProfilesByIds(
    children.map((child) => child.schoolId),
  );
  res.status(200).json({
    name: profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : (user?.email ?? 'Parent'),
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    phone: profile?.phone ?? null,
    email: profile?.email ?? user?.email ?? null,
    mustChangePassword: user?.mustChangePassword ?? false,
    schoolName: children[0]?.schoolName ?? null,
    academicYear: null,
    children,
    schoolProfiles,
  });
};

export const updateParentProfile = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = parentProfileUpdateSchema.parse(req.body);
  const profiles = await resolveParentProfiles(auth.userId);
  if (!profiles.length) throw new HttpError(404, 'Parent profile not found');

  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: auth.userId },
      schoolId: auth.schoolId ?? null,
      email: payload.email,
    },
    select: { id: true },
  });
  if (duplicate)
    throw new HttpError(409, 'Email is already used by another account');

  await prisma.$transaction([
    prisma.parentProfile.updateMany({
      where: { userId: auth.userId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone?.trim() || null,
      },
    }),
    prisma.user.update({
      where: { id: auth.userId },
      data: { email: payload.email },
    }),
  ]);

  return getParentProfile(req, res);
};

export const getParentDashboard = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );

  const attendanceRecords = await attendanceReadService.getStudentAttendance({
    schoolId: child.schoolId,
    studentId: child.id,
    source: 'period-attendance',
  });
  const totalRecords = attendanceRecords.length;
  const presentRecords = attendanceRecords.filter((record) =>
    ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status),
  ).length;
  const attendancePercent = totalRecords
    ? Math.round((presentRecords / totalRecords) * 100)
    : null;

  const currentExam = await prisma.exam.findFirst({
    where: {
      schoolId: child.schoolId,
      classId: child.classId ?? undefined,
      sectionId: child.sectionId ?? undefined,
      status: { in: ['PUBLISHED', 'CLOSED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id },
    include: { examPaper: { include: { exam: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const gradingSettings = await getExamGradingSettings(child.schoolId);
  let latestResult: { examName: string; total: string; status: string } | null =
    null;
  if (marks.length) {
    const byExam = new Map<
      string,
      {
        examName: string;
        totalMarks: number;
        maxMarks: number;
        subjectMarks: Array<{ marks: number; maxMarks: number }>;
        createdAt: Date;
      }
    >();
    marks.forEach((mark) => {
      const exam = mark.examPaper.exam;
      if (!exam) return;
      const entry = byExam.get(exam.id) ?? {
        examName: exam.name,
        totalMarks: 0,
        maxMarks: 0,
        subjectMarks: [],
        createdAt: exam.createdAt,
      };
      entry.totalMarks += mark.marks;
      entry.maxMarks += mark.examPaper.maxMarks;
      entry.subjectMarks.push({
        marks: mark.marks,
        maxMarks: mark.examPaper.maxMarks,
      });
      if (exam.createdAt > entry.createdAt) entry.createdAt = exam.createdAt;
      byExam.set(exam.id, entry);
    });
    const latest = Array.from(byExam.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (latest) {
      latestResult = {
        examName: latest.examName,
        total: `${latest.totalMarks}/${latest.maxMarks}`,
        status:
          evaluateFailCriteria(
            latest.subjectMarks,
            gradingSettings.failCriteria,
          ).status === 'PASS'
            ? 'Pass'
            : 'Fail',
      };
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentAttendance = await attendanceReadService.getStudentAttendance({
    schoolId: child.schoolId,
    studentId: child.id,
    fromDate: since,
    toDate: new Date(),
    source: 'period-attendance',
  });
  const presentDays = recentAttendance.filter(
    (record) => record.status !== 'ABSENT',
  ).length;
  const absentDays = recentAttendance.filter(
    (record) => record.status === 'ABSENT',
  ).length;
  const monthlyPercent = recentAttendance.length
    ? Math.round((presentDays / recentAttendance.length) * 100)
    : 0;

  res.status(200).json({
    child,
    attendancePercent,
    currentExam: currentExam?.name ?? null,
    latestResult,
    attendanceSnapshot: {
      presentDays,
      absentDays,
      monthlyPercent,
    },
    notices: [],
  });
};

export const listParentExams = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId, academicYearId } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );
  const yearId =
    typeof academicYearId === 'string' && academicYearId.trim()
      ? academicYearId.trim()
      : null;
  const limit = parseLimit(req.query.limit, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  const exams = await prisma.exam.findMany({
    where: {
      schoolId: child.schoolId,
      academicYearId: yearId ?? child.academicYearId,
      status: { in: ['PUBLISHED', 'CLOSED'] },
      AND: [
        {
          OR: [{ classId: child.classId ?? undefined }, { classId: null }],
        },
        {
          OR: [
            { sectionId: child.sectionId ?? undefined },
            { sectionId: null },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id, status: 'LOCKED' },
    include: { examPaper: { select: { examId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const marksByExam = new Set(marks.map((mark) => mark.examPaper.examId));

  res.status(200).json(
    exams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      status: exam.status,
      resultStatus: marksByExam.has(exam.id) ? 'Published' : 'Pending',
      scheduledAt: exam.scheduledAt,
      academicYearId: exam.academicYearId,
      type: exam.type,
    })),
  );
};

export const listParentSubjects = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );

  if (!child.classId) {
    res.status(200).json([]);
    return;
  }

  const subjects = await prisma.subject.findMany({
    where: {
      schoolId: child.schoolId,
      classId: child.classId,
      ...(child.academicYearId ? { academicYearId: child.academicYearId } : {}),
    },
    orderBy: { name: 'asc' },
  });

  res
    .status(200)
    .json(subjects.map((subject) => ({ id: subject.id, name: subject.name })));
};

export const getParentResults = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );
  const limit = parseLimit(req.query.limit, {
    defaultLimit: 200,
    maxLimit: 500,
  });

  const examTypeRows = await prisma.examTypeConfig.findMany({
    where: { schoolId: child.schoolId },
    select: { code: true, name: true, isActive: true },
  });
  const examTypeMap = new Map(examTypeRows.map((row) => [row.code, row]));

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id, status: 'LOCKED' },
    include: {
      examPaper: {
        include: {
          subject: { select: { id: true, name: true } },
          exam: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });
  const hasNextPage = marks.length > limit;
  const resultMarks = marks.slice(0, limit);

  const grouped = new Map<
    string,
    {
      examId: string;
      examName: string;
      examType: string;
      examTypeCode: string;
      examTypeActive: boolean | null;
      examDate: string | null;
      resultPublishAt: string | null;
      academicYearId: string;
      classId: string | null;
      sectionId: string | null;
      subjects: Array<{
        subjectId: string;
        subjectName: string;
        marks: number;
        maxMarks: number;
        passMarks: number;
        grade?: string | null;
        scheduledAt: string | null;
      }>;
      totalMarks: number;
      totalMaxMarks: number;
      overallGrade?: string | null;
      classRank?: number | null;
      sectionRank?: number | null;
      classSize?: number;
      sectionSize?: number;
    }
  >();

  resultMarks.forEach((mark) => {
    const exam = mark.examPaper.exam;
    if (!exam) return;
    const existing = grouped.get(exam.id);
    const examTypeInfo = examTypeMap.get(exam.type);
    const subjectRow = {
      subjectId: mark.examPaper.subjectId,
      subjectName: mark.examPaper.subject?.name ?? 'Subject',
      marks: mark.marks,
      maxMarks: mark.examPaper.maxMarks,
      passMarks: mark.examPaper.passMarks,
      grade: mark.grade ?? null,
      scheduledAt: mark.examPaper.scheduledAt
        ? mark.examPaper.scheduledAt.toISOString()
        : null,
    };

    if (!existing) {
      grouped.set(exam.id, {
        examId: exam.id,
        examName: exam.name,
        examType: examTypeInfo?.name ?? exam.type,
        examTypeCode: exam.type,
        examTypeActive: examTypeInfo?.isActive ?? null,
        examDate: exam.scheduledAt ? exam.scheduledAt.toISOString() : null,
        resultPublishAt: exam.resultPublishAt
          ? exam.resultPublishAt.toISOString()
          : null,
        academicYearId: exam.academicYearId,
        classId: exam.classId ?? null,
        sectionId: exam.sectionId ?? null,
        subjects: [subjectRow],
        totalMarks: mark.marks,
        totalMaxMarks: mark.examPaper.maxMarks,
      });
      return;
    }

    existing.subjects.push(subjectRow);
    existing.totalMarks += mark.marks;
    existing.totalMaxMarks += mark.examPaper.maxMarks;
  });

  const gradingSettings = await getExamGradingSettings(child.schoolId);
  const items = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    percentage: entry.totalMaxMarks
      ? Math.round((entry.totalMarks / entry.totalMaxMarks) * 100)
      : null,
    overallGrade: entry.totalMaxMarks
      ? calculateGrade(
          entry.totalMarks,
          entry.totalMaxMarks,
          gradingSettings.gradeScale,
        )
      : null,
  }));

  const examIds = items.map((entry) => entry.examId);
  const rankMarks = examIds.length
    ? await prisma.mark.findMany({
        where: {
          status: 'LOCKED',
          examPaper: { examId: { in: examIds } },
        },
        select: {
          studentId: true,
          marks: true,
          examPaper: {
            select: {
              examId: true,
              maxMarks: true,
            },
          },
          student: { select: { classId: true, sectionId: true } },
        },
      })
    : [];

  const rankSummaries = new Map<
    string,
    Map<
      string,
      {
        studentId: string;
        totalMarks: number;
        totalMaxMarks: number;
        classId: string | null;
        sectionId: string | null;
        percentage: number;
      }
    >
  >();

  rankMarks.forEach((mark) => {
    const examId = mark.examPaper.examId;
    const examMap = rankSummaries.get(examId) ?? new Map();
    const summary = examMap.get(mark.studentId) ?? {
      studentId: mark.studentId,
      totalMarks: 0,
      totalMaxMarks: 0,
      classId: mark.student.classId,
      sectionId: mark.student.sectionId,
      percentage: 0,
    };
    summary.totalMarks += mark.marks;
    summary.totalMaxMarks += mark.examPaper.maxMarks;
    summary.percentage = summary.totalMaxMarks
      ? (summary.totalMarks / summary.totalMaxMarks) * 100
      : 0;
    examMap.set(mark.studentId, summary);
    rankSummaries.set(examId, examMap);
  });

  const rankOf = (
    rows: Array<{ studentId: string; totalMarks: number; percentage: number }>,
  ) => {
    const sorted = [...rows].sort(
      (a, b) => b.percentage - a.percentage || b.totalMarks - a.totalMarks,
    );
    let rank = 0;
    let previous: { totalMarks: number; percentage: number } | null = null;
    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      if (
        !previous ||
        row.percentage !== previous.percentage ||
        row.totalMarks !== previous.totalMarks
      ) {
        rank = index + 1;
      }
      previous = row;
      if (row.studentId === child.id) return rank;
    }
    return null;
  };

  items.forEach((entry) => {
    const rows = Array.from(rankSummaries.get(entry.examId)?.values() ?? []);
    const classRows = entry.classId
      ? rows.filter((row) => row.classId === entry.classId)
      : [];
    const sectionRows = entry.sectionId
      ? rows.filter((row) => row.sectionId === entry.sectionId)
      : [];
    entry.classRank = classRows.length ? rankOf(classRows) : null;
    entry.sectionRank = sectionRows.length ? rankOf(sectionRows) : null;
    entry.classSize = classRows.length;
    entry.sectionSize = sectionRows.length;
  });

  const itemsWithStatus = items.map((entry) => {
    const evaluation = evaluateFailCriteria(
      entry.subjects.map((subject) => ({
        marks: subject.marks,
        maxMarks: subject.maxMarks,
      })),
      gradingSettings.failCriteria,
    );
    return {
      ...entry,
      resultStatus: evaluation.status,
      failedSubjects: evaluation.failedSubjects,
    };
  });

  res.status(200).json({
    child,
    items: itemsWithStatus,
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: null,
    },
  });
};

export const getParentAttendance = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId, month, date } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );

  const start =
    month && typeof month === 'string' ? new Date(`${month}-01`) : new Date();
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const dateKey = (value: Date) => value.toISOString().slice(0, 10);
  const dayStart = (value: string | Date) => {
    const next = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  };
  const enumerateDays = (fromDate: Date, toDate: Date) => {
    const days: Date[] = [];
    const cursor = dayStart(fromDate);
    while (cursor <= toDate) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  };
  const routineDayValue = (value: Date) => {
    const day = value.getUTCDay();
    return day === 0 ? 7 : day;
  };
  const weekendValuesFromJson = (weekends: Prisma.JsonValue | null | undefined) => {
    const values = new Set<number>();
    const rows = Array.isArray(weekends) ? weekends : [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      if (item.isWeekend === false) continue;
      const raw = String(item.value ?? item.dayOfWeek ?? item.id ?? item.name ?? '').trim().toLowerCase();
      const numeric = Number(raw);
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) values.add(numeric);
      if (raw.includes('monday')) values.add(1);
      if (raw.includes('tuesday')) values.add(2);
      if (raw.includes('wednesday')) values.add(3);
      if (raw.includes('thursday')) values.add(4);
      if (raw.includes('friday')) values.add(5);
      if (raw.includes('saturday')) values.add(6);
      if (raw.includes('sunday')) values.add(7);
    }
    if (!values.size) {
      values.add(6);
      values.add(7);
    }
    return values;
  };
  const [records, settings, attendanceHolidays, leaveRequests] = await Promise.all([
    attendanceReadService.getStudentAttendance({
      schoolId: child.schoolId,
      studentId: child.id,
      fromDate: start,
      toDate: endInclusive,
    }),
    prisma.schoolSystemSetting.findUnique({
      where: { schoolId: child.schoolId },
      select: { weekends: true, holidays: true },
    }),
    child.classId && child.sectionId
      ? prisma.attendanceHoliday.findMany({
          where: {
            schoolId: child.schoolId,
            classId: child.classId,
            sectionId: child.sectionId,
            ...(child.academicYearId ? { academicSessionId: child.academicYearId } : {}),
            holidayDate: { gte: start, lte: endInclusive },
          },
          select: { holidayDate: true, reason: true },
        })
      : Promise.resolve([]),
    prisma.studentLeaveRequest.findMany({
      where: {
        schoolId: child.schoolId,
        studentId: child.id,
        status: { in: ['PENDING', 'APPROVED'] },
        fromDate: { lte: endInclusive },
        toDate: { gte: start },
      },
      select: { id: true, leaveType: true, fromDate: true, toDate: true, status: true, skippedDays: true },
    }),
  ]);

  const statusRank: Record<string, number> = {
    Leave: 6,
    Holiday: 5,
    Absent: 4,
    Late: 3,
    'Half Day': 2,
    Present: 1,
  };
  const normalizeStatus = (status: string) => {
    if (status === 'ABSENT') return 'Absent';
    if (status === 'LATE') return 'Late';
    if (status === 'HALF_DAY') return 'Half Day';
    if (status === 'HOLIDAY') return 'Holiday';
    if (status === 'LEAVE') return 'Leave';
    return 'Present';
  };
  const selectedDate =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : dateKey(new Date());

  const matchesUnit = (
    record: (typeof records)[number],
    unit: Awaited<
      ReturnType<typeof attendanceSheetService.resolveAttendanceUnits>
    >['units'][number],
  ) => {
    const recordUnit = record.unit;
    if (unit.unitType === 'DAY') {
      return (
        recordUnit?.unitType === 'DAY' || record.source === 'session-attendance'
      );
    }
    if (unit.unitType === 'SLOT') {
      return (
        recordUnit?.unitType === 'SLOT' &&
        recordUnit.slotId === (unit.slotId ?? null)
      );
    }
    if (unit.unitType === 'PERIOD') {
      return (
        recordUnit?.unitType === 'PERIOD' &&
        recordUnit.periodId === (unit.periodId ?? null)
      );
    }
    if (unit.unitType === 'TIMETABLE_ENTRY') {
      return (
        recordUnit?.unitType === 'TIMETABLE_ENTRY' &&
        recordUnit.timetableEntryId === (unit.timetableEntryId ?? null)
      );
    }
    return false;
  };

  const byDate = new Map<string, { status: string; remark?: string | null }>();
  const setDayStatus = (key: string, status: string, remark?: string | null) => {
    const existing = byDate.get(key);
    const nextRank = statusRank[status] ?? 0;
    const existingRank = existing ? (statusRank[existing.status] ?? 0) : 0;
    if (
      !existing ||
      nextRank > existingRank ||
      (nextRank === existingRank && !existing.remark && remark)
    ) {
      byDate.set(key, { status, remark: remark ?? null });
    }
  };

  records.forEach((record) => {
    setDayStatus(record.date, normalizeStatus(record.status), record.note ?? null);
  });

  const weekends = weekendValuesFromJson(settings?.weekends);
  for (const day of enumerateDays(start, endInclusive)) {
    if (weekends.has(routineDayValue(day))) {
      setDayStatus(dateKey(day), 'Holiday', 'Weekend');
    }
  }
  const systemHolidays = Array.isArray(settings?.holidays) ? settings.holidays : [];
  for (const row of systemHolidays) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const from = typeof item.fromDate === 'string' ? dayStart(item.fromDate) : null;
    const to = typeof item.toDate === 'string' ? dayStart(item.toDate) : from;
    if (!from || !to || to < start || from > endInclusive) continue;
    const title = String(item.title ?? 'Holiday');
    for (const day of enumerateDays(from < start ? start : from, to > endInclusive ? endInclusive : to)) {
      setDayStatus(dateKey(day), 'Holiday', title);
    }
  }
  for (const holiday of attendanceHolidays) {
    setDayStatus(dateKey(holiday.holidayDate), 'Holiday', holiday.reason ?? 'Holiday');
  }
  for (const request of leaveRequests) {
    const skipped = new Set(
      skippedDaysArray(request.skippedDays)
        .map((item) => dateKey(dayStart(item.date)))
        .filter(Boolean),
    );
    const from = request.fromDate < start ? start : request.fromDate;
    const to = request.toDate > endInclusive ? endInclusive : request.toDate;
    for (const day of enumerateDays(from, to)) {
      const key = dateKey(day);
      if (skipped.has(key)) continue;
      setDayStatus(key, 'Leave', `${request.leaveType} - ${request.status.toLowerCase()}`);
    }
  }

  const calendar = Array.from(byDate.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, entry]) => ({
    date,
    status: entry.status,
    remark: entry.remark ?? null,
  }));
  const presentDays = calendar.filter(
    (entry) => entry.status === 'Present',
  ).length;
  const absentDays = calendar.filter(
    (entry) => entry.status === 'Absent',
  ).length;
  const selectedDateObject = new Date(`${selectedDate}T00:00:00.000Z`);
  const attendanceUnits = child.classId
    ? await attendanceSheetService.resolveAttendanceUnits({
        schoolId: child.schoolId,
        academicYearId: child.academicYearId ?? null,
        classId: child.classId,
        sectionId: child.sectionId ?? null,
        date: selectedDateObject,
      })
    : {
        configuration: { mode: 'DAILY' as const },
        units: [
          { unitType: 'DAY' as const, label: 'Day', source: 'DAY' as const },
        ],
      };
  const selectedRecords = records.filter(
    (record) => record.date === selectedDate,
  );
  const selectedDayStatus = byDate.get(selectedDate);
  const sessions = attendanceUnits.units.map((unit, index) => {
    const record = selectedRecords.find((entry) => matchesUnit(entry, unit));
    return {
      id:
        record?.sessionId ??
        `${selectedDate}:${unit.unitType}:${unit.slotId ?? unit.periodId ?? unit.timetableEntryId ?? 'day'}`,
      unitType: unit.unitType,
      mode: attendanceUnits.configuration.mode,
      label:
        unit.unitType === 'DAY'
          ? 'Daily Session'
          : unit.unitType === 'SLOT'
            ? `${unit.label} Session`
            : unit.label,
      startTime: 'startTime' in unit ? (unit.startTime ?? null) : null,
      endTime: 'endTime' in unit ? (unit.endTime ?? null) : null,
      status: record ? normalizeStatus(record.status) : (selectedDayStatus?.status ?? 'Unmarked'),
      remark: record ? (record.note ?? null) : (selectedDayStatus?.remark ?? null),
      sequence: index + 1,
    };
  });

  res.status(200).json({
    calendar,
    presentDays,
    absentDays,
    selectedDate,
    mode: attendanceUnits.configuration.mode,
    sessions,
  });
};

export const listParentHomeworks = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const query = parentHomeworkQuerySchema.parse(req.query);
  const { child } = await requireChildAccess(auth.userId, query.childId);

  if (!child.classId || !child.sectionId) {
    return res.status(200).json({ items: [] });
  }

  const selectedDate = query.date ?? new Date().toISOString().slice(0, 10);
  const range = dateRange(selectedDate);
  const items = await prisma.homework.findMany({
    where: {
      schoolId: child.schoolId,
      classId: child.classId,
      sectionId: child.sectionId,
      homeworkDate: { gte: range.start, lt: range.end },
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, email: true } },
      _count: { select: { evaluations: true } },
    },
    orderBy: [{ subject: { name: 'asc' } }, { createdAt: 'desc' }],
  });

  if (items.length > 0) {
    const parentLinks = await prisma.studentParent.findMany({
      where: {
        studentId: child.id,
        parent: { userId: auth.userId },
      },
      select: { parentId: true },
    });
    const parentIds = parentLinks.map((link) => link.parentId);
    const homeworkIds = items.map((item) => item.id);

    if (parentIds.length > 0) {
      const viewedAt = new Date();
      await prisma.homeworkNotificationReceipt.createMany({
        data: homeworkIds.flatMap((homeworkId) =>
          parentIds.map((parentProfileId) => ({
            schoolId: child.schoolId,
            homeworkId,
            studentId: child.id,
            parentProfileId,
            parentUserId: auth.userId,
            viewedAt,
          })),
        ),
        skipDuplicates: true,
      });
      await prisma.homeworkNotificationReceipt.updateMany({
        where: {
          homeworkId: { in: homeworkIds },
          studentId: child.id,
          parentProfileId: { in: parentIds },
          viewedAt: null,
        },
        data: { parentUserId: auth.userId, viewedAt },
      });
    }
  }

  res.status(200).json({ items, selectedDate });
};

export const listParentNotices = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );
  const now = new Date();
  const [notices, pushLogs] = await Promise.all([
    prisma.communicationNotice.findMany({
      where: {
        schoolId: child.schoolId,
        status: 'PUBLISHED',
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    }),
    prisma.notificationLog.findMany({
      where: {
        schoolId: child.schoolId,
        channel: 'PUSH',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }),
  ]);

  const noticeItems = notices
    .filter((notice) => noticeAudienceMatchesRole(notice.audience, 'PARENT'))
    .map((notice) => ({
      id: notice.id,
      title: notice.title,
      date: notice.publishedAt.toISOString(),
      summary: notice.message,
      type: 'NOTICE',
      audience: notice.audience,
      details: { audience: notice.audience },
    }));
  const noticeFingerprints = new Set(noticeItems.map(alertFingerprint));

  const targetedAlerts = pushLogs
    .map((log) => ({ log, payload: payloadRecord(log.payload) }))
    .filter(({ payload }) =>
      parentPushAlertVisibleForChild({
        payload,
        parentUserId: auth.userId,
        childId: child.id,
      }),
    )
    .map(({ log, payload }) => {
      const category = payloadString(payload, 'category');
      const type = (
        payloadString(payload, 'alertType') ||
        (category ? category.toUpperCase() : '') ||
        'PUSH'
      ).toUpperCase();
      const title =
        payloadStringFrom(payload, ['subject', 'title']) || 'School alert';
      const summary = payloadStringFrom(payload, ['body', 'message']);
      return {
        id: log.id,
        title,
        date: (log.sentAt ?? log.createdAt).toISOString(),
        summary,
        type,
        status: log.status,
        details: {
          childId: payloadString(payload, 'childId'),
          childName: payloadString(payload, 'childName'),
          examId: payloadString(payload, 'examId'),
          examName: payloadString(payload, 'examName'),
          examStatus: payloadString(payload, 'examStatus'),
          examType: payloadString(payload, 'examType'),
          className: payloadString(payload, 'className'),
          sectionName: payloadString(payload, 'sectionName'),
          classLabel: payloadString(payload, 'classLabel'),
          scheduledAt: payloadString(payload, 'scheduledAt'),
          resultPublishAt: payloadString(payload, 'resultPublishAt'),
          subjects: parseJsonPayload(payload.subjects),
          attendanceDate: payloadString(payload, 'attendanceDate'),
          attendanceUnit: payloadString(payload, 'attendanceUnit'),
          attendanceStatus: payloadString(payload, 'attendanceStatus'),
          remarks: payloadString(payload, 'remarks'),
          route: payloadString(payload, 'route'),
          module: payloadString(payload, 'module'),
          category,
          invoiceId: payloadString(payload, 'invoiceId'),
          invoiceNumber: payloadString(payload, 'invoiceNumber'),
          invoiceNumbers: payloadString(payload, 'invoiceNumbers'),
          invoiceCount: payloadString(payload, 'invoiceCount'),
          dueAmount: payloadString(payload, 'dueAmount'),
          action: payloadString(payload, 'action'),
          tab: payloadString(payload, 'tab'),
          priority: payloadString(payload, 'priority'),
          recipientName: payloadString(payload, 'recipientName'),
          recipientType: payloadString(payload, 'recipientType'),
        },
      };
    })
    .filter(
      (alert) =>
        alert.type !== 'NOTICE' || !noticeFingerprints.has(alertFingerprint(alert)),
    );

  res
    .status(200)
    .json(
      [...targetedAlerts, ...noticeItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 100),
    );
};

export const listParentTimetable = async (_req: Request, res: Response) => {
  res.status(200).json([]);
};

export const listParentFees = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(
    auth.userId,
    typeof childId === 'string' ? childId : undefined,
  );
  const limit = parseLimit(req.query.limit, {
    defaultLimit: 100,
    maxLimit: 100,
  });

  const invoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId: child.schoolId,
      studentId: child.id,
      deletedAt: null,
    },
    include: {
      feeType: { select: { name: true, schedule: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
      receipts: { orderBy: { receiptDate: 'desc' } },
    },
    orderBy: { issueDate: 'desc' },
    take: limit,
  });

  const items = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.feeMonth
      ? `${invoice.feeMonth} Fee`
      : (invoice.feeType?.name ?? 'School Fee'),
    feeType: invoice.feeType?.name ?? null,
    amount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    dueAmount: invoice.dueAmount,
    status: invoice.status,
    dueDate: invoice.dueDate,
    issueDate: invoice.issueDate,
    items: invoice.items,
    payments: invoice.payments,
    receipts: invoice.receipts,
  }));

  const summary = items.reduce(
    (result, invoice) => {
      result.total += Number(invoice.amount ?? 0);
      result.paid += Number(invoice.paidAmount ?? 0);
      result.due += Number(invoice.dueAmount ?? 0);
      return result;
    },
    { total: 0, paid: 0, due: 0 },
  );

  res.status(200).json({ child, summary, items });
};

export const createParentFeeCheckoutOrder = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = parentFeeCheckoutSchema.parse(req.body ?? {});
  const { child } = await requireChildAccess(auth.userId, payload.childId);
  const amount = moneyDecimal(payload.amount);

  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      id: payload.invoiceId,
      schoolId: child.schoolId,
      studentId: child.id,
      deletedAt: null,
      status: { notIn: ['PAID', 'CANCELLED'] },
      dueAmount: { gt: 0 },
    },
    include: {
      school: { select: { name: true } },
      student: { select: { fullName: true, firstName: true, lastName: true } },
      feeType: { select: { name: true } },
    },
  });
  if (!invoice) throw new HttpError(404, 'Pending fee invoice not found');

  const dueAmount = moneyDecimal(invoice.dueAmount);
  if (amount.gt(dueAmount)) {
    throw new HttpError(400, 'Payment amount cannot exceed the invoice balance');
  }

  const amountPaise = moneyToPaise(amount);
  const parent = (await resolveParentProfiles(auth.userId))[0] ?? null;
  const receipt = parentFeeReceipt();
  const order = await razorpayRequest<RazorpayOrder>('/orders', {
    method: 'POST',
    body: {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        purpose: 'PARENT_FEE_PAYMENT',
        parentUserId: auth.userId,
        schoolId: child.schoolId,
        studentId: child.id,
        academicSessionId: invoice.academicSessionId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: amount.toFixed(2),
        amountPaise: String(amountPaise),
      },
    },
  });

  res.status(201).json({
    gateway: 'RAZORPAY',
    keyId: getRazorpayConfig().keyId,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt ?? receipt,
    },
    child: {
      id: child.id,
      name: child.name,
      classLabel: child.classLabel,
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.feeMonth ? `${invoice.feeMonth} Fee` : (invoice.feeType?.name ?? 'School Fee'),
      dueAmount: dueAmount.toString(),
    },
    checkout: {
      amount: amount.toString(),
      currency: 'INR',
      description: `${invoice.invoiceNumber} fee payment`,
      prefill: {
        name: parent ? `${parent.firstName} ${parent.lastName}`.trim() : '',
        email: parent?.email ?? '',
        contact: parent?.phone ?? '',
      },
    },
  });
};

const orderNote = (notes: RazorpayOrder['notes'], key: string) => {
  const value = notes?.[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HttpError(400, `Razorpay order is missing ${key}`);
  }
  return String(value);
};

export const verifyParentFeeCheckoutPayment = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = parentFeeCheckoutVerifySchema.parse(req.body ?? {});
  if (!verifyRazorpaySignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature)) {
    throw new HttpError(400, 'Invalid Razorpay payment signature');
  }

  const order = await razorpayRequest<RazorpayOrder>(`/orders/${encodeURIComponent(payload.razorpay_order_id)}`);
  const notes = order.notes ?? {};
  if (orderNote(notes, 'purpose') !== 'PARENT_FEE_PAYMENT') {
    throw new HttpError(400, 'Razorpay order is not a parent fee payment');
  }
  if (orderNote(notes, 'parentUserId') !== auth.userId) {
    throw new HttpError(403, 'Razorpay order does not belong to this parent');
  }

  const schoolId = orderNote(notes, 'schoolId');
  const studentId = orderNote(notes, 'studentId');
  const academicSessionId = orderNote(notes, 'academicSessionId');
  const invoiceId = orderNote(notes, 'invoiceId');
  const expectedPaise = Number(orderNote(notes, 'amountPaise'));
  if (!Number.isFinite(expectedPaise) || expectedPaise <= 0) {
    throw new HttpError(400, 'Razorpay order has an invalid amount');
  }
  await requireChildAccess(auth.userId, studentId);

  let payment = await razorpayRequest<RazorpayPayment>(`/payments/${encodeURIComponent(payload.razorpay_payment_id)}`);
  if (payment.order_id !== order.id) {
    throw new HttpError(400, 'Razorpay payment does not match this order');
  }
  if (payment.status === 'authorized') {
    payment = await razorpayRequest<RazorpayPayment>(`/payments/${encodeURIComponent(payment.id)}/capture`, {
      method: 'POST',
      body: {
        amount: payment.amount,
        currency: 'INR',
      },
    });
  }
  if (payment.status !== 'captured' || payment.captured === false) {
    throw new HttpError(409, 'Razorpay payment was not captured');
  }
  if (order.amount !== expectedPaise || payment.amount !== expectedPaise || order.currency !== 'INR' || payment.currency !== 'INR') {
    throw new HttpError(400, 'Razorpay amount does not match checkout amount');
  }

  const existingPayment = await prisma.feePayment.findFirst({
    where: { schoolId, gateway: 'RAZORPAY', gatewayPaymentId: payment.id },
    include: {
      receipt: true,
      invoice: { include: { feeType: { select: { name: true, schedule: true } }, items: true, payments: true, receipts: true } },
    },
  });
  if (existingPayment) {
    res.status(200).json({
      idempotent: true,
      payment: existingPayment,
      receipt: existingPayment.receipt,
      invoice: existingPayment.invoice,
      message: 'Razorpay payment was already verified.',
    });
    return;
  }

  const paidAt = new Date();
  const amount = paiseToMoney(payment.amount);
  const reference = `razorpay:${payment.id};order:${order.id}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT id FROM fee_invoices WHERE id = $1::uuid AND school_id = $2::uuid AND academic_session_id = $3::uuid AND student_id = $4::uuid AND deleted_at IS NULL FOR UPDATE',
      invoiceId,
      schoolId,
      academicSessionId,
      studentId,
    );
    const invoice = await tx.feeInvoice.findFirst({
      where: {
        id: invoiceId,
        schoolId,
        academicSessionId,
        studentId,
        deletedAt: null,
      },
      include: {
        feeType: { select: { name: true, schedule: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        receipts: { orderBy: { receiptDate: 'desc' } },
      },
    });
    if (!invoice) throw new HttpError(404, 'Pending fee invoice not found');
    if (invoice.status === 'PAID') throw new HttpError(409, 'Invoice is already paid');
    if (invoice.status === 'CANCELLED') throw new HttpError(409, 'Cannot pay a cancelled invoice');
    const currentDue = moneyDecimal(invoice.dueAmount);
    if (currentDue.lte(0)) throw new HttpError(409, 'Invoice is already paid');
    if (amount.gt(currentDue)) throw new HttpError(400, 'Payment amount cannot exceed the invoice balance');

    const paymentNumber = await getNextNumber({ schoolId, academicSessionId, type: 'PAYMENT', prefix: 'PAY' }, tx);
    const receiptNumber = await getNextNumber({ schoolId, academicSessionId, type: 'RECEIPT', prefix: 'RCP' }, tx);
    const createdPayment = await tx.feePayment.create({
      data: {
        schoolId,
        academicSessionId,
        studentId,
        invoiceId,
        paymentNumber,
        paymentMode: paymentModeFromRazorpayMethod(payment.method) as any,
        amount,
        transactionReference: reference,
        idempotencyKey: `razorpay:${payment.id}`,
        gateway: 'RAZORPAY',
        gatewayPaymentId: payment.id,
        status: 'SUCCESS',
        paidAt,
        note: `Razorpay ${payment.method ?? 'online'} parent payment for ${invoice.invoiceNumber}`,
        collectedById: auth.userId,
      },
    });
    const receipt = await tx.feeReceipt.create({
      data: {
        schoolId,
        academicSessionId,
        studentId,
        invoiceId,
        paymentId: createdPayment.id,
        receiptNumber,
        amount,
        receiptDate: paidAt,
      },
    });
    const dueAmount = currentDue.minus(amount);
    const paidAmount = moneyDecimal(invoice.paidAmount).plus(amount);
    const updatedInvoice = await tx.feeInvoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        dueAmount,
        status: dueAmount.eq(0) ? 'PAID' : 'PARTIALLY_PAID',
      },
      include: {
        feeType: { select: { name: true, schedule: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        receipts: { orderBy: { receiptDate: 'desc' } },
      },
    });
    const allocation = await tx.feePaymentAllocation.create({
      data: {
        schoolId,
        academicSessionId,
        studentId,
        paymentId: createdPayment.id,
        invoiceId,
        allocatedAmount: amount,
      },
    });
    await createLedgerEntry(tx, {
      schoolId,
      academicSessionId,
      studentId,
      invoiceId,
      paymentId: createdPayment.id,
      receiptId: receipt.id,
      type: 'PAYMENT_CREDIT',
      description: `Parent Razorpay payment ${createdPayment.paymentNumber} against invoice ${invoice.invoiceNumber}`,
      creditAmount: amount,
      createdById: auth.userId,
    });
    await tx.feeNotification.create({
      data: {
        schoolId,
        academicSessionId,
        studentId,
        invoiceId,
        type: 'PAYMENT_SUCCESS',
        channel: 'IN_APP',
        recipient: studentId,
        message: `Payment ${createdPayment.paymentNumber} received for ${invoice.invoiceNumber}.`,
        status: 'QUEUED',
      },
    });
    return { payment: createdPayment, receipt, invoice: updatedInvoice, allocation };
  });

  res.status(201).json({
    idempotent: false,
    ...result,
    message: 'Razorpay payment verified and fee invoice updated.',
  });
};
