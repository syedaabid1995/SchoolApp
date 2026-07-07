import { redirect } from 'next/navigation';

export default async function LogsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      return;
    }
    if (typeof value === 'string') query.set(key, value);
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';
  redirect(`/dashboard/audit${suffix}`);
}
