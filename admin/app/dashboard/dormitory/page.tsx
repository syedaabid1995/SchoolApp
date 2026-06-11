'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listClasses, listSections } from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import { listStudents, type Student } from '../../../services/student.service';
import {
  createStudentDormitoryAssignment,
  createDormitory,
  createDormitoryRoom,
  createDormitoryRoomType,
  deleteStudentDormitoryAssignment,
  deleteDormitory,
  deleteDormitoryRoom,
  deleteDormitoryRoomType,
  getStudentDormitoryReport,
  listStudentDormitoryAssignments,
  listDormitories,
  listDormitoryRooms,
  listDormitoryRoomTypes,
  updateStudentDormitoryAssignment,
  updateDormitory,
  updateDormitoryRoom,
  updateDormitoryRoomType,
  type Dormitory,
  type DormitoryRoom,
  type DormitoryRoomType,
  type StudentDormitoryAssignment,
  type StudentDormitoryReportRow,
} from '../../../services/dormitory.service';

type TabId = 'dormitories' | 'room-types' | 'rooms' | 'studentAssign' | 'report';

type AcademicOption = {
  id: string;
  name: string;
  classId?: string | null;
};

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: 'dormitories', label: 'Dormitory', description: 'Hostel names, type, address, and intake' },
  { id: 'room-types', label: 'Room Type', description: 'Available room categories' },
  { id: 'rooms', label: 'Dormitory Rooms', description: 'Room number, beds, type, and cost' },
  { id: 'studentAssign', label: 'Student Assign', description: 'Assign students to dormitory rooms' },
  { id: 'report', label: 'Student Report', description: 'Search students by class, section, and dormitory' },
];

const emptyDormitoryForm = { id: '', name: '', type: '', intake: '120', address: '', description: '' };
const emptyRoomTypeForm = { id: '', name: '', description: '' };
const emptyRoomForm = { id: '', dormitoryId: '', roomTypeId: '', roomNumber: '', bedCount: '1', costPerBed: '0', description: '' };
const emptyStudentAssignForm = { id: '', classId: '', sectionId: '', studentId: '', dormitoryId: '', roomId: '', note: '' };
const emptyReportFilters = { classId: '', sectionId: '', dormitoryId: '' };

const getErrorMessage = (error: unknown, fallback = 'Something went wrong') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

const money = (value?: string | number | null) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-400';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const PrimaryButton = ({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[var(--theme-button-bg)] to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const DangerButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const FormCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-950">{title}</h2>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const ListCard = ({
  title,
  children,
  search,
  setSearch,
}: {
  title: string;
  children: React.ReactNode;
  search?: string;
  setSearch?: (value: string) => void;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {setSearch ? (
        <input className={`${inputClass} sm:max-w-xs`} placeholder="Quick search..." value={search ?? ''} onChange={(event) => setSearch(event.target.value)} />
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

export default function DormitoryPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TabId>('dormitories');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [search, setSearch] = useState('');
  const [dormitoryForm, setDormitoryForm] = useState(emptyDormitoryForm);
  const [roomTypeForm, setRoomTypeForm] = useState(emptyRoomTypeForm);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [studentAssignForm, setStudentAssignForm] = useState(emptyStudentAssignForm);
  const [reportFilters, setReportFilters] = useState(emptyReportFilters);
  const [submittedReportFilters, setSubmittedReportFilters] = useState(emptyReportFilters);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const schoolsQuery = useQuery({
    queryKey: ['schools', 'dormitory'],
    queryFn: () => listSchools({ limit: 100, status: 'ACTIVE' }),
    enabled: Boolean(isSuperAdmin),
  });

  useEffect(() => {
    if (isSuperAdmin && !selectedSchoolId && schoolsQuery.data?.items?.length) {
      setSelectedSchoolId(schoolsQuery.data.items[0].id);
    }
  }, [isSuperAdmin, schoolsQuery.data?.items, selectedSchoolId]);

  const effectiveSchoolId = isSuperAdmin ? selectedSchoolId : session?.schoolId ?? '';
  const scopedParams = effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined;
  const canUsePage = isSuperAdmin || isSchoolAdmin || permissionCodes.includes('dormitory.view');
  const canQuery = Boolean(canUsePage && effectiveSchoolId);

  const dormitoriesQuery = useQuery({
    queryKey: ['dormitories', effectiveSchoolId, search],
    queryFn: () => listDormitories({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const roomTypesQuery = useQuery({
    queryKey: ['dormitory-room-types', effectiveSchoolId, search],
    queryFn: () => listDormitoryRoomTypes({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const roomsQuery = useQuery({
    queryKey: ['dormitory-rooms', effectiveSchoolId, search],
    queryFn: () => listDormitoryRooms({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const studentAssignmentsQuery = useQuery({
    queryKey: ['student-dormitory-assignments', effectiveSchoolId, search],
    queryFn: () => listStudentDormitoryAssignments({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const classesQuery = useQuery({
    queryKey: ['dormitory-classes', effectiveSchoolId],
    queryFn: () => listClasses(scopedParams),
    enabled: canQuery,
  });
  const studentAssignSectionsQuery = useQuery({
    queryKey: ['dormitory-student-assign-sections', effectiveSchoolId, studentAssignForm.classId],
    queryFn: () => listSections({ ...scopedParams, classId: studentAssignForm.classId }),
    enabled: canQuery && Boolean(studentAssignForm.classId),
  });
  const studentsQuery = useQuery({
    queryKey: ['dormitory-students', effectiveSchoolId, studentAssignForm.classId, studentAssignForm.sectionId],
    queryFn: () =>
      listStudents({
        ...scopedParams,
        status: 'ENROLLED',
        classId: studentAssignForm.classId,
        sectionId: studentAssignForm.sectionId,
      }),
    enabled: canQuery && Boolean(studentAssignForm.classId && studentAssignForm.sectionId),
  });
  const sectionsQuery = useQuery({
    queryKey: ['dormitory-sections', effectiveSchoolId, reportFilters.classId],
    queryFn: () => listSections({ ...scopedParams, classId: reportFilters.classId }),
    enabled: canQuery && Boolean(reportFilters.classId),
  });
  const reportQuery = useQuery({
    queryKey: ['student-dormitory-report', effectiveSchoolId, submittedReportFilters],
    queryFn: () => getStudentDormitoryReport({ ...scopedParams, ...submittedReportFilters }),
    enabled: canQuery && Boolean(submittedReportFilters.classId && submittedReportFilters.sectionId && submittedReportFilters.dormitoryId),
  });

  const dormitories = dormitoriesQuery.data ?? [];
  const roomTypes = roomTypesQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const studentAssignments = studentAssignmentsQuery.data ?? [];
  const classes = (classesQuery.data ?? []) as AcademicOption[];
  const studentAssignSections = (studentAssignSectionsQuery.data ?? []) as AcademicOption[];
  const students = (studentsQuery.data ?? []) as Student[];
  const sections = (sectionsQuery.data ?? []) as AcademicOption[];

  const studentAssignRooms = useMemo(
    () => rooms.filter((room) => !studentAssignForm.dormitoryId || room.dormitoryId === studentAssignForm.dormitoryId),
    [rooms, studentAssignForm.dormitoryId],
  );

  const invalidateDormitory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dormitories'] }),
      queryClient.invalidateQueries({ queryKey: ['dormitory-room-types'] }),
      queryClient.invalidateQueries({ queryKey: ['dormitory-rooms'] }),
      queryClient.invalidateQueries({ queryKey: ['student-dormitory-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['student-dormitory-report'] }),
    ]);
  };

  const onSuccess = async (title: string) => {
    notify.success(title);
    await invalidateDormitory();
  };
  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const dormitoryMutation = useMutation({
    mutationFn: () =>
      dormitoryForm.id
        ? updateDormitory(dormitoryForm.id, {
            ...scopedParams,
            name: dormitoryForm.name,
            type: dormitoryForm.type,
            intake: Number(dormitoryForm.intake),
            address: dormitoryForm.address || null,
            description: dormitoryForm.description || null,
          })
        : createDormitory({
            ...scopedParams,
            name: dormitoryForm.name,
            type: dormitoryForm.type,
            intake: Number(dormitoryForm.intake),
            address: dormitoryForm.address || null,
            description: dormitoryForm.description || null,
          }),
    onSuccess: () => {
      setDormitoryForm(emptyDormitoryForm);
      onSuccess('Dormitory saved');
    },
    onError,
  });

  const roomTypeMutation = useMutation({
    mutationFn: () =>
      roomTypeForm.id
        ? updateDormitoryRoomType(roomTypeForm.id, { ...scopedParams, name: roomTypeForm.name, description: roomTypeForm.description || null })
        : createDormitoryRoomType({ ...scopedParams, name: roomTypeForm.name, description: roomTypeForm.description || null }),
    onSuccess: () => {
      setRoomTypeForm(emptyRoomTypeForm);
      onSuccess('Room type saved');
    },
    onError,
  });

  const roomMutation = useMutation({
    mutationFn: () =>
      roomForm.id
        ? updateDormitoryRoom(roomForm.id, {
            ...scopedParams,
            dormitoryId: roomForm.dormitoryId,
            roomTypeId: roomForm.roomTypeId,
            roomNumber: roomForm.roomNumber,
            bedCount: Number(roomForm.bedCount),
            costPerBed: Number(roomForm.costPerBed),
            description: roomForm.description || null,
          })
        : createDormitoryRoom({
            ...scopedParams,
            dormitoryId: roomForm.dormitoryId,
            roomTypeId: roomForm.roomTypeId,
            roomNumber: roomForm.roomNumber,
            bedCount: Number(roomForm.bedCount),
            costPerBed: Number(roomForm.costPerBed),
            description: roomForm.description || null,
          }),
    onSuccess: () => {
      setRoomForm(emptyRoomForm);
      onSuccess('Dormitory room saved');
    },
    onError,
  });

  const studentAssignMutation = useMutation({
    mutationFn: () =>
      studentAssignForm.id
        ? updateStudentDormitoryAssignment(studentAssignForm.id, {
            ...scopedParams,
            studentId: studentAssignForm.studentId,
            dormitoryId: studentAssignForm.dormitoryId,
            roomId: studentAssignForm.roomId || null,
            active: true,
            note: studentAssignForm.note || null,
          })
        : createStudentDormitoryAssignment({
            ...scopedParams,
            studentId: studentAssignForm.studentId,
            dormitoryId: studentAssignForm.dormitoryId,
            roomId: studentAssignForm.roomId || null,
            active: true,
            note: studentAssignForm.note || null,
          }),
    onSuccess: () => {
      setStudentAssignForm(emptyStudentAssignForm);
      onSuccess('Student dormitory assignment saved');
    },
    onError,
  });

  const confirmDelete = (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    action()
      .then(() => onSuccess('Deleted'))
      .catch(onError);
  };

  const validateDormitory = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!dormitoryForm.name.trim()) return notify.error('Validation error', 'Dormitory name is required.');
    if (!dormitoryForm.type.trim()) return notify.error('Validation error', 'Dormitory type is required.');
    if (!Number(dormitoryForm.intake) || Number(dormitoryForm.intake) < 1) return notify.error('Validation error', 'Intake must be greater than 0.');
    dormitoryMutation.mutate();
  };

  const validateRoomType = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!roomTypeForm.name.trim()) return notify.error('Validation error', 'Room type is required.');
    roomTypeMutation.mutate();
  };

  const validateRoom = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!roomForm.dormitoryId) return notify.error('Validation error', 'Select dormitory.');
    if (!roomForm.roomTypeId) return notify.error('Validation error', 'Select room type.');
    if (!roomForm.roomNumber.trim()) return notify.error('Validation error', 'Room number is required.');
    if (!Number(roomForm.bedCount) || Number(roomForm.bedCount) < 1) return notify.error('Validation error', 'Number of beds must be greater than 0.');
    if (Number(roomForm.costPerBed) < 0) return notify.error('Validation error', 'Cost per bed cannot be negative.');
    roomMutation.mutate();
  };

  const validateStudentAssign = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!studentAssignForm.classId) return notify.error('Validation error', 'Select class.');
    if (!studentAssignForm.sectionId) return notify.error('Validation error', 'Select section.');
    if (!studentAssignForm.studentId) return notify.error('Validation error', 'Select student.');
    if (!studentAssignForm.dormitoryId) return notify.error('Validation error', 'Select dormitory.');
    studentAssignMutation.mutate();
  };

  const searchReport = () => {
    if (!reportFilters.classId || !reportFilters.sectionId || !reportFilters.dormitoryId) {
      return notify.error('Validation error', 'Select class, section, and dormitory.');
    }
    setSubmittedReportFilters(reportFilters);
  };

  const editStudentAssignment = (assignment: StudentDormitoryAssignment) => {
    setStudentAssignForm({
      id: assignment.id,
      classId: assignment.student.class?.id ?? '',
      sectionId: assignment.student.section?.id ?? '',
      studentId: assignment.student.id,
      dormitoryId: assignment.dormitoryId,
      roomId: assignment.roomId ?? '',
      note: assignment.note ?? '',
    });
  };

  useEffect(() => {
    setDormitoryForm(emptyDormitoryForm);
    setRoomTypeForm(emptyRoomTypeForm);
    setRoomForm(emptyRoomForm);
    setStudentAssignForm(emptyStudentAssignForm);
    setReportFilters(emptyReportFilters);
    setSubmittedReportFilters(emptyReportFilters);
    setSearch('');
  }, [effectiveSchoolId]);

  useEffect(() => {
    setReportFilters((current) => ({ ...current, sectionId: '' }));
  }, [reportFilters.classId]);

  const pageActions = isSuperAdmin ? (
    <select className={`${inputClass} min-w-64`} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
      <option value="">Select school</option>
      {schoolsQuery.data?.items.map((school) => (
        <option key={school.id} value={school.id}>
          {school.name} ({school.code})
        </option>
      ))}
    </select>
  ) : null;

  if (sessionLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Checking dormitory access...</div>;
  }

  if (!canUsePage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-950">Dormitory is not available for your role.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dormitory"
        subtitle="Manage dormitories, room types, rooms, student assignments, and dormitory reports."
        actions={pageActions}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-5">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-3 text-left transition ${
                  active ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-1 block text-xs ${active ? 'text-purple-100' : 'text-slate-500'}`}>{tab.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!effectiveSchoolId ? <EmptyState message="Select a school to manage dormitory records." /> : null}

      {effectiveSchoolId && activeTab === 'dormitories' ? (
        <SimpleCrudLayout
          title={dormitoryForm.id ? 'Edit Dormitory' : 'Add Dormitory'}
          listTitle="Dormitory List"
          search={search}
          setSearch={setSearch}
          isLoading={dormitoriesQuery.isLoading}
          emptyMessage="No dormitories found."
          form={
            <>
              <Field label="Dormitory name *">
                <input className={inputClass} value={dormitoryForm.name} onChange={(e) => setDormitoryForm((p) => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label="Type *">
                <input className={inputClass} placeholder="Boys, Girls, Staff..." value={dormitoryForm.type} onChange={(e) => setDormitoryForm((p) => ({ ...p, type: e.target.value }))} />
              </Field>
              <Field label="Address">
                <input className={inputClass} value={dormitoryForm.address} onChange={(e) => setDormitoryForm((p) => ({ ...p, address: e.target.value }))} />
              </Field>
              <Field label="Intake *">
                <input className={inputClass} type="number" min={1} value={dormitoryForm.intake} onChange={(e) => setDormitoryForm((p) => ({ ...p, intake: e.target.value }))} />
              </Field>
              <Field label="Description">
                <textarea className={inputClass} rows={3} value={dormitoryForm.description} onChange={(e) => setDormitoryForm((p) => ({ ...p, description: e.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={dormitoryMutation.isPending} onClick={validateDormitory}>Save Dormitory</PrimaryButton>
                {dormitoryForm.id ? <SecondaryButton onClick={() => setDormitoryForm(emptyDormitoryForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <DormitoryTable
              items={dormitories}
              onEdit={(item) => setDormitoryForm({
                id: item.id,
                name: item.name,
                type: item.type,
                intake: String(item.intake),
                address: item.address ?? '',
                description: item.description ?? '',
              })}
              onDelete={(item) => confirmDelete(`Delete dormitory "${item.name}"?`, () => deleteDormitory(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'room-types' ? (
        <SimpleCrudLayout
          title={roomTypeForm.id ? 'Edit Room Type' : 'Add Room Type'}
          listTitle="Room Type List"
          search={search}
          setSearch={setSearch}
          isLoading={roomTypesQuery.isLoading}
          emptyMessage="No room types found."
          form={
            <>
              <Field label="Room type *">
                <input className={inputClass} value={roomTypeForm.name} onChange={(e) => setRoomTypeForm((p) => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label="Description">
                <textarea className={inputClass} rows={4} value={roomTypeForm.description} onChange={(e) => setRoomTypeForm((p) => ({ ...p, description: e.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={roomTypeMutation.isPending} onClick={validateRoomType}>Save Room Type</PrimaryButton>
                {roomTypeForm.id ? <SecondaryButton onClick={() => setRoomTypeForm(emptyRoomTypeForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <RoomTypeTable
              items={roomTypes}
              onEdit={(item) => setRoomTypeForm({ id: item.id, name: item.name, description: item.description ?? '' })}
              onDelete={(item) => confirmDelete(`Delete room type "${item.name}"?`, () => deleteDormitoryRoomType(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'rooms' ? (
        <SimpleCrudLayout
          title={roomForm.id ? 'Edit Dormitory Room' : 'Add Dormitory Rooms'}
          listTitle="Dormitory Room List"
          search={search}
          setSearch={setSearch}
          isLoading={roomsQuery.isLoading}
          emptyMessage="No dormitory rooms found."
          form={
            <>
              <Field label="Dormitory *">
                <select className={inputClass} value={roomForm.dormitoryId} onChange={(e) => setRoomForm((p) => ({ ...p, dormitoryId: e.target.value }))}>
                  <option value="">Select dormitory</option>
                  {dormitories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Room number *">
                <input className={inputClass} value={roomForm.roomNumber} onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))} />
              </Field>
              <Field label="Room type *">
                <select className={inputClass} value={roomForm.roomTypeId} onChange={(e) => setRoomForm((p) => ({ ...p, roomTypeId: e.target.value }))}>
                  <option value="">Select room type</option>
                  {roomTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Number of bed *">
                <input className={inputClass} type="number" min={1} value={roomForm.bedCount} onChange={(e) => setRoomForm((p) => ({ ...p, bedCount: e.target.value }))} />
              </Field>
              <Field label="Cost per bed *">
                <input className={inputClass} type="number" min={0} step="0.01" value={roomForm.costPerBed} onChange={(e) => setRoomForm((p) => ({ ...p, costPerBed: e.target.value }))} />
              </Field>
              <Field label="Description">
                <textarea className={inputClass} rows={3} value={roomForm.description} onChange={(e) => setRoomForm((p) => ({ ...p, description: e.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={roomMutation.isPending} onClick={validateRoom}>Save Room</PrimaryButton>
                {roomForm.id ? <SecondaryButton onClick={() => setRoomForm(emptyRoomForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <RoomTable
              items={rooms}
              onEdit={(item) => setRoomForm({
                id: item.id,
                dormitoryId: item.dormitoryId,
                roomTypeId: item.roomTypeId,
                roomNumber: item.roomNumber,
                bedCount: String(item.bedCount),
                costPerBed: String(item.costPerBed),
                description: item.description ?? '',
              })}
              onDelete={(item) => confirmDelete(`Delete room "${item.roomNumber}"?`, () => deleteDormitoryRoom(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'studentAssign' ? (
        <SimpleCrudLayout
          title={studentAssignForm.id ? 'Edit Student Dormitory' : 'Assign Student Dormitory'}
          listTitle="Student Dormitory Assignments"
          search={search}
          setSearch={setSearch}
          isLoading={studentAssignmentsQuery.isLoading}
          emptyMessage="No student dormitory assignments found."
          form={
            <>
              <Field label="Select class *">
                <select
                  className={inputClass}
                  value={studentAssignForm.classId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, classId: e.target.value, sectionId: '', studentId: '' }))}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select section *">
                <select
                  className={inputClass}
                  value={studentAssignForm.sectionId}
                  disabled={!studentAssignForm.classId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, sectionId: e.target.value, studentId: '' }))}
                >
                  <option value="">Select section</option>
                  {studentAssignSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select student *">
                <select
                  className={inputClass}
                  value={studentAssignForm.studentId}
                  disabled={!studentAssignForm.sectionId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, studentId: e.target.value }))}
                >
                  <option value="">{studentsQuery.isFetching ? 'Loading students...' : 'Select student'}</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} ({student.admissionNo})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Select dormitory *">
                <select
                  className={inputClass}
                  value={studentAssignForm.dormitoryId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, dormitoryId: e.target.value, roomId: '' }))}
                >
                  <option value="">Select dormitory</option>
                  {dormitories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select room">
                <select
                  className={inputClass}
                  value={studentAssignForm.roomId}
                  disabled={!studentAssignForm.dormitoryId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, roomId: e.target.value }))}
                >
                  <option value="">No specific room</option>
                  {studentAssignRooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.roomNumber} - {item.roomType?.name ?? 'Room'} - {money(item.costPerBed)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note">
                <textarea className={inputClass} rows={3} value={studentAssignForm.note} onChange={(e) => setStudentAssignForm((p) => ({ ...p, note: e.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={studentAssignMutation.isPending} onClick={validateStudentAssign}>Save Assignment</PrimaryButton>
                {studentAssignForm.id ? <SecondaryButton onClick={() => setStudentAssignForm(emptyStudentAssignForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <StudentAssignmentTable
              rows={studentAssignments}
              onEdit={editStudentAssignment}
              onDelete={(item) => confirmDelete(`Remove dormitory assignment for "${item.student.fullName}"?`, () => deleteStudentDormitoryAssignment(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'report' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <Field label="Select class">
                <select className={inputClass} value={reportFilters.classId} onChange={(e) => setReportFilters((p) => ({ ...p, classId: e.target.value }))}>
                  <option value="">Select class</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select section">
                <select className={inputClass} value={reportFilters.sectionId} disabled={!reportFilters.classId} onChange={(e) => setReportFilters((p) => ({ ...p, sectionId: e.target.value }))}>
                  <option value="">Select section</option>
                  {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Select dormitory">
                <select className={inputClass} value={reportFilters.dormitoryId} onChange={(e) => setReportFilters((p) => ({ ...p, dormitoryId: e.target.value }))}>
                  <option value="">Select dormitory</option>
                  {dormitories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <PrimaryButton onClick={searchReport} disabled={reportQuery.isFetching}>Search</PrimaryButton>
            </div>
          </section>

          <ListCard title="Student Dormitory Report">
            {reportQuery.isFetching ? <LoadingSkeleton /> : (
              <ReportTable rows={reportQuery.data ?? []} searched={Boolean(submittedReportFilters.classId)} />
            )}
          </ListCard>
        </div>
      ) : null}
    </div>
  );
}

function SimpleCrudLayout({
  title,
  listTitle,
  form,
  table,
  isLoading,
  emptyMessage,
  search,
  setSearch,
}: {
  title: string;
  listTitle: string;
  form: React.ReactNode;
  table: React.ReactNode;
  isLoading: boolean;
  emptyMessage: string;
  search?: string;
  setSearch?: (value: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <FormCard title={title}>{form}</FormCard>
      <ListCard title={listTitle} search={search} setSearch={setSearch}>
        {isLoading ? <LoadingSkeleton /> : table || <EmptyState message={emptyMessage} />}
      </ListCard>
    </div>
  );
}

function DormitoryTable({ items, onEdit, onDelete }: { items: Dormitory[]; onEdit: (item: Dormitory) => void; onDelete: (item: Dormitory) => void }) {
  if (!items.length) return <EmptyState message="No dormitories found." />;
  return (
    <DataTable headers={['Dormitory Name', 'Type', 'Address', 'Intake', 'Rooms', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.type}</Cell>
          <Cell>{item.address || '-'}</Cell>
          <Cell>{item.intake}</Cell>
          <Cell>{item._count?.rooms ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function RoomTypeTable({ items, onEdit, onDelete }: { items: DormitoryRoomType[]; onEdit: (item: DormitoryRoomType) => void; onDelete: (item: DormitoryRoomType) => void }) {
  if (!items.length) return <EmptyState message="No room types found." />;
  return (
    <DataTable headers={['Room Type', 'Description', 'Rooms', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.description || '-'}</Cell>
          <Cell>{item._count?.rooms ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function RoomTable({ items, onEdit, onDelete }: { items: DormitoryRoom[]; onEdit: (item: DormitoryRoom) => void; onDelete: (item: DormitoryRoom) => void }) {
  if (!items.length) return <EmptyState message="No dormitory rooms found." />;
  return (
    <DataTable headers={['Dormitory', 'Room Number', 'Room Type', 'No. of Bed', 'Cost Per Bed', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.dormitory?.name ?? '-'}</Cell>
          <Cell>{item.roomNumber}</Cell>
          <Cell>{item.roomType?.name ?? '-'}</Cell>
          <Cell>{item.bedCount}</Cell>
          <Cell>{money(item.costPerBed)}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function StudentAssignmentTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: StudentDormitoryAssignment[];
  onEdit: (item: StudentDormitoryAssignment) => void;
  onDelete: (item: StudentDormitoryAssignment) => void;
}) {
  if (!rows.length) return <EmptyState message="No student dormitory assignments found." />;
  return (
    <DataTable headers={['Class (Sec.)', 'Admission No.', 'Student', 'Dormitory', 'Room', 'Room Type', 'Cost Per Bed', 'Note', 'Actions']}>
      {rows.map((row) => (
        <tr key={row.id}>
          <Cell>{row.student.class?.name ?? '-'} {row.student.section?.name ? `(${row.student.section.name})` : ''}</Cell>
          <Cell>{row.student.admissionNo}</Cell>
          <Cell strong>{row.student.fullName}</Cell>
          <Cell>{row.dormitory.name}</Cell>
          <Cell>{row.room?.roomNumber ?? '-'}</Cell>
          <Cell>{row.room?.roomType?.name ?? '-'}</Cell>
          <Cell>{money(row.room?.costPerBed)}</Cell>
          <Cell>{row.note || '-'}</Cell>
          <ActionCell onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
        </tr>
      ))}
    </DataTable>
  );
}

function ReportTable({ rows, searched }: { rows: StudentDormitoryReportRow[]; searched: boolean }) {
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        `${a.student.class?.name ?? ''} ${a.student.section?.name ?? ''} ${a.student.fullName}`.localeCompare(
          `${b.student.class?.name ?? ''} ${b.student.section?.name ?? ''} ${b.student.fullName}`,
        ),
      ),
    [rows],
  );

  if (!searched) return <EmptyState message="Select class, section, and dormitory to search." />;
  if (!sortedRows.length) return <EmptyState message="No student dormitory records found for this criteria." />;

  return (
    <DataTable headers={['Class (Sec.)', 'Admission No.', 'Student Name', 'Mobile', "Guardian's Phone", 'Dormitory Name', 'Room Number', 'Room Type', 'Cost Per Bed']}>
      {sortedRows.map((row) => (
        <tr key={row.id}>
          <Cell>{row.student.class?.name ?? '-'} {row.student.section?.name ? `(${row.student.section.name})` : ''}</Cell>
          <Cell>{row.student.admissionNo}</Cell>
          <Cell strong>{row.student.fullName}</Cell>
          <Cell>{row.student.phone || '-'}</Cell>
          <Cell>{row.student.parentPhone || '-'}</Cell>
          <Cell>{row.dormitory.name}</Cell>
          <Cell>{row.room?.roomNumber ?? '-'}</Cell>
          <Cell>{row.room?.roomType?.name ?? '-'}</Cell>
          <Cell>{money(row.room?.costPerBed)}</Cell>
        </tr>
      ))}
    </DataTable>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className={`px-4 py-3 ${header === 'Actions' ? 'text-right' : ''}`}>{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`px-4 py-3 ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{children}</td>;
}

function ActionCell({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-4 py-3">
      <div className="flex justify-end gap-2">
        <SecondaryButton onClick={onEdit}>Edit</SecondaryButton>
        <DangerButton onClick={onDelete}>Delete</DangerButton>
      </div>
    </td>
  );
}
