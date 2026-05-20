import 'dotenv/config';
import { PrismaClient, type Prisma, type RoleName } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const DEMO_SCHOOL_CODE = 'DEMO001';
const DEMO_PASSWORD = 'Password@123';
const LOGIN_EXPERIENCE_KEY = 'login.experience';

const ROLE_NAMES: RoleName[] = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'ACCOUNTANT',
  'LIBRARIAN',
  'STAFF',
  'PARENT',
];

const PERMISSION_CATALOG = [
  { code: 'dashboard.overview', description: 'Dashboard overview access' },
  { code: 'plans.view', description: 'Subscription plan access' },
  { code: 'settings.access', description: 'Access control settings' },
  { code: 'teachers.list', description: 'Employee list access' },
  { code: 'teachers.add', description: 'Employee creation access' },
  { code: 'academics.setup', description: 'Academic setup access' },
  { code: 'academics.exams', description: 'Exam management access' },
  { code: 'academics.marks', description: 'Marks upload access' },
  { code: 'students.list', description: 'Student list access' },
  { code: 'students.add', description: 'Student creation access' },
  { code: 'idcards.view', description: 'ID card access' },
  { code: 'students.transfers', description: 'Student transfer access' },
  { code: 'attendance.view', description: 'Attendance access' },
  { code: 'attendance.substitute.manage', description: 'Attendance substitution access' },
  { code: 'support.view', description: 'Support access' },
  { code: 'audit.view', description: 'Audit log access' },
];

const allPermissionCodes = PERMISSION_CATALOG.map((permission) => permission.code);

const DEFAULT_ROLE_PERMISSION_CODES: Record<RoleName, string[]> = {
  SUPER_ADMIN: allPermissionCodes,
  SCHOOL_ADMIN: allPermissionCodes,
  TEACHER: [
    'dashboard.overview',
    'academics.setup',
    'academics.exams',
    'academics.marks',
    'students.list',
    'idcards.view',
    'attendance.view',
    'support.view',
    'plans.view',
  ],
  ACCOUNTANT: ['dashboard.overview', 'students.list', 'idcards.view', 'support.view', 'plans.view'],
  LIBRARIAN: ['dashboard.overview', 'students.list', 'idcards.view', 'support.view', 'plans.view'],
  STAFF: ['dashboard.overview', 'students.list', 'idcards.view', 'support.view', 'plans.view'],
  PARENT: ['dashboard.overview', 'support.view'],
};

const platformLoginExperience = {
  brandName: 'SchoolApp Demo',
  appName: 'School Management System',
  consoleName: 'Admin Console',
  headline: 'Choose your login type',
  subtitle: 'Select your account type and continue with the correct sign in flow.',
  loginHeading: 'Welcome back',
  loginSubtitle: 'Sign in with your demo account to continue.',
  leftPanelTitle: 'Manage every school workflow from one secure portal',
  leftPanelDescription:
    'Academics, attendance, exams, fees, employees, parents, and communication stay connected in one workspace.',
  features: [
    'Multi-school and role-based access',
    'Attendance, exams, and marks',
    'Parent, teacher, and staff portals',
    'Secure sessions with audit logging',
  ],
  securityNote: 'Your session is protected with secure httpOnly cookies.',
  footerText: '(c) 2026 School Management System. All rights reserved.',
  supportText: 'Need help? Contact your school administrator.',
  forgotPasswordText: 'Forgot password?',
  loginButtonText: 'Sign in',
  supportUrl: 'https://techstageit.com/#contact',
  logoUrl: '/branding/demo-school-logo.svg',
  backgroundImageUrl: '/branding/demo-login-background.svg',
  illustrationUrl: '/branding/demo-login-illustration.svg',
  backgroundType: 'gradient',
  leftPanelEnabled: true,
  theme: {
    primaryColor: '#1d4ed8',
    secondaryColor: '#0f172a',
    accentColor: '#16a34a',
    backgroundColor: '#f8fafc',
    panelColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    borderColor: '#dbe4ee',
    buttonBackgroundColor: '#1d4ed8',
    buttonTextColor: '#ffffff',
    linkColor: '#1d4ed8',
    errorColor: '#dc2626',
    successColor: '#16a34a',
  },
  loginTypes: [
    {
      id: 'admin',
      label: 'Admin',
      description: 'Super admin and school administrator access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: false,
      schoolIdOptional: true,
    },
    {
      id: 'staff',
      label: 'Staff',
      description: 'Office, accountant, librarian, and support staff access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: true,
    },
    {
      id: 'teacher',
      label: 'Teacher',
      description: 'Class, attendance, timetable, exam, and marks access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: true,
    },
    {
      id: 'student',
      label: 'Student',
      description: 'Student record and dashboard demo data',
      enabled: false,
      authMode: 'password',
      requiresSchoolId: true,
      unavailableMessage: 'Student login is not enabled by the current backend schema yet.',
    },
    {
      id: 'parent',
      label: 'Parent',
      description: 'Parent portal access for linked students',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: false,
      schoolIdOptional: true,
    },
  ],
} satisfies Prisma.InputJsonObject;

const demoLoginThemeTokens = {
  appName: 'Demo School Portal',
  schoolName: 'Demo Public School',
  logoUrl: '/branding/demo-school-logo.svg',
  loginLogoUrl: '/branding/demo-school-logo.svg',
  darkLogoUrl: '/branding/demo-school-logo.svg',
  compactLogoUrl: '/branding/demo-school-compact-logo.svg',
  faviconUrl: '/branding/demo-school-favicon.svg',
  loginHeading: 'Welcome back',
  loginSubtitle: 'Use your demo account to explore the school dashboard.',
  leftPanelTitle: 'Demo Public School command center',
  leftPanelDescription:
    'A complete sample tenant with admins, staff, teachers, parents, students, classes, subjects, and branding.',
  features: [
    'School admin, staff, teacher, and parent demo accounts',
    'Grade 10 class, section, subjects, and teacher assignments',
    'Linked parent and student profile with complete details',
    'Published theme tokens for dynamic login branding',
  ],
  securityNote: 'Demo sessions still use secure httpOnly cookies and 2FA where required.',
  footerText: '(c) 2026 Demo Public School. Powered by School Management System.',
  supportText: 'Need help? Contact support@demo.school.',
  forgotPasswordText: 'Forgot password?',
  loginButtonText: 'Sign in to portal',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  accentColor: '#16a34a',
  backgroundColor: '#f8fafc',
  cardBackgroundColor: '#ffffff',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
  borderColor: '#dbe4ee',
  buttonBg: '#1d4ed8',
  buttonText: '#ffffff',
  navbarBg: '#0f172a',
  headerBg: 'linear-gradient(135deg, #1d4ed8, #16a34a)',
  footerBg: '#0f172a',
  linkColor: '#1d4ed8',
  errorColor: '#dc2626',
  successColor: '#16a34a',
  loginPrimaryColor: '#1d4ed8',
  loginSecondaryColor: '#0f172a',
  loginAccentColor: '#16a34a',
  loginBackgroundColor: '#f8fafc',
  loginCardBackgroundColor: '#ffffff',
  loginTextColor: '#0f172a',
  loginMutedTextColor: '#64748b',
  loginBorderColor: '#dbe4ee',
  loginButtonColor: '#1d4ed8',
  loginButtonTextColor: '#ffffff',
  loginLinkColor: '#1d4ed8',
  loginFocusRingColor: '#2563eb',
  loginErrorColor: '#dc2626',
  loginSuccessColor: '#16a34a',
  loginBackgroundType: 'gradient',
  loginBackgroundImageUrl: '/branding/demo-login-background.svg',
  loginGradientFrom: '#dbeafe',
  loginGradientTo: '#f8fafc',
  loginBorderRadius: '22px',
  loginCardShadow: '0 24px 70px rgba(15, 23, 42, 0.14)',
  loginLogoSize: '60px',
  loginIllustrationUrl: '/branding/demo-login-illustration.svg',
  leftPanelEnabled: true,
} satisfies Prisma.InputJsonObject;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const mergeLoginTypes = (existing: unknown) => {
  if (!Array.isArray(existing)) {
    return platformLoginExperience.loginTypes;
  }

  return platformLoginExperience.loginTypes.map((fallback) => {
    const saved = existing.find((item) => isRecord(item) && item.id === fallback.id);
    return isRecord(saved) ? { ...fallback, ...saved, id: fallback.id } : fallback;
  });
};

const mergeLoginExperience = (existing: unknown): Prisma.InputJsonValue => {
  if (!isRecord(existing)) {
    return platformLoginExperience;
  }

  const existingTheme = isRecord(existing.theme) ? existing.theme : {};
  return {
    ...platformLoginExperience,
    ...existing,
    theme: {
      ...platformLoginExperience.theme,
      ...existingTheme,
    },
    loginTypes: mergeLoginTypes(existing.loginTypes),
  } as Prisma.InputJsonObject;
};

const upsertRoles = async () => {
  const roles = new Map<RoleName, { id: string; name: RoleName }>();

  for (const name of ROLE_NAMES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
      select: { id: true, name: true },
    });
    roles.set(role.name, role);
  }

  return roles;
};

const upsertPermissions = async () => {
  const permissions = new Map<string, { id: string; code: string }>();

  for (const item of PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { code: item.code },
      update: { description: item.description },
      create: item,
      select: { id: true, code: true },
    });
    permissions.set(permission.code, permission);
  }

  return permissions;
};

const attachRolePermissions = async (
  roles: Map<RoleName, { id: string; name: RoleName }>,
  permissions: Map<string, { id: string; code: string }>,
) => {
  for (const roleName of ROLE_NAMES) {
    const role = roles.get(roleName);
    if (!role) continue;

    for (const code of DEFAULT_ROLE_PERMISSION_CODES[roleName]) {
      const permission = permissions.get(code);
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
};

const attachEmployeeRolePermissions = async (schoolId: string) => {
  const employeeRoles: RoleName[] = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

  for (const roleName of employeeRoles) {
    const enabledCodes = new Set(DEFAULT_ROLE_PERMISSION_CODES[roleName]);

    for (const code of allPermissionCodes) {
      await prisma.employeeRolePermission.upsert({
        where: {
          schoolId_roleName_permissionCode: {
            schoolId,
            roleName,
            permissionCode: code,
          },
        },
        update: { enabled: enabledCodes.has(code) },
        create: {
          schoolId,
          roleName,
          permissionCode: code,
          enabled: enabledCodes.has(code),
        },
      });
    }
  }
};

const upsertUser = async (params: {
  schoolId: string | null;
  email: string;
  passwordHash: string;
  roleName: RoleName;
  mfaEnabled?: boolean;
  mfaMethod?: string | null;
  mustChangePassword?: boolean;
}) => {
  const existing = await prisma.user.findFirst({
    where: {
      schoolId: params.schoolId,
      email: { equals: params.email, mode: 'insensitive' },
    },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: params.email,
          passwordHash: params.passwordHash,
          status: 'ACTIVE',
          mustChangePassword: params.mustChangePassword ?? false,
          mfaEnabled: params.mfaEnabled ?? false,
          mfaMethod: params.mfaMethod ?? null,
        },
      })
    : await prisma.user.create({
        data: {
          schoolId: params.schoolId,
          email: params.email,
          passwordHash: params.passwordHash,
          status: 'ACTIVE',
          mustChangePassword: params.mustChangePassword ?? false,
          mfaEnabled: params.mfaEnabled ?? false,
          mfaMethod: params.mfaMethod ?? null,
        },
      });

  const role = await prisma.role.findUniqueOrThrow({ where: { name: params.roleName } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return user;
};

const upsertEmployeeProfile = async (params: {
  schoolId: string;
  userId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}) => {
  const profile = await prisma.teacherProfile.upsert({
    where: { userId: params.userId },
    update: {
      schoolId: params.schoolId,
      employeeNo: params.employeeNo,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      address: params.address,
      isActive: true,
    },
    create: {
      schoolId: params.schoolId,
      userId: params.userId,
      employeeNo: params.employeeNo,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      address: params.address,
      isActive: true,
    },
  });

  await prisma.teacherBankDetails.upsert({
    where: { teacherId: profile.id },
    update: {
      accountHolderName: `${params.firstName} ${params.lastName}`,
      accountNumber: `DEMO${params.employeeNo.replace(/\D/g, '').padStart(8, '0')}`,
      ifscCode: 'DEMO0001234',
      accountType: 'SAVINGS',
      bankName: 'Demo National Bank',
      branchName: 'Demo City',
      panNumber: `DEMO${params.employeeNo.replace(/\D/g, '').padStart(5, '0')}P`,
    },
    create: {
      teacherId: profile.id,
      accountHolderName: `${params.firstName} ${params.lastName}`,
      accountNumber: `DEMO${params.employeeNo.replace(/\D/g, '').padStart(8, '0')}`,
      ifscCode: 'DEMO0001234',
      accountType: 'SAVINGS',
      bankName: 'Demo National Bank',
      branchName: 'Demo City',
      panNumber: `DEMO${params.employeeNo.replace(/\D/g, '').padStart(5, '0')}P`,
    },
  });

  return profile;
};

const upsertUserBankDetails = async (userId: string, name: string, serial: string) => {
  await prisma.userBankDetails.upsert({
    where: { userId },
    update: {
      accountHolderName: name,
      accountNumber: `USER${serial.padStart(8, '0')}`,
      ifscCode: 'DEMO0005678',
      accountType: 'CURRENT',
      bankName: 'Demo Commercial Bank',
      branchName: 'Demo City',
      panNumber: `USR${serial.padStart(6, '0')}D`,
    },
    create: {
      userId,
      accountHolderName: name,
      accountNumber: `USER${serial.padStart(8, '0')}`,
      ifscCode: 'DEMO0005678',
      accountType: 'CURRENT',
      bankName: 'Demo Commercial Bank',
      branchName: 'Demo City',
      panNumber: `USR${serial.padStart(6, '0')}D`,
    },
  });
};

const findOrCreateAcademicYear = async (schoolId: string) => {
  const existing = await prisma.academicYear.findFirst({
    where: { schoolId, name: '2026-2027' },
  });

  if (existing) {
    return prisma.academicYear.update({
      where: { id: existing.id },
      data: {
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2027-03-31T23:59:59.000Z'),
        isActive: true,
      },
    });
  }

  return prisma.academicYear.create({
    data: {
      schoolId,
      name: '2026-2027',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T23:59:59.000Z'),
      isActive: true,
    },
  });
};

const seedAcademics = async (schoolId: string) => {
  const academicYear = await findOrCreateAcademicYear(schoolId);

  const termOne = await prisma.term.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: 'Term 1' } },
    update: {
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.000Z'),
    },
    create: {
      academicYearId: academicYear.id,
      name: 'Term 1',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.000Z'),
    },
  });

  const termTwo = await prisma.term.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: 'Term 2' } },
    update: {
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T23:59:59.000Z'),
    },
    create: {
      academicYearId: academicYear.id,
      name: 'Term 2',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T23:59:59.000Z'),
    },
  });

  const gradeTen = await prisma.class.upsert({
    where: { schoolId_name: { schoolId, name: 'Grade 10' } },
    update: { academicYearId: academicYear.id },
    create: {
      schoolId,
      academicYearId: academicYear.id,
      name: 'Grade 10',
    },
  });

  const sectionA = await prisma.section.upsert({
    where: { classId_name: { classId: gradeTen.id, name: 'A' } },
    update: {},
    create: {
      classId: gradeTen.id,
      name: 'A',
    },
  });

  const subjects = [];
  for (const subject of [
    { name: 'Mathematics', code: 'MATH10' },
    { name: 'Science', code: 'SCI10' },
    { name: 'English', code: 'ENG10' },
  ]) {
    subjects.push(
      await prisma.subject.upsert({
        where: {
          schoolId_name_classId_academicYearId: {
            schoolId,
            name: subject.name,
            classId: gradeTen.id,
            academicYearId: academicYear.id,
          },
        },
        update: { code: subject.code },
        create: {
          schoolId,
          classId: gradeTen.id,
          academicYearId: academicYear.id,
          name: subject.name,
          code: subject.code,
        },
      }),
    );
  }

  return { academicYear, termOne, termTwo, gradeTen, sectionA, subjects };
};

const seedSubscription = async (schoolId: string) => {
  const plan = await prisma.subscriptionPlanDef.upsert({
    where: { name: 'Demo Standard' },
    update: {
      status: 'ACTIVE',
      priceCents: 499900,
      features: ['Academics', 'Attendance', 'Exams', 'Parents', 'Branding', 'Audit logs'],
      studentLimit: 500,
      teacherLimit: 80,
    },
    create: {
      name: 'Demo Standard',
      status: 'ACTIVE',
      priceCents: 499900,
      features: ['Academics', 'Attendance', 'Exams', 'Parents', 'Branding', 'Audit logs'],
      studentLimit: 500,
      teacherLimit: 80,
    },
  });

  for (const code of allPermissionCodes) {
    await prisma.subscriptionPlanPermission.upsert({
      where: {
        planId_permissionCode: {
          planId: plan.id,
          permissionCode: code,
        },
      },
      update: { enabled: true },
      create: {
        planId: plan.id,
        permissionCode: code,
        enabled: true,
      },
    });
  }

  await prisma.subscription.upsert({
    where: { schoolId },
    update: {
      planId: plan.id,
      planName: plan.name,
      status: 'ACTIVE',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2027-05-31T23:59:59.000Z'),
      billingCycle: 'YEARLY',
      discountPercent: 10,
      graceDays: 15,
      paidAt: new Date('2026-06-01T00:00:00.000Z'),
      nextDueAt: new Date('2027-06-01T00:00:00.000Z'),
      studentLimit: 500,
      teacherLimit: 80,
    },
    create: {
      schoolId,
      planId: plan.id,
      planName: plan.name,
      status: 'ACTIVE',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2027-05-31T23:59:59.000Z'),
      billingCycle: 'YEARLY',
      discountPercent: 10,
      graceDays: 15,
      paidAt: new Date('2026-06-01T00:00:00.000Z'),
      nextDueAt: new Date('2027-06-01T00:00:00.000Z'),
      studentLimit: 500,
      teacherLimit: 80,
    },
  });
};

const seedLoginBranding = async (schoolId: string) => {
  const existingConfig = await prisma.configEntry.findUnique({
    where: { key: LOGIN_EXPERIENCE_KEY },
  });

  if (existingConfig) {
    await prisma.configEntry.update({
      where: { id: existingConfig.id },
      data: {
        value: mergeLoginExperience(existingConfig.value),
      },
    });
  } else {
    await prisma.configEntry.create({
      data: {
        key: LOGIN_EXPERIENCE_KEY,
        value: platformLoginExperience,
        version: 1,
      },
    });
  }

  const existingTheme = await prisma.theme.findFirst({
    where: {
      schoolId,
      name: 'Demo Login Branding',
      version: 1,
    },
  });

  if (existingTheme) {
    await prisma.theme.update({
      where: { id: existingTheme.id },
      data: {
        tokens: demoLoginThemeTokens,
        status: 'PUBLISHED',
      },
    });
  } else {
    await prisma.theme.create({
      data: {
        schoolId,
        name: 'Demo Login Branding',
        version: 1,
        status: 'PUBLISHED',
        tokens: demoLoginThemeTokens,
      },
    });
  }
};

const seedDemoData = async () => {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const roles = await upsertRoles();
  const permissions = await upsertPermissions();
  await attachRolePermissions(roles, permissions);

  const school = await prisma.school.upsert({
    where: { code: DEMO_SCHOOL_CODE },
    update: {
      name: 'Demo Public School',
      status: 'ACTIVE',
      subscriptionPlan: 'STANDARD',
      statusReason: null,
      deletedAt: null,
    },
    create: {
      name: 'Demo Public School',
      code: DEMO_SCHOOL_CODE,
      status: 'ACTIVE',
      subscriptionPlan: 'STANDARD',
    },
  });

  const [superAdmin, schoolAdmin, teacherUser, accountantUser, librarianUser, staffUser, parentUser] =
    await Promise.all([
      upsertUser({
        schoolId: null,
        email: 'techstageit@admin.com',
        passwordHash,
        roleName: 'SUPER_ADMIN',
        mfaEnabled: false,
        mfaMethod: 'email',
      }),
      upsertUser({
        schoolId: school.id,
        email: 'school.admin@demo.school',
        passwordHash,
        roleName: 'SCHOOL_ADMIN',
        mfaEnabled: false,
        mfaMethod: 'email',
      }),
      upsertUser({
        schoolId: school.id,
        email: 'teacher@demo.school',
        passwordHash,
        roleName: 'TEACHER',
      }),
      upsertUser({
        schoolId: school.id,
        email: 'accountant@demo.school',
        passwordHash,
        roleName: 'ACCOUNTANT',
      }),
      upsertUser({
        schoolId: school.id,
        email: 'librarian@demo.school',
        passwordHash,
        roleName: 'LIBRARIAN',
      }),
      upsertUser({
        schoolId: school.id,
        email: 'staff@demo.school',
        passwordHash,
        roleName: 'STAFF',
      }),
      upsertUser({
        schoolId: school.id,
        email: 'parent@demo.school',
        passwordHash,
        roleName: 'PARENT',
      }),
    ]);

  await Promise.all([
    upsertUserBankDetails(superAdmin.id, 'TechStage IT Admin', '1'),
    upsertUserBankDetails(schoolAdmin.id, 'Anita Sharma', '2'),
    upsertUserBankDetails(accountantUser.id, 'Ravi Menon', '3'),
    upsertUserBankDetails(librarianUser.id, 'Meera Nair', '4'),
    upsertUserBankDetails(staffUser.id, 'Karthik Rao', '5'),
  ]);

  const { academicYear, gradeTen, sectionA, subjects } = await seedAcademics(school.id);

  const [schoolAdminProfile, teacherProfile, accountantProfile, librarianProfile, staffProfile] =
    await Promise.all([
      upsertEmployeeProfile({
        schoolId: school.id,
        userId: schoolAdmin.id,
        employeeNo: 'EMP-ADMIN-001',
        firstName: 'Anita',
        lastName: 'Sharma',
        phone: '9000000001',
        address: 'Demo Public School, Admin Block, Demo City',
      }),
      upsertEmployeeProfile({
        schoolId: school.id,
        userId: teacherUser.id,
        employeeNo: 'EMP-TEA-001',
        firstName: 'Priya',
        lastName: 'Iyer',
        phone: '9000000002',
        address: '42 Teacher Colony, Demo City',
      }),
      upsertEmployeeProfile({
        schoolId: school.id,
        userId: accountantUser.id,
        employeeNo: 'EMP-ACC-001',
        firstName: 'Ravi',
        lastName: 'Menon',
        phone: '9000000003',
        address: '12 Finance Street, Demo City',
      }),
      upsertEmployeeProfile({
        schoolId: school.id,
        userId: librarianUser.id,
        employeeNo: 'EMP-LIB-001',
        firstName: 'Meera',
        lastName: 'Nair',
        phone: '9000000004',
        address: '8 Library Road, Demo City',
      }),
      upsertEmployeeProfile({
        schoolId: school.id,
        userId: staffUser.id,
        employeeNo: 'EMP-STF-001',
        firstName: 'Karthik',
        lastName: 'Rao',
        phone: '9000000005',
        address: '5 Operations Lane, Demo City',
      }),
    ]);

  await prisma.teacherClassAssignment.upsert({
    where: {
      teacherId_classId_sectionId: {
        teacherId: teacherProfile.id,
        classId: gradeTen.id,
        sectionId: sectionA.id,
      },
    },
    update: {},
    create: {
      teacherId: teacherProfile.id,
      classId: gradeTen.id,
      sectionId: sectionA.id,
    },
  });

  for (const subject of subjects) {
    await prisma.teacherSubjectAssignment.upsert({
      where: {
        teacherId_subjectId: {
          teacherId: teacherProfile.id,
          subjectId: subject.id,
        },
      },
      update: {},
      create: {
        teacherId: teacherProfile.id,
        subjectId: subject.id,
      },
    });
  }

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {
      firstName: 'Suresh',
      lastName: 'Kumar',
      phone: '9000000006',
      email: 'parent@demo.school',
    },
    create: {
      userId: parentUser.id,
      firstName: 'Suresh',
      lastName: 'Kumar',
      phone: '9000000006',
      email: 'parent@demo.school',
    },
  });

  const student = await prisma.student.upsert({
    where: {
      schoolId_admissionNo: {
        schoolId: school.id,
        admissionNo: 'DEMO-STD-001',
      },
    },
    update: {
      classId: gradeTen.id,
      sectionId: sectionA.id,
      firstName: 'Arjun',
      lastName: 'Kumar',
      fullName: 'Arjun Kumar',
      dob: new Date('2011-08-15T00:00:00.000Z'),
      gender: 'Male',
      bloodGroup: 'O+',
      photoUrl: '/branding/demo-student-photo.svg',
      fatherName: 'Suresh Kumar',
      motherName: 'Lakshmi Kumar',
      guardianName: 'Suresh Kumar',
      guardianRelationship: 'Father',
      parentPhone: '9000000006',
      parentEmail: 'parent@demo.school',
      addressLine1: '24 Student Avenue',
      addressLine2: 'Near Demo Public School',
      city: 'Demo City',
      state: 'Demo State',
      pincode: '560001',
      emergencyContact: '9000000099',
      medicalConditions: 'None',
      allergies: 'None',
      doctorContact: '9000000088',
      docBirthCert: '/documents/demo/arjun-birth-certificate.pdf',
      docTransferCert: '/documents/demo/arjun-transfer-certificate.pdf',
      docAadhaar: '/documents/demo/arjun-aadhaar.pdf',
      docReportCard: '/documents/demo/arjun-report-card.pdf',
      status: 'ENROLLED',
    },
    create: {
      schoolId: school.id,
      classId: gradeTen.id,
      sectionId: sectionA.id,
      admissionNo: 'DEMO-STD-001',
      firstName: 'Arjun',
      lastName: 'Kumar',
      fullName: 'Arjun Kumar',
      dob: new Date('2011-08-15T00:00:00.000Z'),
      gender: 'Male',
      bloodGroup: 'O+',
      photoUrl: '/branding/demo-student-photo.svg',
      fatherName: 'Suresh Kumar',
      motherName: 'Lakshmi Kumar',
      guardianName: 'Suresh Kumar',
      guardianRelationship: 'Father',
      parentPhone: '9000000006',
      parentEmail: 'parent@demo.school',
      addressLine1: '24 Student Avenue',
      addressLine2: 'Near Demo Public School',
      city: 'Demo City',
      state: 'Demo State',
      pincode: '560001',
      emergencyContact: '9000000099',
      medicalConditions: 'None',
      allergies: 'None',
      doctorContact: '9000000088',
      docBirthCert: '/documents/demo/arjun-birth-certificate.pdf',
      docTransferCert: '/documents/demo/arjun-transfer-certificate.pdf',
      docAadhaar: '/documents/demo/arjun-aadhaar.pdf',
      docReportCard: '/documents/demo/arjun-report-card.pdf',
      status: 'ENROLLED',
    },
  });

  await prisma.studentParent.upsert({
    where: {
      studentId_parentId: {
        studentId: student.id,
        parentId: parentProfile.id,
      },
    },
    update: {},
    create: {
      studentId: student.id,
      parentId: parentProfile.id,
    },
  });

  const existingPhoto = await prisma.studentPhoto.findFirst({
    where: {
      studentId: student.id,
      url: '/branding/demo-student-photo.svg',
    },
  });
  if (!existingPhoto) {
    await prisma.studentPhoto.create({
      data: {
        studentId: student.id,
        url: '/branding/demo-student-photo.svg',
      },
    });
  }

  await seedSubscription(school.id);
  await attachEmployeeRolePermissions(school.id);
  await seedLoginBranding(school.id);

  await prisma.usageCounter.upsert({
    where: { schoolId: school.id },
    update: {
      students: 1,
      teachers: 5,
    },
    create: {
      schoolId: school.id,
      students: 1,
      teachers: 5,
    },
  });

  return {
    school,
    academicYear,
    users: {
      superAdmin,
      schoolAdmin,
      teacherUser,
      accountantUser,
      librarianUser,
      staffUser,
      parentUser,
    },
    profiles: {
      schoolAdminProfile,
      teacherProfile,
      accountantProfile,
      librarianProfile,
      staffProfile,
      parentProfile,
      student,
    },
  };
};

seedDemoData()
  .then((result) => {
    console.log('Seed completed.');
    console.table([
      { type: 'School', code: result.school.code, email: '', password: '' },
      { type: 'Super Admin', code: '', email: 'techstageit@admin.com', password: DEMO_PASSWORD },
      { type: 'School Admin', code: DEMO_SCHOOL_CODE, email: 'school.admin@demo.school', password: DEMO_PASSWORD },
      { type: 'Teacher', code: DEMO_SCHOOL_CODE, email: 'teacher@demo.school', password: DEMO_PASSWORD },
      { type: 'Accountant', code: DEMO_SCHOOL_CODE, email: 'accountant@demo.school', password: DEMO_PASSWORD },
      { type: 'Librarian', code: DEMO_SCHOOL_CODE, email: 'librarian@demo.school', password: DEMO_PASSWORD },
      { type: 'Staff', code: DEMO_SCHOOL_CODE, email: 'staff@demo.school', password: DEMO_PASSWORD },
      { type: 'Parent', code: DEMO_SCHOOL_CODE, email: 'parent@demo.school', password: DEMO_PASSWORD },
      { type: 'Student Record', code: DEMO_SCHOOL_CODE, email: 'parent@demo.school', password: 'Use parent portal' },
    ]);
    console.log('Student login is seeded as a student record only because the current schema has no STUDENT role.');
  })
  .catch((error) => {
    console.error('Seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
