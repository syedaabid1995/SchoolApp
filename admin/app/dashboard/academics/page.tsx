'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listAcademicYears, listTimetableTeachers } from '../../../services/academic.service';
import {
  createClassRoom,
  createClassRoutine,
  createSetupClass,
  createSetupSection,
  createSetupSubject,
  createTimePeriod,
  deleteAssignSubject,
  deleteClassRoom,
  deleteClassRoutine,
  deleteClassTeacher,
  deleteSetupClass,
  deleteSetupSection,
  deleteSetupSubject,
  deleteTimePeriod,
  listAssignSubjects,
  listClassRooms,
  listClassRoutines,
  listClassTeachers,
  listSetupClasses,
  listSetupSections,
  listSetupSubjects,
  listTimePeriods,
  saveAssignSubjects,
  saveClassTeacher,
  updateClassRoom,
  updateClassRoutine,
  updateClassTeacher,
  updateSetupClass,
  updateSetupSection,
  updateSetupSubject,
  updateTimePeriod,
  type AcademicClass,
  type AcademicSection,
  type AcademicSubject,
  type AssignSubject,
  type ClassRoom,
  type ClassRoutine,
  type ClassTeacher,
  type SubjectType,
  type TimePeriod,
  type TimePeriodType,
} from '../../../services/academic-setup.service';

type TabId =
  | 'classes'
  | 'sections'
  | 'subjects'
  | 'rooms'
  | 'times'
  | 'assign-subjects'
  | 'class-teachers'
  | 'routine';

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: 'classes', label: 'Classes', description: 'Class names and linked sections' },
  { id: 'sections', label: 'Sections', description: 'Reusable class sections' },
  { id: 'subjects', label: 'Subjects', description: 'Theory and practical subjects' },
  { id: 'rooms', label: 'Class Rooms', description: 'Room numbers and capacity' },
  { id: 'times', label: 'Time / Period', description: 'Class, exam, and break periods' },
  { id: 'assign-subjects', label: 'Assign Subject', description: 'Subjects and teachers by class-section' },
  { id: 'class-teachers', label: 'Class Teacher', description: 'Class-section teacher ownership' },
  { id: 'routine', label: 'Class Routine', description: 'Weekly period routine grid' },
];

const dayOptions = [
  { value: 1, label: 'Saturday' },
  { value: 2, label: 'Sunday' },
  { value: 3, label: 'Monday' },
  { value: 4, label: 'Tuesday' },
  { value: 5, label: 'Wednesday' },
  { value: 6, label: 'Thursday' },
  { value: 7, label: 'Friday' },
];

const emptyClassForm = { id: '', name: '', academicYearId: '', sectionIds: [] as string[] };
const emptySectionForm = { id: '', name: '' };
const emptySubjectForm = { id: '', name: '', code: '', type: 'THEORY' as SubjectType };
const emptyRoomForm = { id: '', roomNumber: '', capacity: '40' };
const emptyTimeForm = { id: '', type: 'CLASS_TIME' as TimePeriodType, name: '', startTime: '', endTime: '' };
const emptyClassTeacherForm = { id: '', classId: '', sectionId: '', teacherId: '' };
const emptyRoutineForm = {
  id: '',
  classId: '',
  sectionId: '',
  dayOfWeek: 1,
  timePeriodId: '',
  subjectId: '',
  teacherId: '',
  classRoomId: '',
};

const getErrorMessage = (error: unknown, fallback = 'Something went wrong') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

const teacherName = (teacher?: { firstName?: string; lastName?: string; employeeNo?: string | null } | null) =>
  teacher ? `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim() || teacher.employeeNo || 'Teacher' : 'Unassigned';

const formatPeriodType = (type: TimePeriodType | string) =>
  type === 'CLASS_TIME' ? 'Class Time' : type === 'EXAM_TIME' ? 'Exam Time' : 'Break';

const sectionOptionsForClass = (classes: AcademicClass[] | undefined, classId: string) =>
  classes?.find((item) => item.id === classId)?.classSections?.map((link) => link.section).filter(Boolean) ?? [];

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((item) => (
      <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />
    ))}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => (
  <button
    type={type}
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

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100';

const FormCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-950">{title}</h2>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const ListCard = ({ title, children, search, setSearch }: { title: string; children: React.ReactNode; search?: string; setSearch?: (value: string) => void }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {setSearch ? (
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="Quick search..."
          value={search ?? ''}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

export default function AcademicSetupPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TabId>('classes');
  const [search, setSearch] = useState('');

  const [classForm, setClassForm] = useState(emptyClassForm);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [timeForm, setTimeForm] = useState(emptyTimeForm);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSectionId, setAssignSectionId] = useState('');
  const [assignRows, setAssignRows] = useState<Array<{ subjectId: string; teacherId: string }>>([]);
  const [classTeacherForm, setClassTeacherForm] = useState(emptyClassTeacherForm);
  const [routineClassId, setRoutineClassId] = useState('');
  const [routineSectionId, setRoutineSectionId] = useState('');
  const [routineForm, setRoutineForm] = useState(emptyRoutineForm);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';

  const classesQuery = useQuery({ queryKey: ['academic-setup-classes', search], queryFn: () => listSetupClasses({ search }), enabled: isSchoolAdmin });
  const sectionsQuery = useQuery({ queryKey: ['academic-setup-sections', search], queryFn: () => listSetupSections({ search }), enabled: isSchoolAdmin });
  const subjectsQuery = useQuery({ queryKey: ['academic-setup-subjects', search], queryFn: () => listSetupSubjects({ search }), enabled: isSchoolAdmin });
  const roomsQuery = useQuery({ queryKey: ['academic-setup-rooms', search], queryFn: () => listClassRooms({ search }), enabled: isSchoolAdmin });
  const periodsQuery = useQuery({ queryKey: ['academic-setup-time-periods'], queryFn: listTimePeriods, enabled: isSchoolAdmin });
  const teachersQuery = useQuery({ queryKey: ['academic-setup-teachers'], queryFn: () => listTimetableTeachers(), enabled: isSchoolAdmin });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: isSchoolAdmin });
  const assignedQuery = useQuery({
    queryKey: ['academic-setup-assign-subjects', assignClassId, assignSectionId],
    queryFn: () => listAssignSubjects({ classId: assignClassId, sectionId: assignSectionId }),
    enabled: isSchoolAdmin && Boolean(assignClassId && assignSectionId),
  });
  const classTeachersQuery = useQuery({ queryKey: ['academic-setup-class-teachers'], queryFn: listClassTeachers, enabled: isSchoolAdmin });
  const routinesQuery = useQuery({
    queryKey: ['academic-setup-routines', routineClassId, routineSectionId],
    queryFn: () => listClassRoutines({ classId: routineClassId, sectionId: routineSectionId }),
    enabled: isSchoolAdmin && Boolean(routineClassId && routineSectionId),
  });
  const routineAssignmentsQuery = useQuery({
    queryKey: ['academic-setup-routine-assign-subjects', routineClassId, routineSectionId],
    queryFn: () => listAssignSubjects({ classId: routineClassId, sectionId: routineSectionId }),
    enabled: isSchoolAdmin && Boolean(routineClassId && routineSectionId),
  });

  const invalidateSetup = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['academic-setup-classes'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-sections'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-subjects'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-rooms'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-time-periods'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-assign-subjects'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-class-teachers'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-routines'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-routine-assign-subjects'] }),
    ]);
  };

  const onSuccess = async (title: string, message?: string) => {
    notify.success(title, message);
    await invalidateSetup();
  };
  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const classMutation = useMutation({
    mutationFn: () =>
      classForm.id
        ? updateSetupClass(classForm.id, {
            name: classForm.name,
            academicYearId: classForm.academicYearId || null,
            sectionIds: classForm.sectionIds,
          })
        : createSetupClass({
            name: classForm.name,
            academicYearId: classForm.academicYearId || null,
            sectionIds: classForm.sectionIds,
          }),
    onSuccess: () => {
      setClassForm(emptyClassForm);
      onSuccess('Class saved');
    },
    onError,
  });

  const sectionMutation = useMutation({
    mutationFn: () => (sectionForm.id ? updateSetupSection(sectionForm.id, { name: sectionForm.name }) : createSetupSection({ name: sectionForm.name })),
    onSuccess: () => {
      setSectionForm(emptySectionForm);
      onSuccess('Section saved');
    },
    onError,
  });

  const subjectMutation = useMutation({
    mutationFn: () =>
      subjectForm.id
        ? updateSetupSubject(subjectForm.id, { name: subjectForm.name, code: subjectForm.code || null, type: subjectForm.type })
        : createSetupSubject({ name: subjectForm.name, code: subjectForm.code || null, type: subjectForm.type }),
    onSuccess: () => {
      setSubjectForm(emptySubjectForm);
      onSuccess('Subject saved');
    },
    onError,
  });

  const roomMutation = useMutation({
    mutationFn: () =>
      roomForm.id
        ? updateClassRoom(roomForm.id, { roomNumber: roomForm.roomNumber, capacity: Number(roomForm.capacity) })
        : createClassRoom({ roomNumber: roomForm.roomNumber, capacity: Number(roomForm.capacity) }),
    onSuccess: () => {
      setRoomForm(emptyRoomForm);
      onSuccess('Room saved');
    },
    onError,
  });

  const timeMutation = useMutation({
    mutationFn: () =>
      timeForm.id
        ? updateTimePeriod(timeForm.id, { type: timeForm.type, name: timeForm.name, startTime: timeForm.startTime, endTime: timeForm.endTime })
        : createTimePeriod({ type: timeForm.type, name: timeForm.name, startTime: timeForm.startTime, endTime: timeForm.endTime }),
    onSuccess: () => {
      setTimeForm(emptyTimeForm);
      onSuccess('Time period saved');
    },
    onError,
  });

  const assignMutation = useMutation({
    mutationFn: () => saveAssignSubjects({ classId: assignClassId, sectionId: assignSectionId, replace: true, assignments: assignRows }),
    onSuccess: () => onSuccess('Subject assignments saved'),
    onError,
  });

  const classTeacherMutation = useMutation({
    mutationFn: () =>
      classTeacherForm.id
        ? updateClassTeacher(classTeacherForm.id, {
            classId: classTeacherForm.classId,
            sectionId: classTeacherForm.sectionId,
            teacherId: classTeacherForm.teacherId,
          })
        : saveClassTeacher({
            classId: classTeacherForm.classId,
            sectionId: classTeacherForm.sectionId,
            teacherId: classTeacherForm.teacherId,
          }),
    onSuccess: () => {
      setClassTeacherForm(emptyClassTeacherForm);
      onSuccess('Class teacher saved');
    },
    onError,
  });

  const routineMutation = useMutation({
    mutationFn: () =>
      routineForm.id
        ? updateClassRoutine(routineForm.id, {
            classId: routineForm.classId,
            sectionId: routineForm.sectionId,
            timePeriodId: routineForm.timePeriodId,
            dayOfWeek: routineForm.dayOfWeek,
            subjectId: routineForm.subjectId,
            teacherId: routineForm.teacherId,
            classRoomId: routineForm.classRoomId || null,
          })
        : createClassRoutine({
            classId: routineForm.classId,
            sectionId: routineForm.sectionId,
            timePeriodId: routineForm.timePeriodId,
            dayOfWeek: routineForm.dayOfWeek,
            subjectId: routineForm.subjectId,
            teacherId: routineForm.teacherId,
            classRoomId: routineForm.classRoomId || null,
          }),
    onSuccess: () => {
      setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId });
      onSuccess('Routine saved');
    },
    onError,
  });

  useEffect(() => {
    const existing = assignedQuery.data ?? [];
    setAssignRows(existing.map((item) => ({ subjectId: item.subjectId, teacherId: item.teacherId })));
  }, [assignedQuery.data, assignClassId, assignSectionId]);

  useEffect(() => {
    setAssignSectionId('');
  }, [assignClassId]);

  useEffect(() => {
    setRoutineSectionId('');
  }, [routineClassId]);

  const assignedSections = useMemo(() => sectionOptionsForClass(classesQuery.data, assignClassId), [classesQuery.data, assignClassId]);
  const routineSections = useMemo(() => sectionOptionsForClass(classesQuery.data, routineClassId), [classesQuery.data, routineClassId]);
  const classTeacherSections = useMemo(() => sectionOptionsForClass(classesQuery.data, classTeacherForm.classId), [classesQuery.data, classTeacherForm.classId]);
  const classFormSectionIds = new Set(classForm.sectionIds);
  const teachers = teachersQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const periods = periodsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const routines = routinesQuery.data ?? [];
  const routineByCell = useMemo(() => {
    const map = new Map<string, ClassRoutine>();
    routines.forEach((item) => map.set(`${item.dayOfWeek}:${item.timePeriodId}`, item));
    return map;
  }, [routines]);
  const routineAssignedSubjects = routineAssignmentsQuery.data ?? [];

  const validateClass = () => {
    if (!classForm.name.trim()) return notify.error('Validation error', 'Class name is required.');
    classMutation.mutate();
  };
  const validateSection = () => {
    if (!sectionForm.name.trim()) return notify.error('Validation error', 'Section name is required.');
    sectionMutation.mutate();
  };
  const validateSubject = () => {
    if (!subjectForm.name.trim()) return notify.error('Validation error', 'Subject name is required.');
    if (!subjectForm.code.trim()) return notify.error('Validation error', 'Subject code is required.');
    subjectMutation.mutate();
  };
  const validateRoom = () => {
    if (!roomForm.roomNumber.trim()) return notify.error('Validation error', 'Room number is required.');
    if (!Number(roomForm.capacity) || Number(roomForm.capacity) < 1) return notify.error('Validation error', 'Capacity must be greater than 0.');
    roomMutation.mutate();
  };
  const validateTime = () => {
    if (!timeForm.name.trim()) return notify.error('Validation error', 'Period name is required.');
    if (!timeForm.startTime || !timeForm.endTime) return notify.error('Validation error', 'Start and end time are required.');
    if (timeForm.endTime <= timeForm.startTime) return notify.error('Validation error', 'End time must be after start time.');
    timeMutation.mutate();
  };
  const validateAssign = () => {
    if (!assignClassId || !assignSectionId) return notify.error('Validation error', 'Select class and section first.');
    if (!assignRows.length) return notify.error('Validation error', 'Add at least one subject row.');
    if (assignRows.some((row) => !row.subjectId || !row.teacherId)) return notify.error('Validation error', 'Select subject and teacher for each row.');
    assignMutation.mutate();
  };
  const validateClassTeacher = () => {
    if (!classTeacherForm.classId || !classTeacherForm.sectionId || !classTeacherForm.teacherId) {
      return notify.error('Validation error', 'Select class, section, and teacher.');
    }
    classTeacherMutation.mutate();
  };
  const validateRoutine = () => {
    if (!routineForm.classId || !routineForm.sectionId || !routineForm.timePeriodId || !routineForm.subjectId || !routineForm.teacherId) {
      return notify.error('Validation error', 'Select class, section, period, subject, and teacher.');
    }
    routineMutation.mutate();
  };

  const confirmDelete = (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    action()
      .then(() => onSuccess('Deleted successfully'))
      .catch(onError);
  };

  if (sessionLoading) {
    return <LoadingSkeleton />;
  }

  if (!isSchoolAdmin) {
    return (
      <div>
        <PageHeader title="Academic Setup" subtitle="This setup area is available only for School Admin accounts." />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
          Academic setup is a School Admin workspace. Super Admin and lower roles cannot manage this data here.
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academic Setup"
        subtitle="Configure classes, sections, subjects, rooms, periods, assignments, and weekly class routines."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Academics' },
          { label: tabs.find((tab) => tab.id === activeTab)?.label ?? 'Setup' },
        ]}
      />

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setSearch('');
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeTab === tab.id
                ? 'border-purple-300 bg-purple-50 text-purple-900'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-purple-200 hover:bg-white'
            }`}
          >
            <div className="font-bold">{tab.label}</div>
            <div className="mt-1 text-xs text-slate-500">{tab.description}</div>
          </button>
        ))}
      </section>

      {activeTab === 'classes' ? (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <FormCard title={classForm.id ? 'Edit Class' : 'Add Class'}>
            <Field label="Class name">
              <input className={inputClass} value={classForm.name} onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: Grade 10" />
            </Field>
            <Field label="Academic year">
              <select className={inputClass} value={classForm.academicYearId} onChange={(e) => setClassForm((p) => ({ ...p, academicYearId: e.target.value }))}>
                <option value="">No academic year</option>
                {(yearsQuery.data ?? []).map((year: { id: string; name: string }) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
            </Field>
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Sections</span>
              <div className="grid grid-cols-2 gap-2">
                {(sectionsQuery.data ?? []).map((section) => (
                  <label key={section.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={classFormSectionIds.has(section.id)}
                      onChange={(event) =>
                        setClassForm((prev) => ({
                          ...prev,
                          sectionIds: event.target.checked
                            ? [...prev.sectionIds, section.id]
                            : prev.sectionIds.filter((id) => id !== section.id),
                        }))
                      }
                    />
                    {section.name}
                  </label>
                ))}
              </div>
              {!sectionsQuery.data?.length ? <p className="mt-2 text-xs text-slate-500">Create sections first, then link them to classes.</p> : null}
            </div>
            <div className="flex gap-2">
              <PrimaryButton disabled={classMutation.isPending} onClick={validateClass}>{classForm.id ? 'Update Class' : 'Add Class'}</PrimaryButton>
              {classForm.id ? <SecondaryButton onClick={() => setClassForm(emptyClassForm)}>Cancel</SecondaryButton> : null}
            </div>
          </FormCard>

          <ListCard title="Class List" search={search} setSearch={setSearch}>
            {classesQuery.isLoading ? <LoadingSkeleton /> : !classesQuery.data?.length ? <EmptyState message="No classes found." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Class</th><th className="px-4 py-3">Sections</th><th className="px-4 py-3">Students</th><th className="px-4 py-3 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classesQuery.data.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-600">{item.classSections?.map((link) => link.section.name).join(', ') || 'No sections'}</td>
                        <td className="px-4 py-3 text-slate-600">{item._count?.students ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <SecondaryButton onClick={() => setClassForm({ id: item.id, name: item.name, academicYearId: item.academicYearId ?? '', sectionIds: item.classSections?.map((link) => link.sectionId) ?? [] })}>Edit</SecondaryButton>
                            <DangerButton onClick={() => confirmDelete(`Delete class "${item.name}"?`, () => deleteSetupClass(item.id))}>Delete</DangerButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ListCard>
        </div>
      ) : null}

      {activeTab === 'sections' ? (
        <SimpleCrudLayout
          title={sectionForm.id ? 'Edit Section' : 'Add Section'}
          listTitle="Section List"
          isLoading={sectionsQuery.isLoading}
          emptyMessage="No sections found."
          search={search}
          setSearch={setSearch}
          form={
            <>
              <Field label="Section name">
                <input className={inputClass} value={sectionForm.name} onChange={(e) => setSectionForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: A" />
              </Field>
              <div className="flex gap-2">
                <PrimaryButton disabled={sectionMutation.isPending} onClick={validateSection}>{sectionForm.id ? 'Update Section' : 'Add Section'}</PrimaryButton>
                {sectionForm.id ? <SecondaryButton onClick={() => setSectionForm(emptySectionForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={<SectionTable items={sectionsQuery.data ?? []} onEdit={(item) => setSectionForm({ id: item.id, name: item.name })} onDelete={(item) => confirmDelete(`Delete section "${item.name}"?`, () => deleteSetupSection(item.id))} />}
        />
      ) : null}

      {activeTab === 'subjects' ? (
        <SimpleCrudLayout
          title={subjectForm.id ? 'Edit Subject' : 'Add Subject'}
          listTitle="Subject List"
          isLoading={subjectsQuery.isLoading}
          emptyMessage="No subjects found."
          search={search}
          setSearch={setSearch}
          form={
            <>
              <Field label="Subject name"><input className={inputClass} value={subjectForm.name} onChange={(e) => setSubjectForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: Mathematics" /></Field>
              <Field label="Subject code"><input className={inputClass} value={subjectForm.code} onChange={(e) => setSubjectForm((p) => ({ ...p, code: e.target.value }))} placeholder="Example: MATH10" /></Field>
              <Field label="Subject type">
                <select className={inputClass} value={subjectForm.type} onChange={(e) => setSubjectForm((p) => ({ ...p, type: e.target.value as SubjectType }))}>
                  <option value="THEORY">Theory</option>
                  <option value="PRACTICAL">Practical</option>
                </select>
              </Field>
              <div className="flex gap-2">
                <PrimaryButton disabled={subjectMutation.isPending} onClick={validateSubject}>{subjectForm.id ? 'Update Subject' : 'Add Subject'}</PrimaryButton>
                {subjectForm.id ? <SecondaryButton onClick={() => setSubjectForm(emptySubjectForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={<SubjectTable items={subjectsQuery.data ?? []} onEdit={(item) => setSubjectForm({ id: item.id, name: item.name, code: item.code ?? '', type: item.type })} onDelete={(item) => confirmDelete(`Delete subject "${item.name}"?`, () => deleteSetupSubject(item.id))} />}
        />
      ) : null}

      {activeTab === 'rooms' ? (
        <SimpleCrudLayout
          title={roomForm.id ? 'Edit Class Room' : 'Add Class Room'}
          listTitle="Room List"
          isLoading={roomsQuery.isLoading}
          emptyMessage="No rooms found."
          search={search}
          setSearch={setSearch}
          form={
            <>
              <Field label="Room number"><input className={inputClass} value={roomForm.roomNumber} onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))} placeholder="Example: 201" /></Field>
              <Field label="Capacity"><input className={inputClass} type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: e.target.value }))} /></Field>
              <div className="flex gap-2">
                <PrimaryButton disabled={roomMutation.isPending} onClick={validateRoom}>{roomForm.id ? 'Update Room' : 'Add Room'}</PrimaryButton>
                {roomForm.id ? <SecondaryButton onClick={() => setRoomForm(emptyRoomForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={<RoomTable items={roomsQuery.data ?? []} onEdit={(item) => setRoomForm({ id: item.id, roomNumber: item.roomNumber, capacity: String(item.capacity) })} onDelete={(item) => confirmDelete(`Delete room "${item.roomNumber}"?`, () => deleteClassRoom(item.id))} />}
        />
      ) : null}

      {activeTab === 'times' ? (
        <SimpleCrudLayout
          title={timeForm.id ? 'Edit Time / Period' : 'Add Time / Period'}
          listTitle="Time List"
          isLoading={periodsQuery.isLoading}
          emptyMessage="No time periods found."
          form={
            <>
              <Field label="Time type">
                <select className={inputClass} value={timeForm.type} onChange={(e) => setTimeForm((p) => ({ ...p, type: e.target.value as TimePeriodType }))}>
                  <option value="CLASS_TIME">Class Time</option>
                  <option value="EXAM_TIME">Exam Time</option>
                  <option value="BREAK">Break</option>
                </select>
              </Field>
              <Field label="Period name"><input className={inputClass} value={timeForm.name} onChange={(e) => setTimeForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: 1st Period" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start time"><input className={inputClass} type="time" value={timeForm.startTime} onChange={(e) => setTimeForm((p) => ({ ...p, startTime: e.target.value }))} /></Field>
                <Field label="End time"><input className={inputClass} type="time" value={timeForm.endTime} onChange={(e) => setTimeForm((p) => ({ ...p, endTime: e.target.value }))} /></Field>
              </div>
              <div className="flex gap-2">
                <PrimaryButton disabled={timeMutation.isPending} onClick={validateTime}>{timeForm.id ? 'Update Time' : 'Add Time'}</PrimaryButton>
                {timeForm.id ? <SecondaryButton onClick={() => setTimeForm(emptyTimeForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={<TimeTable items={periodsQuery.data ?? []} onEdit={(item) => setTimeForm({ id: item.id, type: item.type, name: item.name, startTime: item.startTime, endTime: item.endTime })} onDelete={(item) => confirmDelete(`Delete time period "${item.name}"?`, () => deleteTimePeriod(item.id))} />}
        />
      ) : null}

      {activeTab === 'assign-subjects' ? (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <FormCard title="Assign Multiple Subjects">
            <ClassSectionPicker
              classes={classesQuery.data ?? []}
              classId={assignClassId}
              sectionId={assignSectionId}
              onClassChange={setAssignClassId}
              onSectionChange={setAssignSectionId}
              sectionOptions={assignedSections}
            />
            <div className="space-y-3">
              {assignRows.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                  <select className={inputClass} value={row.subjectId} onChange={(e) => setAssignRows((rows) => rows.map((item, idx) => idx === index ? { ...item, subjectId: e.target.value } : item))}>
                    <option value="">Select subject</option>
                    {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}
                  </select>
                  <select className={inputClass} value={row.teacherId} onChange={(e) => setAssignRows((rows) => rows.map((item, idx) => idx === index ? { ...item, teacherId: e.target.value } : item))}>
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
                  </select>
                  <DangerButton onClick={() => setAssignRows((rows) => rows.filter((_, idx) => idx !== index))}>Remove Row</DangerButton>
                </div>
              ))}
              <SecondaryButton onClick={() => setAssignRows((rows) => [...rows, { subjectId: '', teacherId: '' }])}>+ Add Subject</SecondaryButton>
            </div>
            <PrimaryButton disabled={assignMutation.isPending} onClick={validateAssign}>Save Assignment</PrimaryButton>
          </FormCard>
          <ListCard title="Assigned Subject List">
            {!assignClassId || !assignSectionId ? <EmptyState message="Select class and section to view assigned subjects." /> : assignedQuery.isLoading ? <LoadingSkeleton /> : !(assignedQuery.data ?? []).length ? <EmptyState message="No assigned subjects found." /> : (
              <AssignSubjectTable items={assignedQuery.data ?? []} onDelete={(item) => confirmDelete(`Delete assigned subject "${item.subject?.name}"?`, () => deleteAssignSubject(item.id))} />
            )}
          </ListCard>
        </div>
      ) : null}

      {activeTab === 'class-teachers' ? (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <FormCard title={classTeacherForm.id ? 'Edit Class Teacher' : 'Assign Class Teacher'}>
            <ClassSectionPicker
              classes={classesQuery.data ?? []}
              classId={classTeacherForm.classId}
              sectionId={classTeacherForm.sectionId}
              onClassChange={(value) => setClassTeacherForm((p) => ({ ...p, classId: value, sectionId: '' }))}
              onSectionChange={(value) => setClassTeacherForm((p) => ({ ...p, sectionId: value }))}
              sectionOptions={classTeacherSections}
            />
            <Field label="Teacher">
              <select className={inputClass} value={classTeacherForm.teacherId} onChange={(e) => setClassTeacherForm((p) => ({ ...p, teacherId: e.target.value }))}>
                <option value="">Select teacher</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
              </select>
            </Field>
            <div className="flex gap-2">
              <PrimaryButton disabled={classTeacherMutation.isPending} onClick={validateClassTeacher}>Save Class Teacher</PrimaryButton>
              {classTeacherForm.id ? <SecondaryButton onClick={() => setClassTeacherForm(emptyClassTeacherForm)}>Cancel</SecondaryButton> : null}
            </div>
          </FormCard>
          <ListCard title="Class Teacher List">
            {classTeachersQuery.isLoading ? <LoadingSkeleton /> : !(classTeachersQuery.data ?? []).length ? <EmptyState message="No class teacher assignments found." /> : (
              <ClassTeacherTable
                items={classTeachersQuery.data ?? []}
                onEdit={(item) => setClassTeacherForm({ id: item.id, classId: item.classId, sectionId: item.sectionId, teacherId: item.teacherId })}
                onDelete={(item) => confirmDelete(`Delete class teacher assignment for ${item.class?.name}-${item.section?.name}?`, () => deleteClassTeacher(item.id))}
              />
            )}
          </ListCard>
        </div>
      ) : null}

      {activeTab === 'routine' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <ClassSectionPicker
                classes={classesQuery.data ?? []}
                classId={routineClassId}
                sectionId={routineSectionId}
                onClassChange={setRoutineClassId}
                onSectionChange={setRoutineSectionId}
                sectionOptions={routineSections}
              />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Weekly Routine</h2>
              {!routineClassId || !routineSectionId ? <EmptyState message="Select class and section to build routine." /> : periodsQuery.isLoading || routinesQuery.isLoading ? <LoadingSkeleton /> : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 rounded-tl-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs uppercase text-slate-500">Period</th>
                        {dayOptions.map((day) => <th key={day.value} className="border-y border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs uppercase text-slate-500">{day.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.id}>
                          <td className="sticky left-0 z-10 border-x border-b border-slate-200 bg-white px-3 py-3 font-semibold text-slate-800">
                            <div>{period.name}</div>
                            <div className="text-xs font-normal text-slate-500">{period.startTime}-{period.endTime}</div>
                          </td>
                          {dayOptions.map((day) => {
                            const cell = routineByCell.get(`${day.value}:${period.id}`);
                            const isWeekend = day.value === 7;
                            const isBreak = period.type === 'BREAK';
                            return (
                              <td key={`${day.value}-${period.id}`} className="h-24 border-b border-r border-slate-200 px-3 py-2 align-top">
                                {isWeekend ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Weekend</span>
                                ) : isBreak ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Break</span>
                                ) : cell ? (
                                  <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50 p-2">
                                    <div className="font-semibold text-purple-950">{cell.subject?.name}</div>
                                    <div className="text-xs text-purple-700">{teacherName(cell.teacher)}</div>
                                    <div className="text-xs text-purple-700">{cell.classRoom?.roomNumber ? `Room ${cell.classRoom.roomNumber}` : 'No room'}</div>
                                    <div className="flex gap-1">
                                      <button className="text-xs font-semibold text-purple-700" onClick={() => setRoutineForm({ id: cell.id, classId: cell.classId, sectionId: cell.sectionId, dayOfWeek: cell.dayOfWeek, timePeriodId: cell.timePeriodId, subjectId: cell.subjectId, teacherId: cell.teacherId, classRoomId: cell.classRoomId ?? '' })}>Edit</button>
                                      <button className="text-xs font-semibold text-red-600" onClick={() => confirmDelete('Delete this routine cell?', () => deleteClassRoutine(cell.id))}>Delete</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="flex h-full min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-xl font-bold text-purple-600 hover:border-purple-300 hover:bg-purple-50"
                                    onClick={() => setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId, dayOfWeek: day.value, timePeriodId: period.id })}
                                  >
                                    +
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <FormCard title={routineForm.id ? 'Edit Routine Cell' : 'Create Routine Cell'}>
              <Field label="Day"><input className={inputClass} value={dayOptions.find((day) => day.value === routineForm.dayOfWeek)?.label ?? ''} readOnly /></Field>
              <Field label="Period">
                <select className={inputClass} value={routineForm.timePeriodId} onChange={(e) => setRoutineForm((p) => ({ ...p, timePeriodId: e.target.value }))}>
                  <option value="">Select period</option>
                  {periods.filter((period) => period.type !== 'BREAK').map((period) => <option key={period.id} value={period.id}>{period.name} ({period.startTime}-{period.endTime})</option>)}
                </select>
              </Field>
              <Field label="Subject">
                <select className={inputClass} value={routineForm.subjectId} onChange={(e) => {
                  const subjectId = e.target.value;
                  const assigned = routineAssignedSubjects.find((item) => item.subjectId === subjectId);
                  setRoutineForm((p) => ({ ...p, subjectId, teacherId: assigned?.teacherId ?? p.teacherId }));
                }}>
                  <option value="">Select subject</option>
                  {routineAssignedSubjects.map((item) => <option key={item.id} value={item.subjectId}>{item.subject?.name}</option>)}
                </select>
              </Field>
              <Field label="Teacher">
                <select className={inputClass} value={routineForm.teacherId} onChange={(e) => setRoutineForm((p) => ({ ...p, teacherId: e.target.value }))}>
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
                </select>
              </Field>
              <Field label="Class room">
                <select className={inputClass} value={routineForm.classRoomId} onChange={(e) => setRoutineForm((p) => ({ ...p, classRoomId: e.target.value }))}>
                  <option value="">No room</option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} ({room.capacity})</option>)}
                </select>
              </Field>
              <div className="flex gap-2">
                <PrimaryButton disabled={routineMutation.isPending || !routineClassId || !routineSectionId} onClick={validateRoutine}>Save Routine</PrimaryButton>
                {routineForm.id ? <SecondaryButton onClick={() => setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId })}>Cancel</SecondaryButton> : null}
              </div>
              {!routineAssignedSubjects.length ? <p className="text-xs text-amber-700">Assign subjects to this class-section before creating routine cells.</p> : null}
            </FormCard>
          </div>
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

function ClassSectionPicker({
  classes,
  classId,
  sectionId,
  sectionOptions,
  onClassChange,
  onSectionChange,
}: {
  classes: AcademicClass[];
  classId: string;
  sectionId: string;
  sectionOptions: Array<{ id: string; name: string }>;
  onClassChange: (value: string) => void;
  onSectionChange: (value: string) => void;
}) {
  return (
    <>
      <Field label="Class">
        <select className={inputClass} value={classId} onChange={(e) => onClassChange(e.target.value)}>
          <option value="">Select class</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Section">
        <select className={inputClass} value={sectionId} disabled={!classId} onChange={(e) => onSectionChange(e.target.value)}>
          <option value="">Select section</option>
          {sectionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
    </>
  );
}

function SectionTable({ items, onEdit, onDelete }: { items: AcademicSection[]; onEdit: (item: AcademicSection) => void; onDelete: (item: AcademicSection) => void }) {
  if (!items.length) return <EmptyState message="No sections found." />;
  return (
    <DataTable headers={['Section', 'Linked Classes', 'Students', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.classSections?.map((link) => link.class?.name).filter(Boolean).join(', ') || 'Not linked'}</Cell>
          <Cell>{item._count?.students ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function SubjectTable({ items, onEdit, onDelete }: { items: AcademicSubject[]; onEdit: (item: AcademicSubject) => void; onDelete: (item: AcademicSubject) => void }) {
  if (!items.length) return <EmptyState message="No subjects found." />;
  return (
    <DataTable headers={['Subject', 'Code', 'Type', 'Assignments', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.code ?? '-'}</Cell>
          <Cell>{item.type === 'PRACTICAL' ? 'Practical' : 'Theory'}</Cell>
          <Cell>{item._count?.assignSubjects ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function RoomTable({ items, onEdit, onDelete }: { items: ClassRoom[]; onEdit: (item: ClassRoom) => void; onDelete: (item: ClassRoom) => void }) {
  if (!items.length) return <EmptyState message="No rooms found." />;
  return (
    <DataTable headers={['Room', 'Capacity', 'Routine Cells', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.roomNumber}</Cell>
          <Cell>{item.capacity}</Cell>
          <Cell>{item._count?.classRoutines ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function TimeTable({ items, onEdit, onDelete }: { items: TimePeriod[]; onEdit: (item: TimePeriod) => void; onDelete: (item: TimePeriod) => void }) {
  if (!items.length) return <EmptyState message="No time periods found." />;
  return (
    <DataTable headers={['Type', 'Name', 'Start', 'End', 'Routine Cells', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell>{formatPeriodType(item.type)}</Cell>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.startTime}</Cell>
          <Cell>{item.endTime}</Cell>
          <Cell>{item._count?.classRoutines ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function AssignSubjectTable({ items, onDelete }: { items: AssignSubject[]; onDelete: (item: AssignSubject) => void }) {
  return (
    <DataTable headers={['Subject', 'Code', 'Teacher', 'Type', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.subject?.name}</Cell>
          <Cell>{item.subject?.code ?? '-'}</Cell>
          <Cell>{teacherName(item.teacher)}</Cell>
          <Cell>{item.subject?.type === 'PRACTICAL' ? 'Practical' : 'Theory'}</Cell>
          <td className="px-4 py-3 text-right"><DangerButton onClick={() => onDelete(item)}>Delete</DangerButton></td>
        </tr>
      ))}
    </DataTable>
  );
}

function ClassTeacherTable({ items, onEdit, onDelete }: { items: ClassTeacher[]; onEdit: (item: ClassTeacher) => void; onDelete: (item: ClassTeacher) => void }) {
  return (
    <DataTable headers={['Class', 'Section', 'Teacher', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.class?.name}</Cell>
          <Cell>{item.section?.name}</Cell>
          <Cell>{teacherName(item.teacher)}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-sm">
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
