export const createMockPermissionSet = (...permissions: string[]) => new Set(permissions);

export const hasMockPermission = (permissions: Set<string>, permission: string) => permissions.has(permission);
