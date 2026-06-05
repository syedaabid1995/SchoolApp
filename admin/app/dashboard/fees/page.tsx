import { redirect } from 'next/navigation';

export default function FeesRootPage() {
  redirect('/dashboard/fees/overview');
}