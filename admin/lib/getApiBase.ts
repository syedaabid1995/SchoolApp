export const getApiBase = () => {
  const base =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3000/api/v1');

  if (!base) {
    throw new Error('Missing API base URL. Set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL.');
  }

  return base.replace(/\/+$/, '');
};

