export type Role = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT';

export const isSuperAdmin = (role?: string | null) => role === 'SUPER_ADMIN';

export const isSchoolAdmin = (role?: string | null) => role === 'SCHOOL_ADMIN';
