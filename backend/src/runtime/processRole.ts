export type AcademifyProcessRole = 'api' | 'worker' | 'scheduler' | 'all';

const validRoles: AcademifyProcessRole[] = ['api', 'worker', 'scheduler', 'all'];

export const parseProcessRole = (value: string | undefined, nodeEnv: 'development' | 'test' | 'production'): AcademifyProcessRole => {
  const normalized = (value?.trim().toLowerCase() || (nodeEnv === 'production' ? 'api' : 'all')) as AcademifyProcessRole;
  if (!validRoles.includes(normalized)) {
    throw new Error(`Invalid ACADEMIFY_PROCESS_ROLE "${value}". Expected one of: ${validRoles.join(', ')}`);
  }
  return normalized;
};

export const assertProcessRoleAllowed = (role: AcademifyProcessRole, nodeEnv: 'development' | 'test' | 'production') => {
  if (nodeEnv === 'production' && role === 'all') {
    throw new Error('ACADEMIFY_PROCESS_ROLE=all is not allowed in production. Run separate api, worker, and scheduler processes.');
  }
};

export const processRoleStartsApi = (role: AcademifyProcessRole) => role === 'api' || role === 'all';
export const processRoleStartsWorkers = (role: AcademifyProcessRole) => role === 'worker' || role === 'all';
export const processRoleStartsSchedulers = (role: AcademifyProcessRole) => role === 'scheduler' || role === 'all';
