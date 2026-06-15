import { redirect } from 'next/navigation';

export default function HolidaysPage() {
  redirect('/dashboard/academics?tab=holidays');
}
