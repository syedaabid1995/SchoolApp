import { redirect } from 'next/navigation';
import { getServerToken } from '../lib/auth';

export default async function HomePage() {
  const token = await getServerToken();
  redirect(token ? '/dashboard' : '/login');
}
