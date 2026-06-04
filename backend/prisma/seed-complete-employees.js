const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SCHOOL_CODE = process.env.SEED_SCHOOL_CODE || 'DKS_00002';
const DEFAULT_PASSWORD = process.env.SEED_EMPLOYEE_PASSWORD || 'School@12345';

const staffRoles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];
const employeeNoPrefix = {
  SCHOOL_ADMIN: 'ADM',
  TEACHER: 'TCH',
  ACCOUNTANT: 'ACC',
  LIBRARIAN: 'LIB',
  STAFF: 'STF',
};
const roleLeaveDays = {
  SCHOOL_ADMIN: { 'Casual Leave': 15, 'Sick Leave': 10, 'Earned Leave': 18, 'Emergency Leave': 3 },
  TEACHER: { 'Casual Leave': 12, 'Sick Leave': 10, 'Earned Leave': 15, 'Emergency Leave': 3 },
  ACCOUNTANT: { 'Casual Leave': 12, 'Sick Leave': 10, 'Earned Leave': 15, 'Emergency Leave': 3 },
  LIBRARIAN: { 'Casual Leave': 12, 'Sick Leave': 10, 'Earned Leave': 15, 'Emergency Leave': 3 },
  STAFF: { 'Casual Leave': 10, 'Sick Leave': 8, 'Earned Leave': 12, 'Emergency Leave': 3 },
};

const nonTeachingEmployees = [
  { roleName: 'ACCOUNTANT', department: 'Accounts', designation: 'Accountant', firstName: 'Arun', lastName: 'Kumar', gender: 'Male', salary: 42000 },
  { roleName: 'ACCOUNTANT', department: 'Accounts', designation: 'Accountant', firstName: 'Meena', lastName: 'Prakash', gender: 'Female', salary: 40000 },
  { roleName: 'ACCOUNTANT', department: 'Accounts', designation: 'Fee Clerk', firstName: 'Suresh', lastName: 'Babu', gender: 'Male', salary: 32000 },
  { roleName: 'ACCOUNTANT', department: 'Accounts', designation: 'Fee Clerk', firstName: 'Revathi', lastName: 'Mani', gender: 'Female', salary: 31000 },
  { roleName: 'LIBRARIAN', department: 'Library', designation: 'Librarian', firstName: 'Lakshmi', lastName: 'Narayanan', gender: 'Female', salary: 36000 },
  { roleName: 'LIBRARIAN', department: 'Library', designation: 'Assistant Librarian', firstName: 'Farhan', lastName: 'Ahmed', gender: 'Male', salary: 30000 },
  { roleName: 'LIBRARIAN', department: 'Library', designation: 'Assistant Librarian', firstName: 'Nandhini', lastName: 'Ravi', gender: 'Female', salary: 29500 },
  { roleName: 'STAFF', department: 'Transport', designation: 'Driver', firstName: 'Ramesh', lastName: 'Moorthy', gender: 'Male', salary: 28000, driving: true },
  { roleName: 'STAFF', department: 'Transport', designation: 'Driver', firstName: 'Karthik', lastName: 'Rajan', gender: 'Male', salary: 27500, driving: true },
  { roleName: 'STAFF', department: 'Transport', designation: 'Driver', firstName: 'Manikandan', lastName: 'Velu', gender: 'Male', salary: 27000, driving: true },
  { roleName: 'STAFF', department: 'Transport', designation: 'Transport Incharge', firstName: 'Pradeep', lastName: 'Kumar', gender: 'Male', salary: 38000, driving: true },
  { roleName: 'STAFF', department: 'Administration', designation: 'Receptionist', firstName: 'Priya', lastName: 'Sankar', gender: 'Female', salary: 30000 },
  { roleName: 'STAFF', department: 'Administration', designation: 'Receptionist', firstName: 'Keerthana', lastName: 'Mohan', gender: 'Female', salary: 29500 },
  { roleName: 'STAFF', department: 'Administration', designation: 'Office Assistant', firstName: 'Dinesh', lastName: 'Gopal', gender: 'Male', salary: 26000 },
  { roleName: 'STAFF', department: 'Administration', designation: 'Office Assistant', firstName: 'Sathya', lastName: 'Devi', gender: 'Female', salary: 25500 },
  { roleName: 'STAFF', department: 'Health & Safety', designation: 'Nurse', firstName: 'Anitha', lastName: 'Joseph', gender: 'Female', salary: 35000 },
  { roleName: 'STAFF', department: 'Health & Safety', designation: 'Nurse', firstName: 'Mary', lastName: 'Thomas', gender: 'Female', salary: 34500 },
  { roleName: 'STAFF', department: 'Operations', designation: 'Security Guard', firstName: 'Baskar', lastName: 'Selvam', gender: 'Male', salary: 25000 },
  { roleName: 'STAFF', department: 'Operations', designation: 'Security Guard', firstName: 'Murugan', lastName: 'Pandi', gender: 'Male', salary: 24800 },
  { roleName: 'STAFF', department: 'Operations', designation: 'Security Guard', firstName: 'Vijay', lastName: 'Raghavan', gender: 'Male', salary: 24800 },
  { roleName: 'STAFF', department: 'Support', designation: 'IT Support', firstName: 'Naveen', lastName: 'Raj', gender: 'Male', salary: 37000 },
  { roleName: 'STAFF', department: 'Support', designation: 'IT Support', firstName: 'Divya', lastName: 'Srinivasan', gender: 'Female', salary: 36500 },
  { roleName: 'STAFF', department: 'Support', designation: 'Lab Assistant', firstName: 'Saravanan', lastName: 'K', gender: 'Male', salary: 28500 },
  { roleName: 'STAFF', department: 'Support', designation: 'Lab Assistant', firstName: 'Janani', lastName: 'Ramesh', gender: 'Female', salary: 28500 },
  { roleName: 'STAFF', department: 'Operations', designation: 'Hostel Warden', firstName: 'Geetha', lastName: 'Balaji', gender: 'Female', salary: 33000 },
  { roleName: 'STAFF', department: 'Operations', designation: 'Hostel Warden', firstName: 'Mohan', lastName: 'Dass', gender: 'Male', salary: 33000 },
  { roleName: 'STAFF', department: 'Operations', designation: 'Office Assistant', firstName: 'Selvi', lastName: 'Rani', gender: 'Female', salary: 24500 },
  { roleName: 'STAFF', department: 'Support', designation: 'IT Support', firstName: 'Harish', lastName: 'Kannan', gender: 'Male', salary: 36000 },
  { roleName: 'STAFF', department: 'Transport', designation: 'Driver', firstName: 'Senthil', lastName: 'Nathan', gender: 'Male', salary: 27000, driving: true },
  { roleName: 'STAFF', department: 'Administration', designation: 'Receptionist', firstName: 'Pavithra', lastName: 'Kumar', gender: 'Female', salary: 29200 },
];

const date = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const cleanCodePart = (value) => {
  const cleaned = String(value || 'SCH').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10);
  return cleaned || 'SCH';
};

const avatarUrl = (name, index) => {
  const palettes = ['7c3aed', '0891b2', '0f766e', 'be123c', '1d4ed8', 'c2410c'];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${palettes[index % palettes.length]}&color=fff&bold=true`;
};

const employeeEmail = (firstName, lastName) => `dummy.${slug(`${firstName}-${lastName}`)}@dks.local`;

const relationName = (gender, lastName, index, parent) => {
  const fatherNames = ['Raman', 'Muthu', 'Ganesan', 'Joseph', 'Kumar', 'Sivakumar', 'Prakash', 'Sundar'];
  const motherNames = ['Kala', 'Jaya', 'Mary', 'Valli', 'Radha', 'Latha', 'Devi', 'Amudha'];
  const names = parent === 'father' ? fatherNames : motherNames;
  return `${names[index % names.length]} ${lastName}`;
};

const roleRecord = async (roleName) =>
  prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName },
  });

const generateEmployeeNo = async (school, roleName) => {
  const codePart = cleanCodePart(school.code);
  const prefix = employeeNoPrefix[roleName] || 'EMP';
  const existingCount = await prisma.teacherProfile.count({ where: { schoolId: school.id } });

  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = `${codePart}-${prefix}-${String(existingCount + attempt).padStart(4, '0')}`;
    const exists = await prisma.teacherProfile.findFirst({ where: { schoolId: school.id, employeeNo: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }

  return `${codePart}-${prefix}-${Date.now().toString().slice(-8)}`;
};

const buildProfile = ({ school, employee, index, departmentId, designationId, employeeNo }) => {
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const phoneSeed = String(9840000000 + index).slice(0, 10);
  const emergencySeed = String(9440000000 + index).slice(0, 10);
  const addressLine = `${12 + index}, ${employee.department} Block, Anna Salai, Chennai 6000${String(index % 10).padStart(1, '0')}`;
  return {
    schoolId: school.id,
    roleName: employee.roleName,
    employeeNo,
    firstName: employee.firstName,
    lastName: employee.lastName,
    departmentId,
    designationId,
    fatherName: relationName(employee.gender, employee.lastName, index, 'father'),
    motherName: relationName(employee.gender, employee.lastName, index, 'mother'),
    gender: employee.gender,
    dateOfBirth: date(1981 + (index % 17), (index % 12) + 1, (index % 24) + 1),
    dateOfJoining: date(2017 + (index % 8), ((index + 3) % 12) + 1, ((index + 9) % 24) + 1),
    phone: `+91${phoneSeed}`,
    emergencyMobile: `+91${emergencySeed}`,
    photoUrl: avatarUrl(fullName, index),
    drivingLicense: employee.driving ? `TN-${String(10 + index).padStart(2, '0')}-${String(2000000 + index)}` : `NA-${slug(fullName).toUpperCase()}`,
    address: addressLine,
    currentAddress: addressLine,
    permanentAddress: `${21 + index}, Native Street, ${index % 2 ? 'Madurai' : 'Coimbatore'}, Tamil Nadu`,
    qualifications:
      employee.roleName === 'ACCOUNTANT'
        ? 'B.Com, Tally ERP, school finance operations'
        : employee.roleName === 'LIBRARIAN'
          ? 'B.Lib.Sc, catalog management, digital library tools'
          : employee.designation === 'Driver'
            ? 'Valid heavy vehicle license, school transport safety training'
            : 'Higher secondary qualification, institutional operations training',
    experience: `${3 + (index % 12)} years of relevant school administration experience`,
    maritalStatus: index % 3 === 0 ? 'Single' : 'Married',
    isActive: true,
  };
};

const syncBankPayrollLeave = async ({ staff, employee, index, leaveTypes }) => {
  const fullName = `${staff.firstName} ${staff.lastName}`;
  const accountSeed = String(510000000000 + index);
  await prisma.teacherBankDetails.upsert({
    where: { teacherId: staff.id },
    create: {
      teacherId: staff.id,
      accountHolderName: fullName,
      accountNumber: accountSeed,
      ifscCode: `DKSB000${String(index % 99).padStart(2, '0')}`,
      accountType: 'Savings',
      bankName: 'DKS Cooperative Bank',
      branchName: `${employee.department || staff.department?.name || 'Main'} Branch`,
      panNumber: `DKS${String(1000 + index)}A`,
    },
    update: {
      accountHolderName: fullName,
      accountNumber: accountSeed,
      ifscCode: `DKSB000${String(index % 99).padStart(2, '0')}`,
      accountType: 'Savings',
      bankName: 'DKS Cooperative Bank',
      branchName: `${employee.department || staff.department?.name || 'Main'} Branch`,
      panNumber: `DKS${String(1000 + index)}A`,
    },
  });

  await prisma.staffPayrollInfo.upsert({
    where: { staffId: staff.id },
    create: {
      staffId: staff.id,
      epfNo: `EPF-DKS-${String(index + 1).padStart(4, '0')}`,
      basicSalary: employee.salary,
      contractType: employee.contractType || 'Full Time',
      paymentMode: 'Bank Transfer',
    },
    update: {
      epfNo: `EPF-DKS-${String(index + 1).padStart(4, '0')}`,
      basicSalary: employee.salary,
      contractType: employee.contractType || 'Full Time',
      paymentMode: 'Bank Transfer',
    },
  });

  for (const leaveType of leaveTypes) {
    const totalDays = roleLeaveDays[staff.roleName]?.[leaveType.name] ?? leaveType.totalDays;
    await prisma.leaveBalance.upsert({
      where: { schoolId_staffId_leaveTypeId: { schoolId: staff.schoolId, staffId: staff.id, leaveTypeId: leaveType.id } },
      create: {
        schoolId: staff.schoolId,
        staffId: staff.id,
        leaveTypeId: leaveType.id,
        totalDays,
        usedDays: index % 3,
        extraTakenDays: 0,
      },
      update: {
        totalDays,
        usedDays: index % 3,
        extraTakenDays: 0,
      },
    });
  }
};

const syncSocialLinks = async (staff, index) => {
  const fullName = `${staff.firstName} ${staff.lastName}`;
  const staffSlug = slug(`${staff.employeeNo}-${fullName}`);
  await prisma.staffSocialLink.deleteMany({ where: { staffId: staff.id } });
  await prisma.staffSocialLink.createMany({
    data: [
      { staffId: staff.id, platform: 'Profile', url: `https://example.com/dks/staff/${staffSlug}` },
      { staffId: staff.id, platform: 'LinkedIn', url: `https://www.linkedin.com/in/${staffSlug}-${index}` },
    ],
  });
};

const ensureOfferLetter = async ({ school, staff, adminId }) => {
  const existing = await prisma.staffDocument.findFirst({
    where: { schoolId: school.id, staffId: staff.id, title: 'Offer Letter' },
    select: { id: true },
  });
  if (existing) {
    await prisma.staffDocument.update({
      where: { id: existing.id },
      data: {
        fileUrl: `/dashboard/staff/${staff.id}/offer-letter`,
        fileName: `${slug(staff.employeeNo || staff.id)}-offer-letter.html`,
        fileType: 'text/html',
      },
    });
    return false;
  }
  await prisma.staffDocument.create({
    data: {
      schoolId: school.id,
      staffId: staff.id,
      title: 'Offer Letter',
      fileUrl: `/dashboard/staff/${staff.id}/offer-letter`,
      fileName: `${slug(staff.employeeNo || staff.id)}-offer-letter.html`,
      fileType: 'text/html',
      uploadedById: adminId,
    },
  });
  return true;
};

const ensureTimeline = async ({ school, staff, adminId, index }) => {
  const items = [
    {
      title: 'Appointment Created',
      description: `Employee profile, login role, payroll, bank details, leave balance, and offer letter were seeded for ${staff.firstName} ${staff.lastName}.`,
      timelineAt: date(2026, 6, 1 + (index % 20)),
    },
    {
      title: 'Documents Verified',
      description: 'Identity, address, qualification, and bank details marked as verified for demo HR workflow.',
      timelineAt: date(2026, 6, 2 + (index % 20)),
    },
  ];

  for (const item of items) {
    const exists = await prisma.staffTimeline.findFirst({
      where: { schoolId: school.id, staffId: staff.id, title: item.title },
      select: { id: true },
    });
    if (!exists) {
      await prisma.staffTimeline.create({
        data: { schoolId: school.id, staffId: staff.id, createdById: adminId, ...item },
      });
    }
  }
};

const upsertNonTeachingEmployee = async ({ school, adminId, departments, designations, leaveTypes, employee, index, passwordHash }) => {
  const departmentId = departments.get(employee.department);
  const designationId = designations.get(employee.designation);
  if (!departmentId || !designationId) {
    throw new Error(`Missing setup for ${employee.department} / ${employee.designation}`);
  }

  const email = employeeEmail(employee.firstName, employee.lastName);
  const role = await roleRecord(employee.roleName);
  let user = await prisma.user.findUnique({ where: { schoolId_email: { schoolId: school.id, email } }, select: { id: true } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, status: 'ACTIVE', mustChangePassword: false },
      select: { id: true },
    });
  } else {
    user = await prisma.user.create({
      data: {
        schoolId: school.id,
        email,
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
      select: { id: true },
    });
  }

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  const existingProfile = await prisma.teacherProfile.findUnique({ where: { userId: user.id }, select: { employeeNo: true } });
  const employeeNo = existingProfile?.employeeNo || (await generateEmployeeNo(school, employee.roleName));
  const profileData = buildProfile({ school, employee, index, departmentId, designationId, employeeNo });
  const staff = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    create: { ...profileData, userId: user.id },
    update: profileData,
  });

  await syncBankPayrollLeave({ staff, employee, index, leaveTypes });
  await syncSocialLinks(staff, index);
  const newOffer = await ensureOfferLetter({ school, staff, adminId });
  await ensureTimeline({ school, staff, adminId, index });

  return { created: !existingProfile, offerCreated: newOffer };
};

const enrichExistingTeachers = async ({ school, adminId, departments, designations, leaveTypes }) => {
  const academicsId = departments.get('Academics');
  const teacherId = designations.get('Teacher');
  const seniorTeacherId = designations.get('Senior Teacher') || teacherId;
  if (!academicsId || !teacherId) throw new Error('Academic teacher setup is missing');

  const teachers = await prisma.teacherProfile.findMany({
    where: { schoolId: school.id, roleName: 'TEACHER' },
    orderBy: { employeeNo: 'asc' },
  });
  let offerCreated = 0;

  for (const [index, teacher] of teachers.entries()) {
    const employeeNo = teacher.employeeNo || (await generateEmployeeNo(school, 'TEACHER'));
    const salary = 43000 + (index % 8) * 2500;
    const profileData = buildProfile({
      school,
      employee: {
        roleName: 'TEACHER',
        department: 'Academics',
        designation: index % 5 === 0 ? 'Senior Teacher' : 'Teacher',
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        gender: index % 2 === 0 ? 'Female' : 'Male',
        salary,
        contractType: 'Full Time',
      },
      index,
      departmentId: academicsId,
      designationId: index % 5 === 0 ? seniorTeacherId : teacherId,
      employeeNo,
    });

    const updated = await prisma.teacherProfile.update({
      where: { id: teacher.id },
      data: profileData,
    });
    await syncBankPayrollLeave({
      staff: updated,
      employee: { department: 'Academics', salary, contractType: 'Full Time' },
      index,
      leaveTypes,
    });
    await syncSocialLinks(updated, index);
    if (await ensureOfferLetter({ school, staff: updated, adminId })) offerCreated += 1;
    await ensureTimeline({ school, staff: updated, adminId, index });
  }

  return { updated: teachers.length, offerCreated };
};

const main = async () => {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE }, select: { id: true, code: true, name: true } });
  if (!school) throw new Error(`School ${SCHOOL_CODE} was not found`);

  const admin = await prisma.user.findFirst({
    where: { schoolId: school.id, roles: { some: { role: { name: 'SCHOOL_ADMIN' } } } },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error(`School admin was not found for ${SCHOOL_CODE}`);

  const [departmentRows, designationRows, leaveTypes] = await Promise.all([
    prisma.department.findMany({ where: { schoolId: school.id }, select: { id: true, name: true } }),
    prisma.designation.findMany({ where: { schoolId: school.id }, select: { id: true, name: true } }),
    prisma.leaveType.findMany({ where: { schoolId: school.id, isActive: true }, select: { id: true, name: true, totalDays: true } }),
  ]);
  const departments = new Map(departmentRows.map((row) => [row.name, row.id]));
  const designations = new Map(designationRows.map((row) => [row.name, row.id]));
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const teacherResult = await enrichExistingTeachers({ school, adminId: admin.id, departments, designations, leaveTypes });
  let created = 0;
  let updated = 0;
  let offerCreated = teacherResult.offerCreated;

  for (const [index, employee] of nonTeachingEmployees.entries()) {
    const result = await upsertNonTeachingEmployee({
      school,
      adminId: admin.id,
      departments,
      designations,
      leaveTypes,
      employee,
      index: index + 100,
      passwordHash,
    });
    if (result.created) created += 1;
    else updated += 1;
    if (result.offerCreated) offerCreated += 1;
  }

  const staffByRole = await prisma.teacherProfile.groupBy({
    by: ['roleName'],
    where: { schoolId: school.id },
    _count: { _all: true },
    orderBy: { roleName: 'asc' },
  });
  const completeProfiles = await prisma.teacherProfile.count({
    where: {
      schoolId: school.id,
      departmentId: { not: null },
      designationId: { not: null },
      fatherName: { not: null },
      motherName: { not: null },
      phone: { not: null },
      emergencyMobile: { not: null },
      currentAddress: { not: null },
      permanentAddress: { not: null },
      qualifications: { not: null },
      payrollInfo: { isNot: null },
      bankDetails: { isNot: null },
    },
  });
  const offerLetters = await prisma.staffDocument.count({ where: { schoolId: school.id, title: 'Offer Letter' } });

  console.log(JSON.stringify({
    school: school.code,
    defaultPassword: DEFAULT_PASSWORD,
    teachersBackfilled: teacherResult.updated,
    nonTeachingCreated: created,
    nonTeachingUpdated: updated,
    offerLettersCreatedThisRun: offerCreated,
    completeProfiles,
    offerLetters,
    staffByRole,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
