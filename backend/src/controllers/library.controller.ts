import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';

const uuidSchema = z.string().uuid();

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireLibraryManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.schoolId) {
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId };
  }

  throw new HttpError(403, 'School scope is required to manage library');
};

const handleUniqueError = (err: unknown, message: string) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new HttpError(409, message);
  }
  throw err;
};

const dateSchema = z.coerce.date();

const categorySchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const bookSchema = z.object({
  title: z.string().min(1).max(240),
  categoryId: uuidSchema,
  subjectId: uuidSchema,
  bookNumber: z.string().max(80).optional().nullable(),
  isbnNumber: z.string().max(80).optional().nullable(),
  publisherName: z.string().max(160).optional().nullable(),
  authorName: z.string().max(160).optional().nullable(),
  rackNumber: z.string().max(80).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(100000).default(1),
  price: z.coerce.number().min(0).max(100000000).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const memberSchema = z.object({
  memberType: z.enum(['STUDENT', 'TEACHER', 'STAFF']),
  memberCode: z.string().max(120).optional().nullable(),
  memberId: z.string().max(120).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const issueSchema = z.object({
  bookId: uuidSchema,
  returnDate: dateSchema.optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const includeBook = {
  category: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  _count: { select: { issues: true } },
} satisfies Prisma.LibraryBookInclude;

const includeMember = {
  _count: { select: { issues: true } },
} satisfies Prisma.LibraryMemberInclude;

const includeIssue = {
  book: {
    select: {
      id: true,
      title: true,
      bookNumber: true,
      isbnNumber: true,
      authorName: true,
      publisherName: true,
      quantity: true,
      category: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  },
  member: {
    select: {
      id: true,
      memberType: true,
      memberCode: true,
      fullName: true,
      email: true,
      phone: true,
      photoUrl: true,
      active: true,
    },
  },
  createdBy: { select: { id: true, email: true } },
  returnedBy: { select: { id: true, email: true } },
} satisfies Prisma.LibraryIssueInclude;

const asUuid = (value: string) => (uuidSchema.safeParse(value).success ? value : undefined);

const assertCategory = async (schoolId: string, categoryId: string) => {
  const found = await prisma.libraryBookCategory.findFirst({
    where: { id: categoryId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Book category not found');
};

const assertSubject = async (schoolId: string, subjectId: string) => {
  const found = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Subject not found');
};

const getBookOrThrow = async (schoolId: string, id: string) => {
  const book = await prisma.libraryBook.findFirst({ where: { id, schoolId }, include: includeBook });
  if (!book) throw new HttpError(404, 'Book not found');
  return book;
};

const getMemberOrThrow = async (schoolId: string, id: string) => {
  const member = await prisma.libraryMember.findFirst({ where: { id, schoolId }, include: includeMember });
  if (!member) throw new HttpError(404, 'Library member not found');
  return member;
};

const bookWithAvailability = async (bookId: string) => {
  const [book, issuedCount] = await Promise.all([
    prisma.libraryBook.findUnique({ where: { id: bookId }, include: includeBook }),
    prisma.libraryIssue.count({ where: { bookId, status: 'ISSUED' } }),
  ]);
  if (!book) return null;
  return { ...book, issuedCount, availableCopies: Math.max(book.quantity - issuedCount, 0) };
};

const mapBooksWithAvailability = async (books: Array<Prisma.LibraryBookGetPayload<{ include: typeof includeBook }>>) =>
  Promise.all(
    books.map(async (book) => {
      const issuedCount = await prisma.libraryIssue.count({ where: { bookId: book.id, status: 'ISSUED' } });
      return { ...book, issuedCount, availableCopies: Math.max(book.quantity - issuedCount, 0) };
    }),
  );

const resolveMember = async (schoolId: string, memberType: 'STUDENT' | 'TEACHER' | 'STAFF', rawCode: string) => {
  const code = normalizeText(rawCode);
  const id = asUuid(code);

  if (memberType === 'STUDENT') {
    const student = await prisma.student.findFirst({
      where: {
        schoolId,
        OR: [{ admissionNo: code }, ...(id ? [{ id }] : [])],
      },
      select: {
        id: true,
        admissionNo: true,
        fullName: true,
        email: true,
        phone: true,
        parentPhone: true,
        photoUrl: true,
      },
    });
    if (!student) throw new HttpError(404, 'Student member was not found');
    return {
      memberCode: student.admissionNo,
      studentId: student.id,
      staffId: null,
      fullName: student.fullName,
      email: student.email,
      phone: student.phone ?? student.parentPhone,
      photoUrl: student.photoUrl,
    };
  }

  const staff = await prisma.teacherProfile.findFirst({
    where: {
      schoolId,
      roleName: memberType === 'TEACHER' ? 'TEACHER' : { in: ['SCHOOL_ADMIN', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] },
      OR: [{ employeeNo: code }, ...(id ? [{ id }] : [])],
    },
    include: {
      user: { select: { email: true } },
    },
  });
  if (!staff) throw new HttpError(404, `${memberType === 'TEACHER' ? 'Teacher' : 'Staff'} member was not found`);

  return {
    memberCode: staff.employeeNo ?? staff.id,
    studentId: null,
    staffId: staff.id,
    fullName: normalizeText(`${staff.firstName} ${staff.lastName}`),
    email: staff.user.email,
    phone: staff.phone,
    photoUrl: staff.photoUrl,
  };
};

export const listLibraryCategories = async (req: Request, res: Response) => {
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.libraryBookCategory.findMany({
    where: {
      schoolId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { _count: { select: { books: true } } },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(items);
};

export const createLibraryCategory = async (req: Request, res: Response) => {
  const payload = categorySchema.parse(req.body);
  const { schoolId } = requireLibraryManager(req, payload.schoolId);

  try {
    const item = await prisma.libraryBookCategory.create({
      data: {
        schoolId,
        name: normalizeText(payload.name),
        description: nullableText(payload.description),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'LIBRARY_BOOK_CATEGORY',
      entityId: item.id,
      action: 'CREATE',
      afterState: item,
    });

    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Book category already exists');
  }
};

export const updateLibraryCategory = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = categorySchema.partial().parse(req.body);
  const { schoolId } = requireLibraryManager(req, payload.schoolId);
  const before = await prisma.libraryBookCategory.findFirst({ where: { id, schoolId } });
  if (!before) throw new HttpError(404, 'Book category not found');

  try {
    const item = await prisma.libraryBookCategory.update({
      where: { id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'LIBRARY_BOOK_CATEGORY',
      entityId: id,
      action: 'UPDATE',
      beforeState: before,
      afterState: item,
    });

    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Book category already exists');
  }
};

export const deleteLibraryCategory = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const existing = await prisma.libraryBookCategory.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { books: true } } },
  });
  if (!existing) throw new HttpError(404, 'Book category not found');
  if (existing._count.books > 0) throw new HttpError(409, 'Cannot delete category while books use it');

  await prisma.libraryBookCategory.delete({ where: { id } });
  await logAudit(req, {
    schoolId,
    entityType: 'LIBRARY_BOOK_CATEGORY',
    entityId: id,
    action: 'DELETE',
    beforeState: existing,
  });

  res.status(204).send();
};

export const listLibraryBooks = async (req: Request, res: Response) => {
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  const bookId = typeof req.query.bookId === 'string' ? req.query.bookId : undefined;

  const items = await prisma.libraryBook.findMany({
    where: {
      schoolId,
      ...(categoryId ? { categoryId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(bookId ? { id: bookId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { bookNumber: { contains: search, mode: 'insensitive' } },
              { isbnNumber: { contains: search, mode: 'insensitive' } },
              { publisherName: { contains: search, mode: 'insensitive' } },
              { authorName: { contains: search, mode: 'insensitive' } },
              { category: { name: { contains: search, mode: 'insensitive' } } },
              { subject: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: includeBook,
    orderBy: [{ title: 'asc' }, { createdAt: 'desc' }],
  });

  res.status(200).json(await mapBooksWithAvailability(items));
};

export const createLibraryBook = async (req: Request, res: Response) => {
  const payload = bookSchema.parse(req.body);
  const { schoolId } = requireLibraryManager(req, payload.schoolId);
  await Promise.all([assertCategory(schoolId, payload.categoryId), assertSubject(schoolId, payload.subjectId)]);

  try {
    const item = await prisma.libraryBook.create({
      data: {
        schoolId,
        categoryId: payload.categoryId,
        subjectId: payload.subjectId,
        title: normalizeText(payload.title),
        bookNumber: nullableText(payload.bookNumber),
        isbnNumber: nullableText(payload.isbnNumber),
        publisherName: nullableText(payload.publisherName),
        authorName: nullableText(payload.authorName),
        rackNumber: nullableText(payload.rackNumber),
        quantity: payload.quantity,
        price: payload.price == null ? null : new Prisma.Decimal(payload.price),
        description: nullableText(payload.description),
      },
      include: includeBook,
    });

    await logAudit(req, {
      schoolId,
      entityType: 'LIBRARY_BOOK',
      entityId: item.id,
      action: 'CREATE',
      afterState: item,
    });

    res.status(201).json(await bookWithAvailability(item.id));
  } catch (err) {
    handleUniqueError(err, 'Book number or ISBN already exists');
  }
};

export const updateLibraryBook = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = bookSchema.partial().parse(req.body);
  const { schoolId } = requireLibraryManager(req, payload.schoolId);
  const before = await getBookOrThrow(schoolId, id);
  const categoryId = payload.categoryId ?? before.categoryId;
  const subjectId = payload.subjectId ?? before.subjectId;
  await Promise.all([assertCategory(schoolId, categoryId), assertSubject(schoolId, subjectId)]);

  try {
    const item = await prisma.libraryBook.update({
      where: { id },
      data: {
        categoryId: payload.categoryId ?? undefined,
        subjectId: payload.subjectId ?? undefined,
        title: payload.title === undefined ? undefined : normalizeText(payload.title),
        bookNumber: payload.bookNumber === undefined ? undefined : nullableText(payload.bookNumber),
        isbnNumber: payload.isbnNumber === undefined ? undefined : nullableText(payload.isbnNumber),
        publisherName: payload.publisherName === undefined ? undefined : nullableText(payload.publisherName),
        authorName: payload.authorName === undefined ? undefined : nullableText(payload.authorName),
        rackNumber: payload.rackNumber === undefined ? undefined : nullableText(payload.rackNumber),
        quantity: payload.quantity ?? undefined,
        price: payload.price === undefined ? undefined : payload.price == null ? null : new Prisma.Decimal(payload.price),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
      },
      include: includeBook,
    });

    await logAudit(req, {
      schoolId,
      entityType: 'LIBRARY_BOOK',
      entityId: id,
      action: 'UPDATE',
      beforeState: before,
      afterState: item,
    });

    res.status(200).json(await bookWithAvailability(item.id));
  } catch (err) {
    handleUniqueError(err, 'Book number or ISBN already exists');
  }
};

export const deleteLibraryBook = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const existing = await prisma.libraryBook.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { issues: true } } },
  });
  if (!existing) throw new HttpError(404, 'Book not found');
  if (existing._count.issues > 0) throw new HttpError(409, 'Cannot delete book while issue records exist');

  await prisma.libraryBook.delete({ where: { id } });
  await logAudit(req, {
    schoolId,
    entityType: 'LIBRARY_BOOK',
    entityId: id,
    action: 'DELETE',
    beforeState: existing,
  });

  res.status(204).send();
};

export const listLibraryMembers = async (req: Request, res: Response) => {
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const active = typeof req.query.active === 'string' ? req.query.active === 'true' : undefined;

  const items = await prisma.libraryMember.findMany({
    where: {
      schoolId,
      ...(active === undefined ? {} : { active }),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { memberCode: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: includeMember,
    orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
  });

  res.status(200).json(items);
};

export const createLibraryMember = async (req: Request, res: Response) => {
  const payload = memberSchema.parse(req.body);
  const { schoolId } = requireLibraryManager(req, payload.schoolId);
  const rawCode = payload.memberCode ?? payload.memberId;
  if (!rawCode?.trim()) throw new HttpError(400, 'memberId is required');
  const resolved = await resolveMember(schoolId, payload.memberType, rawCode);

  try {
    const item = await prisma.libraryMember.upsert({
      where: {
        schoolId_memberType_memberCode: {
          schoolId,
          memberType: payload.memberType,
          memberCode: resolved.memberCode,
        },
      },
      update: {
        ...resolved,
        active: true,
        canceledAt: null,
      },
      create: {
        schoolId,
        memberType: payload.memberType,
        ...resolved,
      },
      include: includeMember,
    });

    await logAudit(req, {
      schoolId,
      entityType: 'LIBRARY_MEMBER',
      entityId: item.id,
      action: 'UPSERT',
      afterState: item,
    });

    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Library member already exists');
  }
};

export const cancelLibraryMember = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const existing = await getMemberOrThrow(schoolId, id);
  const activeIssues = await prisma.libraryIssue.count({ where: { schoolId, memberId: id, status: 'ISSUED' } });
  if (activeIssues > 0) throw new HttpError(409, 'Cannot cancel membership while books are issued');

  const item = await prisma.libraryMember.update({
    where: { id },
    data: { active: false, canceledAt: new Date() },
    include: includeMember,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'LIBRARY_MEMBER',
    entityId: id,
    action: 'CANCEL',
    beforeState: existing,
    afterState: item,
  });

  res.status(200).json(item);
};

export const listMemberIssues = async (req: Request, res: Response) => {
  const memberId = uuidSchema.parse(req.params.memberId);
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  await getMemberOrThrow(schoolId, memberId);

  const items = await prisma.libraryIssue.findMany({
    where: { schoolId, memberId },
    include: includeIssue,
    orderBy: [{ status: 'asc' }, { issueDate: 'desc' }],
  });

  res.status(200).json(items);
};

export const issueLibraryBook = async (req: Request, res: Response) => {
  const memberId = uuidSchema.parse(req.params.memberId);
  const payload = issueSchema.parse(req.body);
  const { schoolId, userId } = requireLibraryManager(req, payload.schoolId);
  const [member, book] = await Promise.all([getMemberOrThrow(schoolId, memberId), getBookOrThrow(schoolId, payload.bookId)]);
  if (!member.active) throw new HttpError(409, 'Library membership is canceled');

  const issuedCount = await prisma.libraryIssue.count({ where: { schoolId, bookId: book.id, status: 'ISSUED' } });
  if (issuedCount >= book.quantity) throw new HttpError(409, 'No available copies for this book');

  const item = await prisma.libraryIssue.create({
    data: {
      schoolId,
      memberId,
      bookId: book.id,
      returnDate: payload.returnDate ?? null,
      note: nullableText(payload.note),
      createdById: userId,
    },
    include: includeIssue,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'LIBRARY_ISSUE',
    entityId: item.id,
    action: 'CREATE',
    afterState: item,
  });

  res.status(201).json(item);
};

export const returnLibraryBook = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const { schoolId, userId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const before = await prisma.libraryIssue.findFirst({ where: { id, schoolId }, include: includeIssue });
  if (!before) throw new HttpError(404, 'Issued book record not found');
  if (before.status === 'RETURNED') throw new HttpError(409, 'Book is already returned');

  const item = await prisma.libraryIssue.update({
    where: { id },
    data: {
      status: 'RETURNED',
      returnedAt: new Date(),
      returnedById: userId,
    },
    include: includeIssue,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'LIBRARY_ISSUE',
    entityId: id,
    action: 'RETURN',
    beforeState: before,
    afterState: item,
  });

  res.status(200).json(item);
};

export const listIssuedLibraryBooks = async (req: Request, res: Response) => {
  const { schoolId } = requireLibraryManager(req, getRequestedSchoolId(req));
  const bookId = typeof req.query.bookId === 'string' ? req.query.bookId : undefined;
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  const bookNumber = typeof req.query.bookNumber === 'string' ? req.query.bookNumber.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' && ['ISSUED', 'RETURNED'].includes(req.query.status) ? (req.query.status as 'ISSUED' | 'RETURNED') : undefined;

  const and: Prisma.LibraryIssueWhereInput[] = [];
  if (bookId) and.push({ bookId });
  if (subjectId) and.push({ book: { subjectId } });
  if (bookNumber) and.push({ book: { bookNumber: { contains: bookNumber, mode: 'insensitive' } } });
  if (status) and.push({ status });
  if (search) {
    and.push({
      OR: [
        { book: { title: { contains: search, mode: 'insensitive' } } },
        { book: { bookNumber: { contains: search, mode: 'insensitive' } } },
        { book: { isbnNumber: { contains: search, mode: 'insensitive' } } },
        { book: { authorName: { contains: search, mode: 'insensitive' } } },
        { book: { subject: { name: { contains: search, mode: 'insensitive' } } } },
        { member: { fullName: { contains: search, mode: 'insensitive' } } },
        { member: { memberCode: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const items = await prisma.libraryIssue.findMany({
    where: {
      schoolId,
      ...(and.length ? { AND: and } : {}),
    },
    include: includeIssue,
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
  });

  res.status(200).json(items);
};
