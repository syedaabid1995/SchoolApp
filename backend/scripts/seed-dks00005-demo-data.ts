import 'dotenv/config';
import { PrismaClient, type RoleName } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const SCHOOL_CODE = process.env.DEMO_SCHOOL_CODE ?? 'DKS_00005';
const PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'Password@123';

const subjects = [
  ['English', 'ENG'],
  ['Mathematics', 'MATH'],
  ['Science', 'SCI'],
  ['Social Studies', 'SST'],
  ['Computer Science', 'CS'],
] as const;

const classes = ['Class 1', 'Class 2', 'Class 3'];
const sections = ['A', 'B'];

const teacherNames = [
  ['Aisha', 'Khan'],
  ['Ravi', 'Menon'],
  ['Meera', 'Sharma'],
  ['Omar', 'Ali'],
  ['Sara', 'Thomas'],
] as const;

const ensureUserWithRole = async (params: {
  schoolId: string;
  email: string;
  roleName: RoleName;
  mustChangePassword?: boolean;
}) => {
  const passwordHash = await hashPassword(PASSWORD);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: params.roleName } });
  const user = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: params.schoolId, email: params.email } },
    update: { passwordHash, status: 'ACTIVE', mustChangePassword: params.mustChangePassword ?? false },
    create: {
      schoolId: params.schoolId,
      email: params.email,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: params.mustChangePassword ?? false,
      mfaEnabled: false,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  return user;
};

const main = async () => {
  const school = await prisma.school.findFirst({
    where: { code: { equals: SCHOOL_CODE, mode: 'insensitive' } },
    select: { id: true, code: true, name: true },
  });
  if (!school) {
    throw new Error(`School not found for code ${SCHOOL_CODE}. Create the school first.`);
  }

  console.log(`Seeding demo data for ${school.name} (${school.code})`);

  const schoolAdmin = await prisma.user.findFirst({
    where: { schoolId: school.id, roles: { some: { role: { name: 'SCHOOL_ADMIN' } } } },
    select: { id: true },
  });
  if (!schoolAdmin) throw new Error('No School Admin user found for this school.');

  const academicYear = await prisma.academicYear.upsert({
    where: { id: '11111111-1111-4111-8111-000000050001' },
    update: { schoolId: school.id, name: '2026-2027', isActive: true },
    create: {
      id: '11111111-1111-4111-8111-000000050001',
      schoolId: school.id,
      name: '2026-2027',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
    },
  });

  const classRows = [];
  for (const name of classes) {
    const existing = await prisma.class.findFirst({ where: { schoolId: school.id, name } });
    classRows.push(
      existing
        ? await prisma.class.update({ where: { id: existing.id }, data: { academicYearId: academicYear.id } })
        : await prisma.class.create({ data: { schoolId: school.id, academicYearId: academicYear.id, name } }),
    );
  }

  const sectionRows = [];
  for (const classRow of classRows) {
    for (const name of sections) {
      const existing = await prisma.section.findFirst({ where: { schoolId: school.id, classId: classRow.id, name } });
      const section = existing ?? (await prisma.section.create({ data: { schoolId: school.id, classId: classRow.id, name } }));
      sectionRows.push({ classRow, section });
      await prisma.classSection.upsert({
        where: { classId_sectionId: { classId: classRow.id, sectionId: section.id } },
        update: {},
        create: { schoolId: school.id, classId: classRow.id, sectionId: section.id },
      });
    }
  }

  const teacherRows = [];
  for (let index = 0; index < teacherNames.length; index += 1) {
    const [firstName, lastName] = teacherNames[index];
    const email = `teacher${index + 1}.dks00005@test.com`;
    const user = await ensureUserWithRole({ schoolId: school.id, email, roleName: 'TEACHER' });
    const employeeNo = `DKS-T-${String(index + 1).padStart(3, '0')}`;
    const existing = await prisma.teacherProfile.findFirst({ where: { schoolId: school.id, employeeNo } });
    const teacher = existing
      ? await prisma.teacherProfile.update({
          where: { id: existing.id },
          data: { userId: user.id, firstName, lastName, phone: `90000000${index + 1}`, isActive: true, roleName: 'TEACHER' },
        })
      : await prisma.teacherProfile.create({
          data: {
            schoolId: school.id,
            userId: user.id,
            employeeNo,
            firstName,
            lastName,
            phone: `90000000${index + 1}`,
            address: `Teacher ${index + 1} Address`,
            roleName: 'TEACHER',
            isActive: true,
          },
        });
    teacherRows.push(teacher);
  }

  const subjectRows = [];
  const classOne = classRows[0];
  for (let index = 0; index < subjects.length; index += 1) {
    const [name, code] = subjects[index];
    const existing = await prisma.subject.findFirst({
      where: { schoolId: school.id, name, classId: classOne.id, academicYearId: academicYear.id },
    });
    const subject =
      existing ??
      (await prisma.subject.create({
        data: { schoolId: school.id, classId: classOne.id, academicYearId: academicYear.id, name, code, type: 'THEORY' },
      }));
    subjectRows.push(subject);
  }

  for (const [sectionIndex, item] of sectionRows.entries()) {
    for (let index = 0; index < subjectRows.length; index += 1) {
      if (item.classRow.id !== classOne.id) continue;
      const teacher = teacherRows[index % teacherRows.length];
      await prisma.assignSubject.upsert({
        where: { classId_sectionId_subjectId: { classId: classOne.id, sectionId: item.section.id, subjectId: subjectRows[index].id } },
        update: { teacherId: teacher.id },
        create: {
          schoolId: school.id,
          classId: classOne.id,
          sectionId: item.section.id,
          subjectId: subjectRows[index].id,
          teacherId: teacher.id,
        },
      });
      await prisma.teacherSubjectAssignment.upsert({
        where: { teacherId_subjectId: { teacherId: teacher.id, subjectId: subjectRows[index].id } },
        update: {},
        create: { teacherId: teacher.id, subjectId: subjectRows[index].id },
      });
      await prisma.teacherClassAssignment.upsert({
        where: { teacherId_classId_sectionId: { teacherId: teacher.id, classId: classOne.id, sectionId: item.section.id } },
        update: {},
        create: { teacherId: teacher.id, classId: classOne.id, sectionId: item.section.id },
      });
    }
    if (item.classRow.id === classOne.id) {
      await prisma.classTeacher.upsert({
        where: { classId_sectionId: { classId: classOne.id, sectionId: item.section.id } },
        update: { teacherId: teacherRows[sectionIndex % teacherRows.length].id },
        create: {
          schoolId: school.id,
          classId: classOne.id,
          sectionId: item.section.id,
          teacherId: teacherRows[sectionIndex % teacherRows.length].id,
        },
      });
    }
  }

  const periods = [
    ['Period 1', '09:00', '09:45'],
    ['Period 2', '09:50', '10:35'],
    ['Period 3', '10:50', '11:35'],
    ['Period 4', '11:40', '12:25'],
    ['Period 5', '13:10', '13:55'],
  ] as const;
  const periodRows = [];
  for (const [name, startTime, endTime] of periods) {
    periodRows.push(
      await prisma.timePeriod.upsert({
        where: { schoolId_type_name: { schoolId: school.id, type: 'CLASS_TIME', name } },
        update: { startTime, endTime },
        create: { schoolId: school.id, type: 'CLASS_TIME', name, startTime, endTime },
      }),
    );
  }

  for (const item of sectionRows.filter((row) => row.classRow.id === classOne.id)) {
    for (let index = 0; index < periodRows.length; index += 1) {
      await prisma.classRoutine.upsert({
        where: {
          schoolId_classId_sectionId_dayOfWeek_timePeriodId: {
            schoolId: school.id,
            classId: classOne.id,
            sectionId: item.section.id,
            dayOfWeek: 1,
            timePeriodId: periodRows[index].id,
          },
        },
        update: { subjectId: subjectRows[index].id, teacherId: teacherRows[index].id },
        create: {
          schoolId: school.id,
          classId: classOne.id,
          sectionId: item.section.id,
          dayOfWeek: 1,
          timePeriodId: periodRows[index].id,
          subjectId: subjectRows[index].id,
          teacherId: teacherRows[index].id,
        },
      });
    }
  }

  for (let index = 1; index <= 20; index += 1) {
    const section = index <= 10 ? sectionRows[0].section : sectionRows[1].section;
    const rollNo = String(index <= 10 ? index : index - 10).padStart(2, '0');
    const admissionNo = `DKS-ADM-${String(index).padStart(3, '0')}`;
    const firstName = `Student${String(index).padStart(2, '0')}`;
    const lastName = 'DKS';
    const student = await prisma.student.upsert({
      where: { schoolId_admissionNo: { schoolId: school.id, admissionNo } },
      update: {
        academicSessionId: academicYear.id,
        classId: classOne.id,
        sectionId: section.id,
        rollNo,
        status: 'ENROLLED',
      },
      create: {
        schoolId: school.id,
        academicSessionId: academicYear.id,
        classId: classOne.id,
        sectionId: section.id,
        admissionNo,
        rollNo,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        gender: index % 2 === 0 ? 'Female' : 'Male',
        dob: new Date(`2018-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
        admissionDate: new Date('2026-06-01T00:00:00.000Z'),
        fatherName: `Parent ${index}`,
        parentPhone: `9888800${String(index).padStart(3, '0')}`,
        parentEmail: `parent${index}.dks00005@test.com`,
        presentAddress: `Student ${index} Address`,
        status: 'ENROLLED',
      },
    });

    const parentUser = await ensureUserWithRole({
      schoolId: school.id,
      email: `parent${index}.dks00005@test.com`,
      roleName: 'PARENT',
    });
    const existingParent = await prisma.parentProfile.findFirst({ where: { userId: parentUser.id } });
    const parent =
      existingParent ??
      (await prisma.parentProfile.create({
        data: {
          userId: parentUser.id,
          firstName: `Parent`,
          lastName: String(index).padStart(2, '0'),
          phone: `9888800${String(index).padStart(3, '0')}`,
          email: `parent${index}.dks00005@test.com`,
        },
      }));
    await prisma.studentParent.upsert({
      where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
      update: {},
      create: { studentId: student.id, parentId: parent.id },
    });
  }

  const exam = await prisma.exam.upsert({
    where: { id: '22222222-2222-4222-8222-000000050001' },
    update: { schoolId: school.id, academicYearId: academicYear.id, classId: classOne.id, sectionId: sectionRows[0].section.id },
    create: {
      id: '22222222-2222-4222-8222-000000050001',
      schoolId: school.id,
      academicYearId: academicYear.id,
      classId: classOne.id,
      sectionId: sectionRows[0].section.id,
      name: 'Class 1 Section A Demo Exam',
      type: 'MIDTERM',
      status: 'DRAFT',
      scheduledAt: new Date('2026-07-10T09:00:00.000Z'),
    },
  });
  for (let index = 0; index < subjectRows.length; index += 1) {
    await prisma.examPaper.upsert({
      where: { examId_subjectId_classId: { examId: exam.id, subjectId: subjectRows[index].id, classId: classOne.id } },
      update: { maxMarks: 100, passMarks: 35, scheduledAt: new Date(`2026-07-${10 + index}T09:00:00.000Z`) },
      create: {
        examId: exam.id,
        subjectId: subjectRows[index].id,
        classId: classOne.id,
        maxMarks: 100,
        passMarks: 35,
        scheduledAt: new Date(`2026-07-${10 + index}T09:00:00.000Z`),
      },
    });
  }

  console.log('Demo data seeded successfully.');
  console.log(`Academic year: ${academicYear.name}`);
  console.log(`Classes: ${classes.join(', ')}`);
  console.log(`Sections: ${sections.join(', ')}`);
  console.log(`Subjects assigned to Class 1 sections: ${subjects.map(([name]) => name).join(', ')}`);
  console.log(`Teachers: ${teacherRows.map((teacher) => `${teacher.firstName} ${teacher.lastName}`).join(', ')}`);
  console.log('Students: 20 with parent links');
  console.log(`Teacher/parent demo password: ${PASSWORD}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
