'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../../components/Button';
import PageHeader from '../../../../../components/PageHeader';
import { useNotify } from '../../../../../components/NotificationProvider';
import { createExamRoom, deleteExamRoom, listExamCenters, listExamRooms, updateExamRoom, type ExamRoom } from '../../../../../services/report.service';

const emptyForm = { centerId: '', name: '', code: '', floor: '', capacity: 30, rows: 5, columns: 6, isActive: true };

export default function ExamRoomsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ExamRoom | null>(null);
  const [centerFilter, setCenterFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const { data: centers = [] } = useQuery({ queryKey: ['exam-centers'], queryFn: () => listExamCenters() });
  const { data: rooms = [], isLoading } = useQuery({ queryKey: ['exam-rooms', centerFilter], queryFn: () => listExamRooms(centerFilter ? { centerId: centerFilter } : undefined) });

  const saveMutation = useMutation({
    mutationFn: () => editing ? updateExamRoom(editing.id, form) : createExamRoom(form),
    onSuccess: () => {
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['exam-rooms'] });
      notify.success('Saved', 'Exam room saved successfully.');
    },
    onError: (error: any) => notify.error('Save failed', error?.response?.data?.error?.message || 'Unable to save room.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExamRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-rooms'] });
      notify.success('Deleted', 'Exam room deleted.');
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message || 'Unable to delete room.'),
  });

  const startEdit = (room: ExamRoom) => {
    setEditing(room);
    setForm({ centerId: room.centerId, name: room.name, code: room.code, floor: room.floor ?? '', capacity: room.capacity, rows: room.rows, columns: room.columns, isActive: room.isActive });
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader title="Exam Rooms" subtitle="Configure room capacities and seat grids for exam centers." />
        <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-4 max-w-sm">
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)}>
              <option value="">All centers</option>
              {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
          </div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">{editing ? 'Edit Room' : 'Create Room'}</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2 text-sm" value={form.centerId} onChange={(e) => setForm({ ...form, centerId: e.target.value })}>
              <option value="">Select center</option>
              {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Room name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            <input className="rounded-lg border px-3 py-2 text-sm" type="number" min={1} placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            <input className="rounded-lg border px-3 py-2 text-sm" type="number" min={1} placeholder="Rows" value={form.rows} onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })} />
            <input className="rounded-lg border px-3 py-2 text-sm" type="number" min={1} placeholder="Columns" value={form.columns} onChange={(e) => setForm({ ...form, columns: Number(e.target.value) })} />
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>Save</Button>
            {editing ? <Button size="sm" variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button> : null}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Room</th><th className="p-3">Center</th><th className="p-3">Capacity</th><th className="p-3">Grid</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-4" colSpan={6}>Loading rooms...</td></tr> : null}
              {!isLoading && !rooms.length ? <tr><td className="p-4 text-gray-500" colSpan={6}>No exam rooms configured.</td></tr> : null}
              {rooms.map((room) => (
                <tr key={room.id} className="border-t">
                  <td className="p-3"><div className="font-medium text-gray-900">{room.name}</div><div className="text-xs text-gray-500">{room.code} · Floor {room.floor || '-'}</div></td>
                  <td className="p-3">{room.center?.name ?? '-'}</td>
                  <td className="p-3">{room.capacity}</td>
                  <td className="p-3">{room.rows} x {room.columns}</td>
                  <td className="p-3">{room.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => startEdit(room)}>Edit</Button><Button className="ml-2" size="sm" variant="danger" onClick={() => window.confirm('Delete this room?') && deleteMutation.mutate(room.id)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
