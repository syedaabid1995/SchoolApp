import { redirect } from 'next/navigation';

export default function StudentAttendancePage() {
  redirect('/dashboard/attendance/students/mark');
}
