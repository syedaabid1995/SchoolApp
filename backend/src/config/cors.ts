export const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

export const parseCorsOrigins = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const assertSafeCorsConfig = (params: { nodeEnv: string; corsOrigins: string }) => {
  const allowedOrigins = parseCorsOrigins(params.corsOrigins);
  if (params.nodeEnv === 'production' && (allowedOrigins.length === 0 || allowedOrigins.includes('*'))) {
    throw new Error('Production CORS_ORIGINS must list explicit HTTPS origins and cannot include "*".');
  }
  return allowedOrigins;
};

export const createCorsOriginChecker = (params: { nodeEnv: string; corsOrigins: string }) => {
  const allowedOrigins = assertSafeCorsConfig(params);
  const allowAllOrigins = params.nodeEnv !== 'production' && allowedOrigins.includes('*');

  return {
    allowedOrigins,
    allowAllOrigins,
    isOriginAllowed(origin: string | undefined) {
      if (!origin) return true;
      if (allowAllOrigins) return true;
      return allowedOrigins.includes(origin);
    },
  };
};
