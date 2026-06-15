export const StudentRepository = {
  listInclude() {
    return {
      academicSession: { select: { id: true, name: true, isActive: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      studentGroup: { select: { id: true, name: true } },
      studentCategory: { select: { id: true, name: true } },
      enrollments: {
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: { enrolledAt: 'desc' as const },
        take: 1,
      },
      parentLinks: {
        include: {
          parent: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
        },
      },
      photos: { orderBy: { createdAt: 'desc' as const }, take: 1 },
    };
  },

  detailInclude() {
    return {
      academicSession: { select: { id: true, name: true, isActive: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      studentGroup: { select: { id: true, name: true } },
      studentCategory: { select: { id: true, name: true } },
      guardians: { orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }] },
      enrollments: {
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: { enrolledAt: 'desc' as const },
      },
      documents: { orderBy: { createdAt: 'desc' as const } },
      timelines: { orderBy: { timelineDate: 'desc' as const } },
      marks: {
        include: {
          examPaper: {
            include: {
              subject: { select: { id: true, name: true, code: true } },
              exam: { select: { id: true, name: true, type: true, status: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' as const },
      },
      siblings: {
        include: {
          sibling: {
            select: {
              id: true,
              admissionNo: true,
              rollNo: true,
              fullName: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      },
      parentLinks: { include: { parent: true } },
      photos: { orderBy: { createdAt: 'desc' as const } },
      statusEvents: { orderBy: { changedAt: 'desc' as const } },
    };
  },
};
