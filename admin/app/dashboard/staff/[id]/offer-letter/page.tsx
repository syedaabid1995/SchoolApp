'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../../components/FullPageLoader';
import PageHeader from '../../../../../components/PageHeader';
import { getSession } from '../../../../../services/auth.service';
import { getStaff, type Staff } from '../../../../../services/staff.service';

const fullName = (staff?: Staff | null) => (staff ? staff.fullName ?? `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() : '');

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const formatMoney = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
};

const roleLabel = (value?: string | null) => String(value ?? '').replace('_', ' ') || '-';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="border-b border-slate-200 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value || '-'}</p>
    </div>
  );
}

export default function OfferLetterPage() {
  const params = useParams();
  const staffId = params.id as string;
  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const canViewOfferLetter = isSchoolAdmin || permissionCodes.includes('staff.view') || permissionCodes.includes('staff.document.view');
  const staffQuery = useQuery({ queryKey: ['staff-detail', staffId], queryFn: () => getStaff(staffId), enabled: Boolean(canViewOfferLetter && staffId) });
  const staff = staffQuery.data;

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking staff access..." />;
  if (!canViewOfferLetter) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Offer letters are not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }
  if (staffQuery.isLoading) return <FullPageLoader label="Preparing offer letter..." />;

  if (!staff) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <PageHeader title="Offer Letter Not Found" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees', href: '/dashboard/staff' }, { label: 'Offer Letter' }]} />
      </div>
    );
  }

  const name = fullName(staff);
  const schoolName = session.schoolName ?? 'School Administration';
  const designation = staff.designation?.name ?? roleLabel(staff.role ?? staff.roleName);
  const department = staff.department?.name ?? '-';
  const salary = staff.payrollInfo?.basicSalary ? formatMoney(staff.payrollInfo.basicSalary) : 'As per approved payroll';

  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white print:pb-0">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 print:max-w-none print:p-0">
        <div className="print:hidden">
          <PageHeader
            title="Offer Letter"
            subtitle="Printable appointment letter generated from the employee profile."
            breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees', href: '/dashboard/staff' }, { label: name, href: `/dashboard/staff/${staff.id}` }, { label: 'Offer Letter' }]}
            actions={
              <div className="flex flex-wrap gap-2">
                <button onClick={() => window.print()} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">Print</button>
                <Link href={`/dashboard/staff/${staff.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Back</Link>
              </div>
            }
          />
        </div>

        <article className="mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-10 print:shadow-none">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-700">Offer Letter</p>
                <h1 className="mt-2 text-3xl font-black text-slate-950">{schoolName}</h1>
                <p className="mt-2 text-sm font-semibold text-slate-500">Appointment and employment confirmation</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Employee No</p>
                <p className="mt-1 text-lg font-black text-slate-950">{staff.employeeNo ?? staff.staffNo ?? '-'}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Generated On</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </header>

          <section className="mt-8 space-y-5 text-[15px] leading-7 text-slate-700">
            <p>Dear {name},</p>
            <p>
              We are pleased to offer you the position of <strong className="text-slate-950">{designation}</strong>
              {department !== '-' ? <> in the <strong className="text-slate-950">{department}</strong> department</> : null}. This offer is based on the details approved in your employee profile and is subject to the institution&apos;s employment policies.
            </p>
            <p>
              Your employment will start from <strong className="text-slate-950">{formatDate(staff.dateOfJoining)}</strong>. You will be provided system login access according to the assigned role <strong className="text-slate-950">{roleLabel(staff.role ?? staff.roleName)}</strong>.
            </p>
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-base font-black text-slate-950">Appointment Details</h2>
              <div className="mt-3">
                <DetailRow label="Employee Name" value={name} />
                <DetailRow label="Designation" value={designation} />
                <DetailRow label="Department" value={department} />
                <DetailRow label="Login Role" value={roleLabel(staff.role ?? staff.roleName)} />
                <DetailRow label="Joining Date" value={formatDate(staff.dateOfJoining)} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-base font-black text-slate-950">Compensation & Contact</h2>
              <div className="mt-3">
                <DetailRow label="Basic Salary" value={salary} />
                <DetailRow label="Contract Type" value={staff.payrollInfo?.contractType} />
                <DetailRow label="Payment Mode" value={staff.payrollInfo?.paymentMode} />
                <DetailRow label="Mobile" value={staff.phone} />
                <DetailRow label="Email" value={staff.user?.email ?? staff.email} />
              </div>
            </div>
          </section>

          <section className="mt-8 space-y-4 text-[15px] leading-7 text-slate-700">
            <p>
              Please report to the school administration on the joining date with the required identity, qualification, address, bank, and experience documents. Salary, leave, attendance, and conduct will be managed according to school policy.
            </p>
            <p>
              We look forward to your contribution and confirm that this offer letter is generated automatically by the school management system.
            </p>
          </section>

          <footer className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <div className="h-16 border-b border-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-950">Authorized Signature</p>
              <p className="text-xs text-slate-500">{schoolName}</p>
            </div>
            <div>
              <div className="h-16 border-b border-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-950">Employee Acceptance</p>
              <p className="text-xs text-slate-500">{name}</p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
