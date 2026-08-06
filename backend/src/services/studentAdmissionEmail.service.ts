import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { sendNotification } from './notification.service';

const formatDate = (value?: Date | string | null) => {
  if (!value) return 'Not provided';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatMoney = (value: unknown) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

const toAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const feeScheduleMultiplier = (schedule?: string | null) => {
  switch (schedule) {
    case 'MONTHLY':
      return 12;
    case 'QUARTERLY':
      return 4;
    case 'HALF_YEARLY':
      return 2;
    case 'YEARLY':
    case 'ONE_TIME':
    default:
      return 1;
  }
};

const feeScheduleLabel = (schedule?: string | null) => {
  switch (schedule) {
    case 'MONTHLY':
      return 'Monthly';
    case 'QUARTERLY':
      return 'Quarterly';
    case 'HALF_YEARLY':
      return 'Half-yearly';
    case 'YEARLY':
      return 'Yearly';
    case 'ONE_TIME':
      return 'One-time';
    default:
      return 'Amount';
  }
};

const text = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || 'Not provided';
};

const optionalText = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const row = (label: string, value: unknown) =>
  `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:700;color:#334155;">${escapeHtml(
    label,
  )}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#0f172a;">${escapeHtml(
    text(value),
  )}</td></tr>`;

const section = (title: string, rows: string) => `
  <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">${escapeHtml(title)}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
`;

const emptyAssignment = '<p style="margin:8px 0 0;color:#64748b;">Not opted / not assigned.</p>';

const detailTable = (headers: string[], rows: unknown[][]) => {
  if (!rows.length) return emptyAssignment;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr>
          ${headers
            .map(
              (header) =>
                `<th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f8fafc;text-align:left;color:#334155;">${escapeHtml(
                  header,
                )}</th>`,
            )
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (items) =>
              `<tr>${items
                .map(
                  (item) =>
                    `<td style="padding:8px 12px;border:1px solid #e5e7eb;color:#0f172a;">${escapeHtml(
                      text(item),
                    )}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
};

const payloadRecord = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};

const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const sendStudentAdmissionAccountEmail = async (params: {
  schoolId: string;
  studentId: string;
  parentId: string;
  tempPassword?: string | null;
}) => {
  const [student, parent, generationJob] = await Promise.all([
    prisma.student.findFirst({
      where: { id: params.studentId, schoolId: params.schoolId },
      include: {
        school: { select: { name: true, code: true } },
        academicSession: { select: { name: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
        feeGroupAssignments: {
          where: { deletedAt: null, status: 'ACTIVE' },
          include: {
            feeGroup: {
              include: {
                masters: {
                  where: { deletedAt: null, status: 'ACTIVE' },
                  include: { feeType: { select: { name: true, schedule: true } } },
                  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        transportAssignments: {
          where: { active: true },
          include: {
            route: { select: { title: true, fare: true } },
            vehicle: { select: { vehicleNumber: true, driverName: true, driverContact: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        libraryMemberships: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        },
        dormitoryAssignments: {
          where: { active: true },
          include: {
            dormitory: { select: { name: true, type: true } },
            room: { select: { roomNumber: true, costPerBed: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    }),
    prisma.parentProfile.findFirst({
      where: { id: params.parentId },
      include: { user: { select: { email: true } } },
    }),
    prisma.feeInvoiceGenerationJob.findFirst({
      where: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        source: 'ADMISSION',
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    }),
  ]);

  if (!student || !parent) return null;

  const discountIds = stringArray(payloadRecord(generationJob?.payload).discountIds);
  const discounts = discountIds.length
    ? await prisma.feeDiscount.findMany({
        where: {
          schoolId: params.schoolId,
          academicSessionId: student.academicSessionId ?? undefined,
          id: { in: discountIds },
          deletedAt: null,
          approvalStatus: { in: ['APPROVED', 'ACTIVE'] },
        },
        include: { installments: true },
      })
    : [];

  const recipient = optionalText(parent.email);
  if (!recipient || recipient.endsWith('@parent.local')) return null;

  const parentName = `${parent.firstName} ${parent.lastName}`.trim() || 'Parent';
  const loginEmail = optionalText(parent.user?.email) ?? recipient;
  const schoolName = student.school.name || 'School';
  const subject = `Parent account created for ${student.fullName}`;

  const feeMasters = student.feeGroupAssignments.flatMap((assignment) => assignment.feeGroup.masters);
  const feeRows = feeMasters.map((master) => {
    const multiplier = feeScheduleMultiplier(master.feeType.schedule);
    return [
      master.description || master.name,
      `${formatMoney(master.amount)} / ${feeScheduleLabel(master.feeType.schedule)}`,
      formatMoney(toAmount(master.amount) * multiplier),
    ];
  });
  const feeSubTotal = feeMasters.reduce(
    (sum, master) => sum + toAmount(master.amount) * feeScheduleMultiplier(master.feeType.schedule),
    0,
  );
  const discountTotal = feeMasters.reduce((sum, master) => {
    const masterAnnualAmount = toAmount(master.amount) * feeScheduleMultiplier(master.feeType.schedule);
    const masterDiscount = discounts.reduce((discountSum, discount) => {
      if (discount.installments.some((item) => item.feeMasterId === master.id && !item.deletedAt)) {
        const value = toAmount(discount.amount ?? discount.value);
        return discountSum + (discount.valueType === 'PERCENTAGE' ? (masterAnnualAmount * value) / 100 : value);
      }
      if (discount.feeTypeId && discount.feeTypeId !== master.feeTypeId) return discountSum;
      if (discount.targetType === 'ALL' ||
          (discount.targetType === 'STUDENT' && (!discount.studentId || discount.studentId === student.id)) ||
          (discount.targetType === 'CLASS' && discount.classId === student.classId) ||
          (discount.targetType === 'SECTION' && discount.sectionId === student.sectionId) ||
          (discount.targetType === 'CATEGORY' && discount.categoryId === student.studentCategoryId) ||
          (discount.targetType === 'FEE_TYPE' && discount.feeTypeId === master.feeTypeId) ||
          (discount.targetType === 'FEE_GROUP' && discount.feeGroupId === master.feeGroupId) ||
          (discount.targetType === 'FEE_MASTER' && discount.feeMasterId === master.id)) {
        const value = toAmount(discount.amount ?? discount.value);
        return discountSum + (discount.valueType === 'PERCENTAGE' ? (masterAnnualAmount * value) / 100 : value);
      }
      return discountSum;
    }, 0);
    return sum + Math.min(masterDiscount, masterAnnualAmount);
  }, 0);
  const discountLabel = discounts.length
    ? `Discount (${discounts.map((discount) => discount.discountName || discount.code || 'Selected discount').join(', ')})`
    : 'Discount';
  const feeTableRows = [
    ...feeRows,
    ...(discountTotal > 0 ? [[discountLabel, `-${formatMoney(discountTotal)}`, `-${formatMoney(discountTotal)}`]] : []),
    ['Total payable', '', formatMoney(Math.max(feeSubTotal - discountTotal, 0))],
  ];
  const transportRows = student.transportAssignments.map((assignment) => [
    assignment.vehicle
      ? `${assignment.route.title} - Vehicle ${assignment.vehicle.vehicleNumber}, Driver ${assignment.vehicle.driverName} (${assignment.vehicle.driverContact})`
      : `${assignment.route.title} - ${assignment.note || 'Transport assigned'}`,
    formatMoney(assignment.route.fare),
  ]);
  const libraryRows = student.libraryMemberships.map((member) => [
    `${member.memberCode} - ${member.fullName} (${member.memberType})`,
    'Not provided',
  ]);
  const dormitoryRows = student.dormitoryAssignments.map(
    (assignment) => [
      `${assignment.dormitory.name} (${assignment.dormitory.type})${
        assignment.room ? `, Room ${assignment.room.roomNumber}` : ''
      }`,
      assignment.room ? formatMoney(assignment.room.costPerBed) : 'Not provided',
    ],
  );

  const bodyLines = [
    `Dear ${parentName},`,
    '',
    `${student.fullName} has been added to ${schoolName}. Your parent account details are below.`,
    '',
    `Login email: ${loginEmail}`,
    params.tempPassword ? `Temporary password: ${params.tempPassword}` : 'Password: Use your existing parent account password.',
    '',
    `Student: ${student.fullName}`,
    `Admission No: ${student.admissionNo}`,
    `Admission Date: ${formatDate(student.admissionDate)}`,
    `Academic Session: ${text(student.academicSession?.name)}`,
    `Class: ${text(student.class?.name)}`,
    `Section: ${text(student.section?.name)}`,
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <p>Dear ${escapeHtml(parentName)},</p>
      <p><strong>${escapeHtml(student.fullName)}</strong> has been added to <strong>${escapeHtml(
        schoolName,
      )}</strong>. Your parent account details are below.</p>
      ${section(
        'Parent App Login',
        row('Login email', loginEmail) +
          row('Temporary password', params.tempPassword || 'Use your existing parent account password'),
      )}
      ${section(
        'Admission Details',
        row('Student profile', student.fullName) +
          row('Admission number', student.admissionNo) +
          row('Admission date', formatDate(student.admissionDate)) +
          row('Academic session', student.academicSession?.name) +
          row('Class', student.class?.name) +
          row('Section', student.section?.name) +
          row('Roll number', student.rollNo),
      )}
      ${section(
        'Personal Details',
        row('Date of birth', formatDate(student.dob)) +
          row('Gender', student.gender) +
          row('Blood group', student.bloodGroup) +
          row('Religion', student.religion) +
          row('Caste', student.caste) +
          row('Category', student.category) +
          row('Student email', student.email) +
          row('Student phone', student.phone),
      )}
      ${section(
        'Address & Emergency',
        row('Present address', student.presentAddress) +
          row('Permanent address', student.permanentAddress) +
          row('Address line 1', student.addressLine1) +
          row('Address line 2', student.addressLine2) +
          row('City', student.city) +
          row('State', student.state) +
          row('Pincode', student.pincode) +
          row('Emergency contact', student.emergencyContact),
      )}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Fees</h2>
      ${detailTable(['Description', 'Amount', 'Annual Amount'], feeTableRows)}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Transport</h2>
      ${detailTable(['Description', 'Amount'], transportRows)}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Library</h2>
      ${detailTable(['Description', 'Amount'], libraryRows)}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Dormitory</h2>
      ${detailTable(['Description', 'Amount'], dormitoryRows)}
    </div>
  `;

  try {
    return await sendNotification({
      schoolId: params.schoolId,
      userId: parent.userId ?? null,
      channel: 'EMAIL',
      data: {
        to: recipient,
        subject,
        body: bodyLines.join('\n'),
        html,
        emailIntent: 'PARENT_COMMUNICATION',
        module: 'students',
        category: 'student_admission',
        alertType: 'STUDENT_ADMISSION',
        childId: student.id,
        childName: student.fullName,
        parentId: parent.id,
      },
    });
  } catch (error) {
    logger.warn(
      { err: error, schoolId: params.schoolId, studentId: params.studentId, parentId: params.parentId },
      'student admission account email failed',
    );
    return null;
  }
};
