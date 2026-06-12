export type FeeTenantScope = {
  schoolId: string;
  academicSessionId: string;
};

export const FeeRepository = {
  tenantScope(scope: FeeTenantScope) {
    return {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
    };
  },
};
