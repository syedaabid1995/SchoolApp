import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createExam } from '../controllers/exam.controller';
import type {
  AiAssistantContext,
  AiToolDefinition,
  AiToolName,
} from '../types/aiAssistant.types';
import { answerProductQuestion, explainNextSetupStep, navigationForTopic } from './aiAssistantKnowledge.service';

export const AI_TOOL_REGISTRY: Record<AiToolName, AiToolDefinition> = {
  get_school_onboarding_status: { name: 'get_school_onboarding_status', description: 'Show school setup readiness.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] },
  list_academic_years: { name: 'list_academic_years', description: 'List academic years.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  list_classes: { name: 'list_classes', description: 'List classes.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  list_sections: { name: 'list_sections', description: 'List sections.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  list_class_sections: { name: 'list_class_sections', description: 'List classes with assigned sections.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  list_subjects: { name: 'list_subjects', description: 'List subjects.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  list_teachers: { name: 'list_teachers', description: 'List active teachers.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  list_students_by_class_section: { name: 'list_students_by_class_section', description: 'List students by class and section.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], requiredFields: ['className', 'sectionName'] },
  list_exams: { name: 'list_exams', description: 'List exams.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'] },
  get_exam_setup_status: { name: 'get_exam_setup_status', description: 'Show exam setup readiness.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] },
  create_class: { name: 'create_class', description: 'Create a class.', mutation: true, risk: 'LOW', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['name'] },
  create_section: { name: 'create_section', description: 'Create a section.', mutation: true, risk: 'LOW', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['name'] },
  assign_section_to_class: { name: 'assign_section_to_class', description: 'Assign a section to a class.', mutation: true, risk: 'LOW', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['className', 'sectionName'] },
  create_subject: { name: 'create_subject', description: 'Create a subject.', mutation: true, risk: 'LOW', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['name'] },
  assign_subject_to_class_section: { name: 'assign_subject_to_class_section', description: 'Assign subject and teacher to class section.', mutation: true, risk: 'MEDIUM', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['subjectName', 'className', 'sectionName', 'teacherName'] },
  create_teacher_basic: { name: 'create_teacher_basic', description: 'Create a basic teacher profile.', mutation: true, risk: 'MEDIUM', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['firstName', 'lastName', 'email'] },
  create_student_basic: { name: 'create_student_basic', description: 'Create a basic student record.', mutation: true, risk: 'MEDIUM', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['firstName', 'lastName', 'admissionNo'] },
  create_exam_draft: { name: 'create_exam_draft', description: 'Create a draft exam for a class section.', mutation: true, risk: 'LOW', allowedRoles: ['SCHOOL_ADMIN'], requiredFields: ['className', 'sectionName'] },
  answer_product_question: { name: 'answer_product_question', description: 'Answer product help questions.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT'] },
  explain_next_setup_step: { name: 'explain_next_setup_step', description: 'Explain next setup step.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] },
  navigate_user_to_page: { name: 'navigate_user_to_page', description: 'Suggest an app page.', mutation: false, risk: 'LOW', allowedRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'ACCOUNTANT', 'LIBRARIAN'] },
};

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const lower = (value: unknown) => normalize(value).toLowerCase();

const requireSchool = (ctx: AiAssistantContext) => {
  if (!ctx.schoolId) throw new HttpError(400, 'Select a school context before using this assistant tool');
  return ctx.schoolId;
};

export const assertToolAllowed = (ctx: AiAssistantContext, toolName: AiToolName) => {
  const tool = AI_TOOL_REGISTRY[toolName];
  if (!tool) throw new HttpError(400, 'Unsupported AI tool');
  if (!ctx.role || !tool.allowedRoles.includes(ctx.role)) {
    throw new HttpError(403, tool.mutation ? 'Your role cannot execute AI setup actions' : 'Your role cannot use this AI tool');
  }
};

export const validateToolPayload = (toolName: AiToolName, payload: Record<string, unknown>) => {
  const tool = AI_TOOL_REGISTRY[toolName];
  const missing = (tool.requiredFields ?? []).filter((field) => !normalize(payload[field]));
  if (missing.length) {
    throw new HttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }
};

const findClassByName = async (schoolId: string, name: unknown) => {
  const className = lower(name);
  const found = await prisma.class.findFirst({
    where: { schoolId, name: { equals: className, mode: 'insensitive' } },
    select: { id: true, name: true, academicYearId: true },
  });
  if (!found) throw new HttpError(404, `Class ${normalize(name)} not found`);
  return found;
};

const findSectionByName = async (schoolId: string, name: unknown) => {
  const sectionName = lower(name);
  const found = await prisma.section.findFirst({
    where: { schoolId, name: { equals: sectionName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!found) throw new HttpError(404, `Section ${normalize(name)} not found`);
  return found;
};

const findSubjectByName = async (schoolId: string, name: unknown) => {
  const subjectName = lower(name);
  const found = await prisma.subject.findFirst({
    where: { schoolId, name: { equals: subjectName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!found) throw new HttpError(404, `Subject ${normalize(name)} not found`);
  return found;
};

const findTeacherByName = async (schoolId: string, name: unknown) => {
  const teacherName = lower(name);
  const teachers = await prisma.teacherProfile.findMany({
    where: { schoolId, isActive: true },
    select: { id: true, firstName: true, lastName: true, employeeNo: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  const found = teachers.find((teacher) => `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(teacherName));
  if (!found) throw new HttpError(404, `Teacher ${normalize(name)} not found`);
  return found;
};

const activeAcademicYear = async (schoolId: string) => {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    orderBy: { startDate: 'desc' },
    select: { id: true, name: true },
  });
  return year;
};

const createAuditData = (payload: Record<string, unknown>) => payload as Prisma.InputJsonValue;

export const executeAiTool = async (ctx: AiAssistantContext, toolName: AiToolName, payload: Record<string, unknown>) => {
  assertToolAllowed(ctx, toolName);
  validateToolPayload(toolName, payload);
  const schoolId = requireSchool(ctx);

  switch (toolName) {
    case 'list_academic_years':
      return prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startDate: 'desc' }, select: { id: true, name: true, isActive: true } });
    case 'list_classes':
      return prisma.class.findMany({ where: { schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true, academicYear: { select: { name: true } } } });
    case 'list_sections':
      return prisma.section.findMany({ where: { schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
    case 'list_class_sections':
      return prisma.class.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, classSections: { select: { section: { select: { id: true, name: true } } }, orderBy: { section: { name: 'asc' } } } },
      });
    case 'list_subjects':
      return prisma.subject.findMany({ where: { schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, type: true } });
    case 'list_teachers':
      return prisma.teacherProfile.findMany({ where: { schoolId, isActive: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], select: { id: true, firstName: true, lastName: true, employeeNo: true } });
    case 'list_students_by_class_section': {
      const cls = await findClassByName(schoolId, payload.className);
      const section = await findSectionByName(schoolId, payload.sectionName);
      return prisma.student.findMany({
        where: { schoolId, classId: cls.id, sectionId: section.id },
        orderBy: [{ rollNo: 'asc' }, { fullName: 'asc' }],
        select: { id: true, admissionNo: true, rollNo: true, fullName: true, status: true },
      });
    }
    case 'list_exams':
      return prisma.exam.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, type: true, status: true, scheduledAt: true } });
    case 'get_school_onboarding_status': {
      const [classes, sections, subjects, teachers, students] = await Promise.all([
        prisma.class.count({ where: { schoolId } }),
        prisma.section.count({ where: { schoolId } }),
        prisma.subject.count({ where: { schoolId } }),
        prisma.teacherProfile.count({ where: { schoolId, isActive: true } }),
        prisma.student.count({ where: { schoolId } }),
      ]);
      return { classes, sections, subjects, teachers, students, nextStep: await explainNextSetupStep({ classes, sections, subjects, teachers, students }) };
    }
    case 'get_exam_setup_status': {
      const [exams, centers, rooms, seating] = await Promise.all([
        prisma.exam.count({ where: { schoolId } }),
        prisma.examCenter.count({ where: { schoolId, isActive: true } }),
        prisma.examRoom.count({ where: { schoolId, isActive: true } }),
        prisma.examSeatingAllocation.count({ where: { schoolId } }),
      ]);
      return { exams, centers, rooms, seating, readyForHallTickets: exams > 0 && centers > 0 && rooms > 0 && seating > 0 };
    }
    case 'answer_product_question':
      return { answer: answerProductQuestion(String(payload.question ?? '')) };
    case 'explain_next_setup_step': {
      const status = await executeAiTool(ctx, 'get_school_onboarding_status', {});
      return { answer: (status as any).nextStep, status };
    }
    case 'navigate_user_to_page':
      return navigationForTopic(String(payload.topic ?? payload.question ?? ''));
    case 'create_class': {
      const name = normalize(payload.name);
      const existing = await prisma.class.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
      if (existing) throw new HttpError(409, `Class ${name} already exists`);
      const year = payload.academicYearName
        ? await prisma.academicYear.findFirst({ where: { schoolId, name: { equals: normalize(payload.academicYearName), mode: 'insensitive' } }, select: { id: true } })
        : await activeAcademicYear(schoolId);
      return prisma.class.create({ data: { schoolId, name, academicYearId: year?.id ?? null }, select: { id: true, name: true, academicYearId: true } });
    }
    case 'create_section': {
      const name = normalize(payload.name);
      const existing = await prisma.section.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
      if (existing) throw new HttpError(409, `Section ${name} already exists`);
      return prisma.section.create({ data: { schoolId, name }, select: { id: true, name: true } });
    }
    case 'assign_section_to_class': {
      const cls = await findClassByName(schoolId, payload.className);
      let section = await prisma.section.findFirst({ where: { schoolId, name: { equals: normalize(payload.sectionName), mode: 'insensitive' } }, select: { id: true, name: true } });
      if (!section) {
        section = await prisma.section.create({ data: { schoolId, name: normalize(payload.sectionName) }, select: { id: true, name: true } });
      }
      await prisma.classSection.upsert({
        where: { classId_sectionId: { classId: cls.id, sectionId: section.id } },
        update: {},
        create: { schoolId, classId: cls.id, sectionId: section.id },
      });
      return { class: cls.name, section: section.name };
    }
    case 'create_subject': {
      const name = normalize(payload.name);
      const existing = await prisma.subject.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
      if (existing) throw new HttpError(409, `Subject ${name} already exists`);
      return prisma.subject.create({ data: { schoolId, name, code: normalize(payload.code) || null, type: payload.type === 'PRACTICAL' ? 'PRACTICAL' : 'THEORY' }, select: { id: true, name: true, code: true, type: true } });
    }
    case 'assign_subject_to_class_section': {
      const cls = await findClassByName(schoolId, payload.className);
      const section = await findSectionByName(schoolId, payload.sectionName);
      const subject = await findSubjectByName(schoolId, payload.subjectName);
      const teacher = await findTeacherByName(schoolId, payload.teacherName);
      const link = await prisma.classSection.findFirst({ where: { schoolId, classId: cls.id, sectionId: section.id }, select: { id: true } });
      if (!link) throw new HttpError(400, 'Section is not assigned to the selected class');
      return prisma.assignSubject.upsert({
        where: { classId_sectionId_subjectId: { classId: cls.id, sectionId: section.id, subjectId: subject.id } },
        update: { teacherId: teacher.id },
        create: { schoolId, classId: cls.id, sectionId: section.id, subjectId: subject.id, teacherId: teacher.id },
        select: { id: true, class: { select: { name: true } }, section: { select: { name: true } }, subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
      });
    }
    case 'create_exam_draft': {
      const cls = await findClassByName(schoolId, payload.className);
      const section = await findSectionByName(schoolId, payload.sectionName);
      const assignments = await prisma.assignSubject.findMany({
        where: { schoolId, classId: cls.id, sectionId: section.id },
        select: { subjectId: true, subject: { select: { name: true } } },
      });
      if (!assignments.length) throw new HttpError(400, 'Assign subjects to this class/section before creating an exam');
      const year = cls.academicYearId ? { id: cls.academicYearId } : await activeAcademicYear(schoolId);
      if (!year) throw new HttpError(400, 'Active academic year is required before creating an exam');
      const scheduledAt = normalize(payload.scheduledAt) || new Date().toISOString().slice(0, 10);
      const req = {
        auth: ctx.auth,
        body: {
          name: normalize(payload.name) || `Draft Exam - ${cls.name} ${section.name}`,
          type: normalize(payload.type) || 'FINAL',
          academicYearId: year.id,
          classId: cls.id,
          sectionId: section.id,
          scheduledAt,
          status: 'DRAFT',
          subjectMappings: assignments.map((assignment) => ({
            subjectId: assignment.subjectId,
            maxMarks: 100,
            passMarks: 35,
            scheduledAt,
          })),
        },
        query: {},
        params: {},
        headers: {},
      };
      let responseBody: unknown;
      const res = { status: () => res, json: (body: unknown) => { responseBody = body; return res; } } as any;
      await createExam(req as any, res);
      return responseBody;
    }
    case 'create_teacher_basic':
    case 'create_student_basic':
      throw new HttpError(400, 'This action is not enabled in the first assistant MVP yet');
    default:
      throw new HttpError(400, 'Unsupported AI tool');
  }
};

export const buildActionSummary = (toolName: AiToolName, payload: Record<string, unknown>) => {
  switch (toolName) {
    case 'create_class':
      return `Create ${normalize(payload.name)}`;
    case 'create_section':
      return `Create section ${normalize(payload.name)}`;
    case 'assign_section_to_class':
      return `Assign section ${normalize(payload.sectionName)} to ${normalize(payload.className)}`;
    case 'create_subject':
      return `Create subject ${normalize(payload.name)}`;
    case 'assign_subject_to_class_section':
      return `Assign ${normalize(payload.subjectName)} to ${normalize(payload.className)} Section ${normalize(payload.sectionName)}`;
    case 'create_exam_draft':
      return `Create draft exam for ${normalize(payload.className)} Section ${normalize(payload.sectionName)}`;
    default:
      return AI_TOOL_REGISTRY[toolName].description;
  }
};

export const toAuditJson = createAuditData;
