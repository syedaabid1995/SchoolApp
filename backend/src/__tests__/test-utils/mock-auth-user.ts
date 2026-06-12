export type MockAuthUser = {
  userId: string;
  schoolId: string | null;
  role?: string | null;
};

export const createMockAuthUser = (overrides: Partial<MockAuthUser> = {}): MockAuthUser => ({
  userId: overrides.userId ?? '33333333-3333-4333-8333-333333333333',
  schoolId: overrides.schoolId === undefined ? '11111111-1111-4111-8111-111111111111' : overrides.schoolId,
  role: overrides.role ?? 'SCHOOL_ADMIN',
});
