'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listTimetableTeachers } from '../../../../services/academic.service';
import {
  createClassRoom,
  createClassRoutine,
  createTimePeriod,
  deleteClassRoom,
  deleteClassRoutine,
  deleteTimePeriod,
  generateClassRoutine,
  listAssignSubjects,
  listClassRooms,
  listClassRoutines,
  listSetupClasses,
  listTimePeriods,
  seedDefaultTimePeriods,
  updateClassRoom,
  updateClassRoutine,
  updateTimePeriod,
  type AcademicClass,
  type ClassRoutine,
  type TeacherOption,
  type TimePeriod,
  type TimePeriodType,
} from '../../../../services/academic-setup.service';
import {
  getSchoolSystemSettings,
  updateSchoolSystemSettings,
  type WeekendSetting,
} from '../../../../services/system-settings.service';

type TimetableTab = 'weekend' | 'rooms' | 'periods' | 'create' | 'generate-class' | 'generate-teacher';
type IconName = 'calendar' | 'building' | 'clock' | 'grid' | 'sparkles' | 'teacher' | 'plus' | 'save' | 'edit' | 'trash' | 'x';

const tabs: Array<{ id: TimetableTab; label: string; icon: IconName }> = [
  { id: 'weekend', label: 'Weekend', icon: 'calendar' },
  { id: 'rooms', label: 'Class Room', icon: 'building' },
  { id: 'periods', label: 'Time / Period', icon: 'clock' },
  { id: 'create', label: 'Create Timetable', icon: 'grid' },
  { id: 'generate-class', label: 'Generate For Class', icon: 'sparkles' },
  { id: 'generate-teacher', label: 'Generate For Teachers', icon: 'teacher' },
];

const dayOptions = [
  { value: 1, id: 'saturday', label: 'Saturday' },
  { value: 2, id: 'sunday', label: 'Sunday' },
  { value: 3, id: 'monday', label: 'Monday' },
  { value: 4, id: 'tuesday', label: 'Tuesday' },
  { value: 5, id: 'wednesday', label: 'Wednesday' },
  { value: 6, id: 'thursday', label: 'Thursday' },
  { value: 7, id: 'friday', label: 'Friday' },
];

const emptyRoomForm = { id: '', roomNumber: '', capacity: '40' };
const emptyPeriodForm = { id: '', type: 'CLASS_TIME' as TimePeriodType, name: '', startTime: '', endTime: '' };
const emptyRoutineForm = {
  id: '',
  dayOfWeek: 0,
  timePeriodId: '',
  subjectId: '',
  teacherId: '',
  classRoomId: '',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-400';

const getErrorMessage = (error: unknown) => {
  const value = error as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
  return value.response?.data?.error?.message ?? value.response?.data?.message ?? value.message ?? 'Action failed';
};

const teacherName = (teacher?: TeacherOption | null) =>
  teacher ? `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim() || teacher.employeeNo || 'Teacher' : 'Teacher';

const sectionOptionsForClass = (classes: AcademicClass[] | undefined, classId: string) =>
  classes?.find((item) => item.id === classId)?.classSections?.map((link) => link.section) ?? [];

const timeRange = (period: TimePeriod) => `${period.startTime}-${period.endTime}`;

const Icon = ({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) => {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'calendar':
      return <svg {...common}><path d="M7 3v3" /><path d="M17 3v3" /><path d="M4 8h16" /><path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z" /></svg>;
    case 'building':
      return <svg {...common}><path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M9 7h3" /><path d="M9 11h3" /><path d="M9 15h3" /></svg>;
    case 'clock':
      return <svg {...common}><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 7v5l3 2" /></svg>;
    case 'grid':
      return <svg {...common}><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></svg>;
    case 'sparkles':
      return <svg {...common}><path d="M12 3l1.4 4.2L17.5 9l-4.1 1.8L12 15l-1.4-4.2L6.5 9l4.1-1.8L12 3Z" /><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" /><path d="M19 13l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13Z" /></svg>;
    case 'teacher':
      return <svg {...common}><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M3.5 19a4.5 4.5 0 0 1 9 0" /><path d="M14 6h6" /><path d="M14 10h6" /><path d="M14 14h4" /></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case 'save':
      return <svg {...common}><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h10L20 7.5v12A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-14Z" /><path d="M8 4v6h8V4" /><path d="M8 21v-7h8v7" /></svg>;
    case 'edit':
      return <svg {...common}><path d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16l-1 3Z" /><path d="m14 7 3 3" /></svg>;
    case 'trash':
      return <svg {...common}><path d="M5 7h14" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M7 7l1 14h8l1-14" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>;
    case 'x':
      return <svg {...common}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
    default:
      return <svg {...common}><path d="M4 4h16v16H4z" /></svg>;
  }
};

const PrimaryButton = ({
  children,
  onClick,
  disabled,
  icon = 'save',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: IconName;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--theme-button-bg)] to-purple-600 px-4 py-2 text-sm font-black text-white shadow-sm shadow-purple-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Icon name={icon} className="h-4 w-4" />
    {children}
  </button>
);

const IconButton = ({
  icon,
  label,
  onClick,
  variant = 'secondary',
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  variant?: 'secondary' | 'danger';
  disabled?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
      variant === 'danger'
        ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
    }`}
  >
    <Icon name={icon} className="h-4 w-4" />
  </button>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const Panel = ({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
    {message}
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
    <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
  </div>
);

export default function TimetableManagementPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TimetableTab>('create');
  const [weekends, setWeekends] = useState<WeekendSetting[]>([]);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [periodForm, setPeriodForm] = useState(emptyPeriodForm);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [defaultRoomId, setDefaultRoomId] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [routineForm, setRoutineForm] = useState(emptyRoutineForm);
  const [teacherId, setTeacherId] = useState('');

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const canManageTimetable = isSchoolAdmin || permissionCodes.includes('academics.setup');

  const settingsQuery = useQuery({
    queryKey: ['school-system-settings', session?.schoolId, 'timetable'],
    queryFn: () => getSchoolSystemSettings(),
    enabled: canManageTimetable,
    refetchOnWindowFocus: false,
  });
  const classesQuery = useQuery({ queryKey: ['timetable-setup-classes'], queryFn: () => listSetupClasses(), enabled: canManageTimetable });
  const roomsQuery = useQuery({ queryKey: ['timetable-class-rooms'], queryFn: () => listClassRooms(), enabled: canManageTimetable });
  const periodsQuery = useQuery({ queryKey: ['timetable-time-periods'], queryFn: listTimePeriods, enabled: canManageTimetable });
  const teachersQuery = useQuery({ queryKey: ['timetable-teachers'], queryFn: () => listTimetableTeachers(), enabled: canManageTimetable });
  const assignmentsQuery = useQuery({
    queryKey: ['timetable-assign-subjects', selectedClassId, selectedSectionId],
    queryFn: () => listAssignSubjects({ classId: selectedClassId, sectionId: selectedSectionId }),
    enabled: canManageTimetable && Boolean(selectedClassId && selectedSectionId),
  });
  const routinesQuery = useQuery({
    queryKey: ['timetable-routines', selectedClassId, selectedSectionId],
    queryFn: () => listClassRoutines({ classId: selectedClassId, sectionId: selectedSectionId }),
    enabled: canManageTimetable && Boolean(selectedClassId && selectedSectionId),
  });
  const teacherRoutinesQuery = useQuery({
    queryKey: ['timetable-routines-teacher', teacherId],
    queryFn: () => listClassRoutines({ teacherId }),
    enabled: canManageTimetable && Boolean(teacherId),
  });

  useEffect(() => {
    if (settingsQuery.data?.weekends) setWeekends(settingsQuery.data.weekends);
  }, [settingsQuery.data?.weekends]);

  useEffect(() => {
    setSelectedSectionId('');
    setRoutineForm(emptyRoutineForm);
  }, [selectedClassId]);

  const classes = classesQuery.data ?? [];
  const sectionOptions = useMemo(() => sectionOptionsForClass(classes, selectedClassId), [classes, selectedClassId]);
  const rooms = roomsQuery.data ?? [];
  const periods = periodsQuery.data ?? [];
  const classPeriods = periods.filter((period) => period.type === 'CLASS_TIME');
  const assignments = assignmentsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];
  const routines = routinesQuery.data ?? [];
  const teacherRoutines = teacherRoutinesQuery.data ?? [];

  const weekendDayValues = useMemo(() => {
    const configuredWeekends = weekends.length ? weekends : [{ id: 'friday', name: 'Friday', isWeekend: true }];
    const weekendKeys = new Set(
      configuredWeekends
        .filter((day) => day.isWeekend)
        .flatMap((day) => [String(day.id ?? '').toLowerCase(), String(day.name ?? '').toLowerCase()]),
    );
    return new Set(dayOptions.filter((day) => weekendKeys.has(day.id) || weekendKeys.has(day.label.toLowerCase())).map((day) => day.value));
  }, [weekends]);
  const workingDays = useMemo(() => dayOptions.filter((day) => !weekendDayValues.has(day.value)), [weekendDayValues]);
  const weekendLabels = useMemo(() => dayOptions.filter((day) => weekendDayValues.has(day.value)).map((day) => day.label), [weekendDayValues]);

  const routineByCell = useMemo(() => {
    const map = new Map<string, ClassRoutine>();
    routines.forEach((routine) => map.set(`${routine.dayOfWeek}:${routine.timePeriodId}`, routine));
    return map;
  }, [routines]);

  const teacherRoutineByCell = useMemo(() => {
    const map = new Map<string, ClassRoutine>();
    teacherRoutines.forEach((routine) => map.set(`${routine.dayOfWeek}:${routine.timePeriodId}`, routine));
    return map;
  }, [teacherRoutines]);

  const invalidateTimetable = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['school-system-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['timetable-class-rooms'] }),
      queryClient.invalidateQueries({ queryKey: ['timetable-time-periods'] }),
      queryClient.invalidateQueries({ queryKey: ['timetable-routines'] }),
      queryClient.invalidateQueries({ queryKey: ['timetable-routines-teacher'] }),
    ]);
  };

  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const weekendMutation = useMutation({
    mutationFn: () => updateSchoolSystemSettings({ weekends }),
    onSuccess: async () => {
      notify.success('Weekend updated');
      await invalidateTimetable();
    },
    onError,
  });

  const roomMutation = useMutation({
    mutationFn: () => {
      const roomNumber = roomForm.roomNumber.trim().replace(/\s+/g, ' ');
      return roomForm.id
        ? updateClassRoom(roomForm.id, { roomNumber, capacity: Number(roomForm.capacity) })
        : createClassRoom({ roomNumber, capacity: Number(roomForm.capacity) });
    },
    onSuccess: async () => {
      setRoomForm(emptyRoomForm);
      notify.success('Class room saved');
      await invalidateTimetable();
    },
    onError,
  });

  const periodMutation = useMutation({
    mutationFn: () =>
      periodForm.id
        ? updateTimePeriod(periodForm.id, {
            type: periodForm.type,
            name: periodForm.name,
            startTime: periodForm.startTime,
            endTime: periodForm.endTime,
          })
        : createTimePeriod({
            type: periodForm.type,
            name: periodForm.name,
            startTime: periodForm.startTime,
            endTime: periodForm.endTime,
          }),
    onSuccess: async () => {
      setPeriodForm(emptyPeriodForm);
      notify.success('Time period saved');
      await invalidateTimetable();
    },
    onError,
  });

  const seedPeriodsMutation = useMutation({
    mutationFn: seedDefaultTimePeriods,
    onSuccess: async (result) => {
      notify.success('Standard periods generated', `${result.createdCount} added, ${result.updatedCount} updated, ${result.skippedCount} skipped.`);
      await invalidateTimetable();
    },
    onError,
  });

  const routineMutation = useMutation({
    mutationFn: () =>
      routineForm.id
        ? updateClassRoutine(routineForm.id, {
            classId: selectedClassId,
            sectionId: selectedSectionId,
            dayOfWeek: routineForm.dayOfWeek,
            timePeriodId: routineForm.timePeriodId,
            subjectId: routineForm.subjectId,
            teacherId: routineForm.teacherId,
            classRoomId: routineForm.classRoomId || null,
          })
        : createClassRoutine({
            classId: selectedClassId,
            sectionId: selectedSectionId,
            dayOfWeek: routineForm.dayOfWeek,
            timePeriodId: routineForm.timePeriodId,
            subjectId: routineForm.subjectId,
            teacherId: routineForm.teacherId,
            classRoomId: routineForm.classRoomId || null,
          }),
    onSuccess: async () => {
      setRoutineForm(emptyRoutineForm);
      notify.success('Timetable cell saved');
      await invalidateTimetable();
    },
    onError,
  });

  const generateClassMutation = useMutation({
    mutationFn: () =>
      generateClassRoutine({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        classRoomId: defaultRoomId || null,
        replaceExisting,
        days: workingDays.map((day) => day.value),
      }),
    onSuccess: async (result) => {
      notify.success('Class timetable generated', `${result.createdCount} cells created. ${result.skippedCount} skipped.`);
      await invalidateTimetable();
      setActiveTab('create');
    },
    onError,
  });

  const validateRoom = () => {
    const roomNumber = roomForm.roomNumber.trim().replace(/\s+/g, ' ');
    if (!roomNumber) return notify.error('Validation error', 'Room number is required.');
    if (!Number(roomForm.capacity) || Number(roomForm.capacity) < 1) return notify.error('Validation error', 'Capacity must be greater than 0.');
    roomMutation.mutate();
  };

  const validatePeriod = () => {
    if (!periodForm.name.trim()) return notify.error('Validation error', 'Period name is required.');
    if (!periodForm.startTime || !periodForm.endTime) return notify.error('Validation error', 'Start and end time are required.');
    if (periodForm.endTime <= periodForm.startTime) return notify.error('Validation error', 'End time must be after start time.');
    periodMutation.mutate();
  };

  const validateRoutine = () => {
    if (!selectedClassId || !selectedSectionId) return notify.error('Validation error', 'Select class and section first.');
    if (!routineForm.dayOfWeek || !routineForm.timePeriodId || !routineForm.subjectId || !routineForm.teacherId) {
      return notify.error('Validation error', 'Select day, period, subject, and teacher.');
    }
    if (weekendDayValues.has(routineForm.dayOfWeek)) return notify.error('Validation error', 'Selected day is configured as weekend.');
    routineMutation.mutate();
  };

  const validateGenerateClass = () => {
    if (!selectedClassId || !selectedSectionId) return notify.error('Validation error', 'Select class and section first.');
    if (!workingDays.length) return notify.error('Validation error', 'All days are configured as weekend.');
    if (!classPeriods.length) return notify.error('Validation error', 'Add class time periods before generation.');
    if (!assignments.length) return notify.error('Validation error', 'Assign subjects with teachers before generation.');
    generateClassMutation.mutate();
  };

  const confirmDelete = (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    action()
      .then(async () => {
        notify.success('Deleted successfully');
        await invalidateTimetable();
      })
      .catch(onError);
  };

  const renderClassSectionPicker = () => (
    <div className="grid gap-3 md:grid-cols-3">
      <Field label="Class">
        <select className={inputClass} value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
          <option value="">Select class</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Section">
        <select className={inputClass} value={selectedSectionId} disabled={!selectedClassId} onChange={(event) => setSelectedSectionId(event.target.value)}>
          <option value="">Select section</option>
          {sectionOptions.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </Field>
      <Field label="Default room">
        <select className={inputClass} value={defaultRoomId} onChange={(event) => setDefaultRoomId(event.target.value)}>
          <option value="">No default room</option>
          {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} ({room.capacity})</option>)}
        </select>
      </Field>
    </div>
  );

  const renderWeekend = () => (
    <Panel
      title="Weekend"
      subtitle="These days come from System Settings and are used by class and teacher timetable generation."
      actions={<PrimaryButton icon="save" disabled={weekendMutation.isPending || !weekends.length} onClick={() => weekendMutation.mutate()}>Update Weekend</PrimaryButton>}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {weekends.map((day) => (
          <label key={day.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-black text-slate-800">{day.name}</span>
            <input
              type="checkbox"
              checked={day.isWeekend}
              onChange={(event) => setWeekends((current) => current.map((item) => item.id === day.id ? { ...item, isWeekend: event.target.checked } : item))}
              className="h-5 w-5 accent-purple-600"
            />
          </label>
        ))}
      </div>
    </Panel>
  );

  const renderRooms = () => (
    <Panel title="Class Room" subtitle="Add real rooms here and use them in timetable cells. Duplicate room numbers are blocked.">
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-4">
            <Field label="Room number">
              <input className={inputClass} value={roomForm.roomNumber} onChange={(event) => setRoomForm((current) => ({ ...current, roomNumber: event.target.value }))} />
            </Field>
            <Field label="Capacity">
              <input type="number" min={1} className={inputClass} value={roomForm.capacity} onChange={(event) => setRoomForm((current) => ({ ...current, capacity: event.target.value }))} />
            </Field>
            <div className="flex gap-2">
              <PrimaryButton icon="save" disabled={roomMutation.isPending} onClick={validateRoom}>{roomForm.id ? 'Update Room' : 'Save Room'}</PrimaryButton>
              {roomForm.id ? <IconButton icon="x" label="Cancel edit" onClick={() => setRoomForm(emptyRoomForm)} /> : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Routine Cells</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="px-4 py-3 font-bold text-slate-900">{room.roomNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{room.capacity}</td>
                  <td className="px-4 py-3 text-slate-600">{room._count?.classRoutines ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconButton icon="edit" label="Edit room" onClick={() => setRoomForm({ id: room.id, roomNumber: room.roomNumber, capacity: String(room.capacity) })} />
                      <IconButton icon="trash" label="Delete room" variant="danger" onClick={() => confirmDelete(`Delete room ${room.roomNumber}?`, () => deleteClassRoom(room.id))} />
                    </div>
                  </td>
                </tr>
              ))}
              {!rooms.length ? <tr><td colSpan={4} className="px-4 py-8"><EmptyState message="No class rooms found." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );

  const renderPeriods = () => (
    <Panel
      title="Time / Period"
      subtitle="Create class periods and breaks. Auto generation uses only Class Time rows."
      actions={<PrimaryButton icon="sparkles" disabled={seedPeriodsMutation.isPending} onClick={() => seedPeriodsMutation.mutate()}>Generate Standard Periods</PrimaryButton>}
    >
      <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-4">
            <Field label="Type">
              <select className={inputClass} value={periodForm.type} onChange={(event) => setPeriodForm((current) => ({ ...current, type: event.target.value as TimePeriodType }))}>
                <option value="CLASS_TIME">Class Time</option>
                <option value="BREAK">Break</option>
                <option value="EXAM_TIME">Exam Time</option>
              </select>
            </Field>
            <Field label="Period name">
              <input className={inputClass} value={periodForm.name} onChange={(event) => setPeriodForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start time">
                <input type="time" className={inputClass} value={periodForm.startTime} onChange={(event) => setPeriodForm((current) => ({ ...current, startTime: event.target.value }))} />
              </Field>
              <Field label="End time">
                <input type="time" className={inputClass} value={periodForm.endTime} onChange={(event) => setPeriodForm((current) => ({ ...current, endTime: event.target.value }))} />
              </Field>
            </div>
            <div className="flex gap-2">
              <PrimaryButton icon="save" disabled={periodMutation.isPending} onClick={validatePeriod}>{periodForm.id ? 'Update Period' : 'Save Period'}</PrimaryButton>
              {periodForm.id ? <IconButton icon="x" label="Cancel edit" onClick={() => setPeriodForm(emptyPeriodForm)} /> : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Routine Cells</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {periods.map((period) => (
                <tr key={period.id}>
                  <td className="px-4 py-3 font-bold text-slate-900">{period.name}</td>
                  <td className="px-4 py-3 text-slate-600">{period.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-slate-600">{timeRange(period)}</td>
                  <td className="px-4 py-3 text-slate-600">{period._count?.classRoutines ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconButton icon="edit" label="Edit period" onClick={() => setPeriodForm({ id: period.id, type: period.type, name: period.name, startTime: period.startTime, endTime: period.endTime })} />
                      <IconButton icon="trash" label="Delete period" variant="danger" onClick={() => confirmDelete(`Delete ${period.name}?`, () => deleteTimePeriod(period.id))} />
                    </div>
                  </td>
                </tr>
              ))}
              {!periods.length ? <tr><td colSpan={5} className="px-4 py-8"><EmptyState message="No time periods found." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );

  const renderRoutineForm = () => (
    <Panel
      title={routineForm.id ? 'Edit Timetable Cell' : 'Create Timetable Cell'}
      subtitle="Manual cells use assigned subject-teacher pairs and validate teacher, room, and weekend conflicts."
    >
      {renderClassSectionPicker()}
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <Field label="Day">
          <select className={inputClass} value={routineForm.dayOfWeek} onChange={(event) => setRoutineForm((current) => ({ ...current, dayOfWeek: Number(event.target.value) }))}>
            <option value={0}>Select day</option>
            {workingDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
        </Field>
        <Field label="Period">
          <select className={inputClass} value={routineForm.timePeriodId} onChange={(event) => setRoutineForm((current) => ({ ...current, timePeriodId: event.target.value }))}>
            <option value="">Select period</option>
            {classPeriods.map((period) => <option key={period.id} value={period.id}>{period.name} ({timeRange(period)})</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <select className={inputClass} value={routineForm.subjectId} disabled={!selectedClassId || !selectedSectionId} onChange={(event) => {
            const subjectId = event.target.value;
            const assigned = assignments.find((item) => item.subjectId === subjectId);
            setRoutineForm((current) => ({ ...current, subjectId, teacherId: assigned?.teacherId ?? current.teacherId }));
          }}>
            <option value="">Select subject</option>
            {assignments.map((item) => <option key={item.id} value={item.subjectId}>{item.subject?.name}</option>)}
          </select>
        </Field>
        <Field label="Teacher">
          <select className={inputClass} value={routineForm.teacherId} disabled={!selectedClassId || !selectedSectionId} onChange={(event) => setRoutineForm((current) => ({ ...current, teacherId: event.target.value }))}>
            <option value="">Select teacher</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
          </select>
        </Field>
        <Field label="Room">
          <select className={inputClass} value={routineForm.classRoomId} onChange={(event) => setRoutineForm((current) => ({ ...current, classRoomId: event.target.value }))}>
            <option value="">No room</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <PrimaryButton icon="save" disabled={routineMutation.isPending} onClick={validateRoutine}>{routineForm.id ? 'Update Cell' : 'Save Cell'}</PrimaryButton>
        {routineForm.id ? <IconButton icon="x" label="Cancel edit" onClick={() => setRoutineForm(emptyRoutineForm)} /> : null}
      </div>
      {!assignments.length && selectedClassId && selectedSectionId ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">Assign subjects and teachers before creating timetable cells.</p>
      ) : null}
    </Panel>
  );

  const renderClassGrid = () => (
    <Panel
      title="Class Timetable"
      subtitle={`Weekend: ${weekendLabels.join(', ') || 'None'}. Existing weekend cells remain visible so you can edit or delete them.`}
    >
      {!selectedClassId || !selectedSectionId ? <EmptyState message="Select class and section to view timetable." /> : periodsQuery.isLoading || routinesQuery.isLoading ? <LoadingSkeleton /> : (
        <RoutineGrid
          periods={periods}
          routinesByCell={routineByCell}
          weekendDayValues={weekendDayValues}
          emptyLabel="Add cell"
          onAdd={(dayValue, periodId) => {
            setRoutineForm({ ...emptyRoutineForm, dayOfWeek: dayValue, timePeriodId: periodId, classRoomId: defaultRoomId });
            setActiveTab('create');
          }}
          onEdit={(routine) => {
            setRoutineForm({
              id: routine.id,
              dayOfWeek: routine.dayOfWeek,
              timePeriodId: routine.timePeriodId,
              subjectId: routine.subjectId,
              teacherId: routine.teacherId,
              classRoomId: routine.classRoomId ?? '',
            });
            setSelectedClassId(routine.classId);
            setSelectedSectionId(routine.sectionId);
            setActiveTab('create');
          }}
          onDelete={(routine) => confirmDelete('Delete this timetable cell?', () => deleteClassRoutine(routine.id))}
        />
      )}
    </Panel>
  );

  const renderCreate = () => (
    <div className="space-y-5">
      {renderRoutineForm()}
      {renderClassGrid()}
    </div>
  );

  const renderGenerateClass = () => (
    <div className="space-y-5">
      <Panel
        title="Generate For Class"
        subtitle="Auto-fill the selected class-section using assigned subjects and teachers. Weekend days are skipped."
      >
        {renderClassSectionPicker()}
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase text-slate-500">Working days</p>
            <p className="mt-1 text-xl font-black text-slate-950">{workingDays.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase text-slate-500">Class periods</p>
            <p className="mt-1 text-xl font-black text-slate-950">{classPeriods.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase text-slate-500">Assigned subjects</p>
            <p className="mt-1 text-xl font-black text-slate-950">{assignments.length}</p>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} className="h-5 w-5 accent-purple-600" />
            Replace existing cells
          </label>
        </div>
        <div className="mt-5">
          <PrimaryButton icon="sparkles" disabled={generateClassMutation.isPending || !selectedClassId || !selectedSectionId} onClick={validateGenerateClass}>
            Generate Class Timetable
          </PrimaryButton>
        </div>
      </Panel>
      {renderClassGrid()}
    </div>
  );

  const renderGenerateTeacher = () => (
    <div className="space-y-5">
      <Panel title="Generate For Teachers" subtitle="Select a teacher to generate the timetable view from class routine cells.">
        <div className="grid gap-3 md:grid-cols-[minmax(0,24rem)_auto] md:items-end">
          <Field label="Teacher">
            <select className={inputClass} value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              <option value="">Select teacher</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)} {teacher.employeeNo ? `(${teacher.employeeNo})` : ''}</option>)}
            </select>
          </Field>
          <PrimaryButton icon="teacher" disabled={!teacherId || teacherRoutinesQuery.isFetching} onClick={() => teacherRoutinesQuery.refetch()}>
            Generate Teacher View
          </PrimaryButton>
        </div>
      </Panel>
      <Panel title="Teacher Timetable">
        {!teacherId ? <EmptyState message="Select a teacher to view timetable." /> : teacherRoutinesQuery.isLoading ? <LoadingSkeleton /> : (
          <TeacherRoutineGrid periods={periods} routinesByCell={teacherRoutineByCell} weekendDayValues={weekendDayValues} />
        )}
      </Panel>
    </div>
  );

  if (sessionLoading) return <LoadingSkeleton />;

  if (!canManageTimetable) {
    return (
      <div>
        <PageHeader title="Timetable" subtitle="Timetable access is controlled by Role Permissions." />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
          Timetable setup is not enabled for your role. Ask a School Admin to enable Academic Setup from Role Permissions.
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 pb-10">
      <PageHeader
        title="Timetable"
        subtitle="Weekend, class rooms, periods, manual timetable cells, class generation, and teacher timetable views."
      />

      <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-2 pb-2 text-xs font-black uppercase tracking-wide text-slate-500">Timetable Menu</p>
            <nav className="space-y-1" aria-label="Timetable menu">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-black transition ${
                      isActive
                        ? 'border-purple-200 bg-purple-50 text-purple-950 shadow-sm'
                        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? 'bg-white text-purple-700 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:text-purple-700'}`}>
                      <Icon name={tab.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Weekend</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-950">{weekendLabels.join(', ') || 'None'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Rooms</p>
              <p className="mt-1 text-xl font-black text-slate-950">{rooms.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Class Periods</p>
              <p className="mt-1 text-xl font-black text-slate-950">{classPeriods.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Current Cells</p>
              <p className="mt-1 text-xl font-black text-slate-950">{routines.length}</p>
            </div>
          </div>

          {activeTab === 'weekend' ? renderWeekend() : null}
          {activeTab === 'rooms' ? renderRooms() : null}
          {activeTab === 'periods' ? renderPeriods() : null}
          {activeTab === 'create' ? renderCreate() : null}
          {activeTab === 'generate-class' ? renderGenerateClass() : null}
          {activeTab === 'generate-teacher' ? renderGenerateTeacher() : null}
        </main>
      </div>
    </div>
  );
}

function RoutineGrid({
  periods,
  routinesByCell,
  weekendDayValues,
  emptyLabel,
  onAdd,
  onEdit,
  onDelete,
}: {
  periods: TimePeriod[];
  routinesByCell: Map<string, ClassRoutine>;
  weekendDayValues: Set<number>;
  emptyLabel: string;
  onAdd: (dayValue: number, periodId: string) => void;
  onEdit: (routine: ClassRoutine) => void;
  onDelete: (routine: ClassRoutine) => void;
}) {
  if (!periods.length) return <EmptyState message="Add time periods before creating timetable." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 rounded-tl-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-black uppercase text-slate-500">Period</th>
            {dayOptions.map((day) => <th key={day.value} className="border-y border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-black uppercase text-slate-500">{day.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id}>
              <td className="sticky left-0 z-10 border-x border-b border-slate-200 bg-white px-3 py-3 font-bold text-slate-800">
                <div>{period.name}</div>
                <div className="text-xs font-normal text-slate-500">{timeRange(period)}</div>
              </td>
              {dayOptions.map((day) => {
                const routine = routinesByCell.get(`${day.value}:${period.id}`);
                const isWeekend = weekendDayValues.has(day.value);
                const isBreak = period.type === 'BREAK';
                const isClassTime = period.type === 'CLASS_TIME';
                return (
                  <td key={`${day.value}-${period.id}`} className="h-24 border-b border-r border-slate-200 px-3 py-2 align-top">
                    {isBreak ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Break</span>
                    ) : routine ? (
                      <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50 p-2">
                        <div className="font-bold text-purple-950">{routine.subject?.name}</div>
                        <div className="text-xs font-semibold text-purple-700">{teacherName(routine.teacher)}</div>
                        <div className="text-xs text-purple-700">{routine.classRoom?.roomNumber ? `Room ${routine.classRoom.roomNumber}` : 'No room'}</div>
                        <div className="flex flex-wrap gap-1">
                          <IconButton icon="edit" label="Edit cell" onClick={() => onEdit(routine)} />
                          <IconButton icon="trash" label="Delete cell" variant="danger" onClick={() => onDelete(routine)} />
                        </div>
                      </div>
                    ) : isWeekend ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Weekend</span>
                    ) : !isClassTime ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Exam</span>
                    ) : (
                      <button
                        type="button"
                        className="flex h-full min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-xs font-black text-purple-700 hover:border-purple-300 hover:bg-purple-50"
                        onClick={() => onAdd(day.value, period.id)}
                      >
                        <Icon name="plus" className="h-4 w-4" />
                        {emptyLabel}
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
  );
}

function TeacherRoutineGrid({
  periods,
  routinesByCell,
  weekendDayValues,
}: {
  periods: TimePeriod[];
  routinesByCell: Map<string, ClassRoutine>;
  weekendDayValues: Set<number>;
}) {
  if (!periods.length) return <EmptyState message="Add time periods before viewing teacher timetable." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 rounded-tl-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-black uppercase text-slate-500">Period</th>
            {dayOptions.map((day) => <th key={day.value} className="border-y border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-black uppercase text-slate-500">{day.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id}>
              <td className="sticky left-0 z-10 border-x border-b border-slate-200 bg-white px-3 py-3 font-bold text-slate-800">
                <div>{period.name}</div>
                <div className="text-xs font-normal text-slate-500">{timeRange(period)}</div>
              </td>
              {dayOptions.map((day) => {
                const routine = routinesByCell.get(`${day.value}:${period.id}`);
                const isWeekend = weekendDayValues.has(day.value);
                const isBreak = period.type === 'BREAK';
                const isClassTime = period.type === 'CLASS_TIME';
                return (
                  <td key={`${day.value}-${period.id}`} className="h-24 border-b border-r border-slate-200 px-3 py-2 align-top">
                    {isBreak ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Break</span>
                    ) : routine ? (
                      <div className="space-y-1 rounded-xl border border-sky-100 bg-sky-50 p-2">
                        <div className="font-bold text-sky-950">{routine.class?.name} - {routine.section?.name}</div>
                        <div className="text-xs font-semibold text-sky-700">{routine.subject?.name}</div>
                        <div className="text-xs text-sky-700">{routine.classRoom?.roomNumber ? `Room ${routine.classRoom.roomNumber}` : 'No room'}</div>
                      </div>
                    ) : isWeekend ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Weekend</span>
                    ) : !isClassTime ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Exam</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Free</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
