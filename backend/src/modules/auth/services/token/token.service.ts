export type AuthTokenPayload = {
  sub: string;
  schoolId: string | null;
  role: string | null;
  email?: string | null;
  subscriptionRestricted?: boolean;
  jti?: string;
  typ: 'access' | 'refresh';
};

export const TokenService = {};
