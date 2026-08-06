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

export const sendStudentAdmissionAccountEmail = async (params: {
  schoolId: string;
  studentId: string;
  parentId: string;
  tempPassword?: string | null;
}) => {
  const [student, parent] = await Promise.all([
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
  ]);

  if (!student || !parent) return null;

  const recipient = optionalText(parent.email);
  if (!recipient || recipient.endsWith('@parent.local')) return null;

  const parentName = `${parent.firstName} ${parent.lastName}`.trim() || 'Parent';
  const loginEmail = optionalText(parent.user?.email) ?? recipient;
  const schoolName = student.school.name || 'School';
  const subject = `Parent account created for ${student.fullName}`;

  const feeRows = student.feeGroupAssignments.flatMap((assignment) =>
    assignment.feeGroup.masters.map((master) => [
      master.code,
      master.description || master.name,
      formatMoney(master.amount),
    ]),
  );
  const transportRows = student.transportAssignments.map((assignment) => [
    assignment.route.title,
    assignment.vehicle
      ? `Vehicle ${assignment.vehicle.vehicleNumber}, Driver ${assignment.vehicle.driverName} (${assignment.vehicle.driverContact})`
      : assignment.note || 'Transport assigned',
    formatMoney(assignment.route.fare),
  ]);
  const libraryRows = student.libraryMemberships.map((member) => [
    member.memberCode,
    `${member.fullName} (${member.memberType})`,
    'Not provided',
  ]);
  const dormitoryRows = student.dormitoryAssignments.map(
    (assignment) => [
      assignment.dormitory.name,
      `${assignment.dormitory.type}${assignment.room ? `, Room ${assignment.room.roomNumber}` : ''}`,
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
      ${detailTable(['Slug', 'Description', 'Amount'], feeRows)}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Transport</h2>
      ${detailTable(['Slug', 'Description', 'Amount'], transportRows)}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Library</h2>
      ${detailTable(['Slug', 'Description', 'Amount'], libraryRows)}
      <h2 style="margin:24px 0 10px;font-size:18px;color:#0f172a;">Dormitory</h2>
      ${detailTable(['Slug', 'Description', 'Amount'], dormitoryRows)}
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
