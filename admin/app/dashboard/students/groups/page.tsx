'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  createStudentCategory,
  createStudentGroup,
  deleteStudentCategory,
  deleteStudentGroup,
  listStudentCategories,
  listStudentGroups,
  updateStudentCategory,
  updateStudentGroup,
  type StudentCategory,
  type StudentGroup,
} from '../../../../services/student-operations.service';
import { SchoolAdminOnly } from '../_components/SchoolAdminOnly';

type Mode = 'groups' | 'categories';

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">{label}</div>
);

export default function StudentGroupsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('groups');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';

  const groupsQuery = useQuery({ queryKey: ['student-groups', search], queryFn: () => listStudentGroups({ search }), enabled: isSchoolAdmin });
  const categoriesQuery = useQuery({ queryKey: ['student-categories', search], queryFn: () => listStudentCategories({ search }), enabled: isSchoolAdmin });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['student-groups'] });
    queryClient.invalidateQueries({ queryKey: ['student-categories'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim() };
      if (!payload.name) throw new Error('Name is required.');
      if (mode === 'groups') return editing ? updateStudentGroup(editing.id, payload) : createStudentGroup(payload);
      return editing ? updateStudentCategory(editing.id, payload) : createStudentCategory(payload);
    },
    onSuccess: () => {
      notify.success(editing ? 'Updated' : 'Created', `${mode === 'groups' ? 'Student group' : 'Student category'} saved.`);
      setName('');
      setEditing(null);
      invalidate();
    },
    onError: (error: any) => notify.error('Save failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: StudentGroup | StudentCategory) => (mode === 'groups' ? deleteStudentGroup(item.id) : deleteStudentCategory(item.id)),
    onSuccess: () => {
      notify.success('Deleted', `${mode === 'groups' ? 'Student group' : 'Student category'} removed.`);
      invalidate();
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete.'),
  });

  const rows = mode === 'groups' ? groupsQuery.data ?? [] : categoriesQuery.data ?? [];
  const loading = mode === 'groups' ? groupsQuery.isLoading : categoriesQuery.isLoading;

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking student setup access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="student groups and categories" />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Groups & Categories"
          subtitle="Maintain student grouping and category/type masters for your school."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Groups & Categories' }]}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => { setMode('groups'); setEditing(null); setName(''); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'groups' ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)]' : 'border border-slate-200 bg-white text-slate-700'}`}>Student Group</button>
          <button onClick={() => { setMode('categories'); setEditing(null); setName(''); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'categories' ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)]' : 'border border-slate-200 bg-white text-slate-700'}`}>Student Category</button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">{editing ? 'Edit' : 'Add'} {mode === 'groups' ? 'Group' : 'Category'}</h2>
            <p className="mt-1 text-sm text-slate-500">Only School Admin can manage these records.</p>
            <div className="mt-5">
              <label className="text-sm font-semibold text-slate-700">Name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === 'groups' ? 'Example: Blue House' : 'Example: General'} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 flex gap-2">
              <button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)] shadow-sm disabled:opacity-50">
                {editing ? 'Update' : 'Save'}
              </button>
              {editing ? (
                <button onClick={() => { setEditing(null); setName(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{mode === 'groups' ? 'Student Group List' : 'Student Category List'}</h2>
                <p className="text-sm text-slate-500">{rows.length} records found.</p>
              </div>
              <div className="flex gap-2">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Quick search" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button onClick={() => window.print()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Print</button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : rows.length ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Linked Students</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="px-4 py-3">{item._count?.students ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button onClick={() => { setEditing(item); setName(item.name); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Edit</button>
                            <button onClick={() => window.confirm('Delete this record?') && deleteMutation.mutate(item)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState label={mode === 'groups' ? 'No student groups found.' : 'No student categories found.'} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
