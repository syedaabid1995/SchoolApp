'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../../components/Button';
import PageHeader from '../../../../../components/PageHeader';
import { useNotify } from '../../../../../components/NotificationProvider';
import { createExamCenter, deleteExamCenter, listExamCenters, updateExamCenter, type ExamCenter } from '../../../../../services/report.service';

const emptyForm = { name: '', code: '', address: '', contactPerson: '', phone: '', isActive: true };

export default function ExamCentersPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ExamCenter | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { data: centers = [], isLoading } = useQuery({ queryKey: ['exam-centers'], queryFn: () => listExamCenters() });

  const saveMutation = useMutation({
    mutationFn: () => editing ? updateExamCenter(editing.id, form) : createExamCenter(form),
    onSuccess: () => {
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['exam-centers'] });
      notify.success('Saved', 'Exam center saved successfully.');
    },
    onError: (error: any) => notify.error('Save failed', error?.response?.data?.error?.message || 'Unable to save center.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExamCenter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-centers'] });
      notify.success('Deleted', 'Exam center deleted.');
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message || 'Unable to delete center.'),
  });

  const startEdit = (center: ExamCenter) => {
    setEditing(center);
    setForm({
      name: center.name,
      code: center.code,
      address: center.address,
      contactPerson: center.contactPerson ?? '',
      phone: center.phone ?? '',
      isActive: center.isActive,
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader title="Exam Centers" subtitle="Manage exam center locations used for seating and hall tickets." />
        <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-900">{editing ? 'Edit Center' : 'Create Center'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>Save</Button>
            {editing ? <Button size="sm" variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button> : null}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Center</th><th className="p-3">Contact</th><th className="p-3">Rooms</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-4" colSpan={5}>Loading centers...</td></tr> : null}
              {!isLoading && !centers.length ? <tr><td className="p-4 text-gray-500" colSpan={5}>No exam centers configured.</td></tr> : null}
              {centers.map((center) => (
                <tr key={center.id} className="border-t">
                  <td className="p-3"><div className="font-medium text-gray-900">{center.name}</div><div className="text-xs text-gray-500">{center.code} · {center.address}</div></td>
                  <td className="p-3">{center.contactPerson || '-'}<div className="text-xs text-gray-500">{center.phone || ''}</div></td>
                  <td className="p-3">{center._count?.rooms ?? 0}</td>
                  <td className="p-3">{center.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => startEdit(center)}>Edit</Button><Button className="ml-2" size="sm" variant="danger" onClick={() => window.confirm('Delete this center?') && deleteMutation.mutate(center.id)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
