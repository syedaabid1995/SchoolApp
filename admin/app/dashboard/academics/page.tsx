'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import SystemSetupTab from '../settings/system-setup';
import {
  createAcademicYear,
  deleteAcademicYear,
  listAcademicYears,
  listTimetableTeachers,
  updateAcademicYear,
} from '../../../services/academic.service';
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
  generateClassRoutine,
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
  seedDefaultTimePeriods,
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
import { getSchoolSystemSettings } from '../../../services/system-settings.service';

type TabId =
  | 'academic-years'
  | 'classes'
  | 'sections'
  | 'subjects'
  | 'holidays'
  | 'rooms'
  | 'times'
  | 'assign-subjects'
  | 'class-teachers'
  | 'routine';

type AcademicIconName =
  | 'calendar'
  | 'book'
  | 'layers'
  | 'building'
  | 'clock'
  | 'shuffle'
  | 'teacher'
  | 'grid'
  | 'plus'
  | 'save'
  | 'edit'
  | 'trash'
  | 'x'
  | 'search'
  | 'sparkles'
  | 'chevron-left'
  | 'chevron-right';

const tabs: Array<{ id: TabId; label: string; description: string; icon: AcademicIconName }> = [
  { id: 'academic-years', label: 'Academic Year', description: 'Academic sessions and active year dates', icon: 'calendar' },
  { id: 'classes', label: 'Classes', description: 'Class names and linked sections', icon: 'book' },
  { id: 'sections', label: 'Section', description: 'Reusable class sections', icon: 'layers' },
  { id: 'subjects', label: 'Subject', description: 'Theory and practical subjects', icon: 'book' },
  { id: 'holidays', label: 'Holidays', description: 'School holidays and calendar exceptions', icon: 'calendar' },
  { id: 'assign-subjects', label: 'Assign Multiple Subjects', description: 'Subjects and teachers by class-section', icon: 'shuffle' },
  { id: 'class-teachers', label: 'Assign Class Teacher', description: 'Class-section teacher ownership', icon: 'teacher' },
];

const tabIds = new Set<TabId>(tabs.map((tab) => tab.id));
const getTabFromUrl = (value: string | null): TabId => (value && tabIds.has(value as TabId) ? (value as TabId) : 'academic-years');
const ACADEMIC_PAGE_SIZE = 10;

const dayOptions = [
  { value: 1, id: 'saturday', label: 'Saturday' },
  { value: 2, id: 'sunday', label: 'Sunday' },
  { value: 3, id: 'monday', label: 'Monday' },
  { value: 4, id: 'tuesday', label: 'Tuesday' },
  { value: 5, id: 'wednesday', label: 'Wednesday' },
  { value: 6, id: 'thursday', label: 'Thursday' },
  { value: 7, id: 'friday', label: 'Friday' },
];

const defaultPeriodPreview = [
  { name: '1ST PERIOD', time: '09:00-09:45', type: 'Class' },
  { name: '2ND PERIOD', time: '09:45-10:30', type: 'Class' },
  { name: 'SHORT BREAK', time: '10:30-10:45', type: 'Break' },
  { name: '3RD PERIOD', time: '10:45-11:30', type: 'Class' },
  { name: '4TH PERIOD', time: '11:30-12:15', type: 'Class' },
  { name: 'LUNCH BREAK', time: '12:15-13:00', type: 'Break' },
  { name: '5TH PERIOD', time: '13:00-13:45', type: 'Class' },
  { name: '6TH PERIOD', time: '13:45-14:30', type: 'Class' },
  { name: '7TH PERIOD', time: '14:30-15:15', type: 'Class' },
];

const emptyClassForm = { id: '', name: '', academicYearId: '', sectionIds: [] as string[] };
const emptyAcademicYearForm = { id: '', name: '', startDate: '', endDate: '', isActive: false };
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

type BatchAcademicYearForm = typeof emptyAcademicYearForm & { rowId: string };
type BatchClassForm = typeof emptyClassForm & { rowId: string };
type BatchSectionForm = typeof emptySectionForm & { rowId: string };
type BatchSubjectForm = typeof emptySubjectForm & { rowId: string };

const createBatchId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const createAcademicYearBatchRow = (): BatchAcademicYearForm => ({ ...emptyAcademicYearForm, rowId: createBatchId() });
const createClassBatchRow = (): BatchClassForm => ({ ...emptyClassForm, rowId: createBatchId(), sectionIds: [] });
const createSectionBatchRow = (): BatchSectionForm => ({ ...emptySectionForm, rowId: createBatchId() });
const createSubjectBatchRow = (): BatchSubjectForm => ({ ...emptySubjectForm, rowId: createBatchId() });

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

const AcademicIcon = ({ name, className = 'h-4 w-4' }: { name: AcademicIconName; className?: string }) => {
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
    case 'book':
      return <svg {...common}><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3v-18Z" /><path d="M5 18.5A3 3 0 0 1 8 16h10" /></svg>;
    case 'layers':
      return <svg {...common}><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></svg>;
    case 'building':
      return <svg {...common}><path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M9 7h3" /><path d="M9 11h3" /><path d="M9 15h3" /></svg>;
    case 'clock':
      return <svg {...common}><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 7v5l3 2" /></svg>;
    case 'shuffle':
      return <svg {...common}><path d="M4 7h3c3 0 4 10 7 10h6" /><path d="M4 17h3c1.4 0 2.3-1.6 3.2-3.5" /><path d="m17 4 3 3-3 3" /><path d="m17 14 3 3-3 3" /></svg>;
    case 'teacher':
      return <svg {...common}><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M3.5 19a4.5 4.5 0 0 1 9 0" /><path d="M14 6h6" /><path d="M14 10h6" /><path d="M14 14h4" /></svg>;
    case 'grid':
      return <svg {...common}><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></svg>;
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
    case 'search':
      return <svg {...common}><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" /><path d="m16 16 4 4" /></svg>;
    case 'sparkles':
      return <svg {...common}><path d="M12 3l1.4 4.2L17.5 9l-4.1 1.8L12 15l-1.4-4.2L6.5 9l4.1-1.8L12 3Z" /><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" /><path d="M19 13l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13Z" /></svg>;
    case 'chevron-left':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'chevron-right':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    default:
      return <svg {...common}><path d="M4 4h16v16H4z" /></svg>;
  }
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
  disabled,
  icon = 'save',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: AcademicIconName;
  type?: 'button' | 'submit';
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--theme-button-bg)] to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <AcademicIcon name={icon} className="h-4 w-4" />
    {children}
  </button>
);

const SecondaryButton = ({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: AcademicIconName;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {icon ? <AcademicIcon name={icon} className="h-4 w-4" /> : null}
    {children}
  </button>
);

const DangerButton = ({
  children,
  onClick,
  disabled,
  icon = 'trash',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: AcademicIconName;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <AcademicIcon name={icon} className="h-4 w-4" />
    {children}
  </button>
);

const IconButton = ({
  icon,
  label,
  onClick,
  disabled,
  variant = 'secondary',
  size = 'md',
}: {
  icon: AcademicIconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
}) => {
  const variantClass =
    variant === 'primary'
      ? 'border-transparent bg-gradient-to-r from-[var(--theme-button-bg)] to-purple-600 text-white shadow-sm shadow-purple-100 hover:brightness-105'
      : variant === 'danger'
        ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100';
  const sizeClass = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center border transition disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${variantClass}`}
    >
      <AcademicIcon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
    </button>
  );
};

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

const FormCard = ({
  title,
  children,
  isOpen = true,
  actionLabel,
  onOpen,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  actionLabel?: string;
  onOpen?: () => void;
  onClose?: () => void;
}) => {
  if (!isOpen) {
    return (
      <section className="rounded-2xl border border-dashed border-purple-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Create New</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
          </div>
          <IconButton icon="plus" label={actionLabel ?? title} variant="primary" onClick={onOpen} />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {onClose ? (
          <SecondaryButton icon="x" onClick={onClose}>
            Close
          </SecondaryButton>
        ) : null}
      </div>
      <div className="mt-4 max-w-4xl space-y-4">{children}</div>
    </section>
  );
};

const ListCard = ({ title, children, search, setSearch }: { title: string; children: React.ReactNode; search?: string; setSearch?: (value: string) => void }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {setSearch ? (
        <label className="relative sm:min-w-72">
          <AcademicIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Quick search..."
            value={search ?? ''}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

export default function AcademicSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = getTabFromUrl(searchParams.get('tab'));
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl);
  const [search, setSearch] = useState('');
  const [expandedForms, setExpandedForms] = useState<Partial<Record<TabId, boolean>>>({});

  const [academicYearForm, setAcademicYearForm] = useState(emptyAcademicYearForm);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [academicYearBatchRows, setAcademicYearBatchRows] = useState<BatchAcademicYearForm[]>(() => [createAcademicYearBatchRow()]);
  const [classBatchRows, setClassBatchRows] = useState<BatchClassForm[]>(() => [createClassBatchRow()]);
  const [sectionBatchRows, setSectionBatchRows] = useState<BatchSectionForm[]>(() => [createSectionBatchRow()]);
  const [subjectBatchRows, setSubjectBatchRows] = useState<BatchSubjectForm[]>(() => [createSubjectBatchRow()]);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [timeForm, setTimeForm] = useState(emptyTimeForm);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSectionId, setAssignSectionId] = useState('');
  const [assignRows, setAssignRows] = useState<Array<{ subjectId: string; teacherId: string }>>([]);
  const [assignDefaultTeacherId, setAssignDefaultTeacherId] = useState('');
  const [assignSubjectFilter, setAssignSubjectFilter] = useState('');
  const [assignTeacherFilter, setAssignTeacherFilter] = useState('');
  const [classTeacherForm, setClassTeacherForm] = useState(emptyClassTeacherForm);
  const [routineClassId, setRoutineClassId] = useState('');
  const [routineSectionId, setRoutineSectionId] = useState('');
  const [routineRoomId, setRoutineRoomId] = useState('');
  const [teacherRoutineTeacherId, setTeacherRoutineTeacherId] = useState('');
  const [routineForm, setRoutineForm] = useState(emptyRoutineForm);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const canManageAcademicSetup = isSchoolAdmin || permissionCodes.includes('academics.setup');

  const openForm = (tabId: TabId) => setExpandedForms((prev) => ({ ...prev, [tabId]: true }));
  const closeForm = (tabId: TabId) => setExpandedForms((prev) => ({ ...prev, [tabId]: false }));
  const isFormOpen = (tabId: TabId, isEditing = false) => Boolean(expandedForms[tabId]) || isEditing;

  const classesQuery = useQuery({ queryKey: ['academic-setup-classes', search], queryFn: () => listSetupClasses({ search }), enabled: canManageAcademicSetup });
  const sectionsQuery = useQuery({ queryKey: ['academic-setup-sections', search], queryFn: () => listSetupSections({ search }), enabled: canManageAcademicSetup });
  const subjectsQuery = useQuery({ queryKey: ['academic-setup-subjects', search], queryFn: () => listSetupSubjects({ search }), enabled: canManageAcademicSetup });
  const roomsQuery = useQuery({ queryKey: ['academic-setup-rooms', search], queryFn: () => listClassRooms({ search }), enabled: canManageAcademicSetup });
  const allRoomsQuery = useQuery({ queryKey: ['academic-setup-rooms-all'], queryFn: () => listClassRooms(), enabled: canManageAcademicSetup });
  const periodsQuery = useQuery({ queryKey: ['academic-setup-time-periods'], queryFn: listTimePeriods, enabled: canManageAcademicSetup });
  const teachersQuery = useQuery({ queryKey: ['academic-setup-teachers'], queryFn: () => listTimetableTeachers(), enabled: canManageAcademicSetup });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: canManageAcademicSetup });
  const systemSettingsQuery = useQuery({
    queryKey: ['school-system-settings', session?.schoolId, 'academics-routine'],
    queryFn: () => getSchoolSystemSettings(),
    enabled: canManageAcademicSetup,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const assignedQuery = useQuery({
    queryKey: ['academic-setup-assign-subjects', assignClassId, assignSectionId],
    queryFn: () => listAssignSubjects({ classId: assignClassId, sectionId: assignSectionId }),
    enabled: canManageAcademicSetup && Boolean(assignClassId && assignSectionId),
  });
  const classTeachersQuery = useQuery({ queryKey: ['academic-setup-class-teachers'], queryFn: listClassTeachers, enabled: canManageAcademicSetup });
  const routinesQuery = useQuery({
    queryKey: ['academic-setup-routines', routineClassId, routineSectionId],
    queryFn: () => listClassRoutines({ classId: routineClassId, sectionId: routineSectionId }),
    enabled: canManageAcademicSetup && Boolean(routineClassId && routineSectionId),
  });
  const teacherRoutinesQuery = useQuery({
    queryKey: ['academic-setup-routines-teacher', teacherRoutineTeacherId],
    queryFn: () => listClassRoutines({ teacherId: teacherRoutineTeacherId }),
    enabled: canManageAcademicSetup && Boolean(teacherRoutineTeacherId),
  });
  const routineAssignmentsQuery = useQuery({
    queryKey: ['academic-setup-routine-assign-subjects', routineClassId, routineSectionId],
    queryFn: () => listAssignSubjects({ classId: routineClassId, sectionId: routineSectionId }),
    enabled: canManageAcademicSetup && Boolean(routineClassId && routineSectionId),
  });
  const weekendDayValues = useMemo(() => {
    const configuredWeekends = systemSettingsQuery.data?.weekends ?? [{ id: 'friday', name: 'Friday', isWeekend: true }];
    const weekendKeys = new Set(
      configuredWeekends
        .filter((day) => day.isWeekend)
        .flatMap((day) => [String(day.id ?? '').toLowerCase(), String(day.name ?? '').toLowerCase()]),
    );
    return new Set(dayOptions.filter((day) => weekendKeys.has(day.id) || weekendKeys.has(day.label.toLowerCase())).map((day) => day.value));
  }, [systemSettingsQuery.data?.weekends]);
  const workingDayOptions = useMemo(() => dayOptions.filter((day) => !weekendDayValues.has(day.value)), [weekendDayValues]);
  const weekendDayLabels = useMemo(() => dayOptions.filter((day) => weekendDayValues.has(day.value)).map((day) => day.label), [weekendDayValues]);

  const invalidateSetup = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['academic-setup-classes'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
      queryClient.invalidateQueries({ queryKey: ['fees'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-sections'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-subjects'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-rooms'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-time-periods'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-assign-subjects'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-class-teachers'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-routines'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-routines-teacher'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-setup-routine-assign-subjects'] }),
    ]);
  };

  const onSuccess = async (title: string, message?: string) => {
    notify.success(title, message);
    await invalidateSetup();
  };
  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const academicYearMutation = useMutation({
    mutationFn: () =>
      academicYearForm.id
        ? updateAcademicYear(academicYearForm.id, {
            name: academicYearForm.name,
            startDate: academicYearForm.startDate,
            endDate: academicYearForm.endDate,
            isActive: academicYearForm.isActive,
          })
        : createAcademicYear({
            name: academicYearForm.name,
            startDate: academicYearForm.startDate,
            endDate: academicYearForm.endDate,
            isActive: academicYearForm.isActive,
          }),
    onSuccess: () => {
      setAcademicYearForm(emptyAcademicYearForm);
      closeForm('academic-years');
      onSuccess('Academic year saved');
    },
    onError,
  });

  const academicYearBatchMutation = useMutation({
    mutationFn: async () => {
      const rows = academicYearBatchRows.map((row) => ({
        name: row.name.trim(),
        startDate: row.startDate,
        endDate: row.endDate,
        isActive: row.isActive,
      }));
      return Promise.all(rows.map((row) => createAcademicYear(row)));
    },
    onSuccess: async (items) => {
      setAcademicYearBatchRows([createAcademicYearBatchRow()]);
      closeForm('academic-years');
      await onSuccess('Academic years saved', `${items.length} academic year${items.length === 1 ? '' : 's'} created.`);
    },
    onError,
  });

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
      closeForm('classes');
      onSuccess('Class saved');
    },
    onError,
  });

  const classBatchMutation = useMutation({
    mutationFn: async () => {
      const rows = classBatchRows.map((row) => ({
        name: row.name.trim(),
        academicYearId: row.academicYearId || null,
        sectionIds: row.sectionIds,
      }));
      return Promise.all(rows.map((row) => createSetupClass(row)));
    },
    onSuccess: async (items) => {
      setClassBatchRows([createClassBatchRow()]);
      closeForm('classes');
      await onSuccess('Classes saved', `${items.length} class${items.length === 1 ? '' : 'es'} created.`);
    },
    onError,
  });

  const sectionMutation = useMutation({
    mutationFn: () => (sectionForm.id ? updateSetupSection(sectionForm.id, { name: sectionForm.name }) : createSetupSection({ name: sectionForm.name })),
    onSuccess: () => {
      setSectionForm(emptySectionForm);
      closeForm('sections');
      onSuccess('Section saved');
    },
    onError,
  });

  const sectionBatchMutation = useMutation({
    mutationFn: async () => {
      const rows = sectionBatchRows.map((row) => ({ name: row.name.trim() }));
      return Promise.all(rows.map((row) => createSetupSection(row)));
    },
    onSuccess: async (items) => {
      setSectionBatchRows([createSectionBatchRow()]);
      closeForm('sections');
      await onSuccess('Sections saved', `${items.length} section${items.length === 1 ? '' : 's'} created.`);
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
      closeForm('subjects');
      onSuccess('Subject saved');
    },
    onError,
  });

  const subjectBatchMutation = useMutation({
    mutationFn: async () => {
      const rows = subjectBatchRows.map((row) => ({
        name: row.name.trim(),
        code: row.code.trim() || null,
        type: row.type,
      }));
      return Promise.all(rows.map((row) => createSetupSubject(row)));
    },
    onSuccess: async (items) => {
      setSubjectBatchRows([createSubjectBatchRow()]);
      closeForm('subjects');
      await onSuccess('Subjects saved', `${items.length} subject${items.length === 1 ? '' : 's'} created.`);
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
    onSuccess: () => {
      setRoomForm(emptyRoomForm);
      closeForm('rooms');
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
      closeForm('times');
      onSuccess('Time period saved');
    },
    onError,
  });

  const seedPeriodsMutation = useMutation({
    mutationFn: seedDefaultTimePeriods,
    onSuccess: (result) => {
      const skipped = result.skippedCount ? ` ${result.skippedCount} skipped due to overlaps.` : '';
      onSuccess('Standard periods generated', `${result.createdCount} added, ${result.updatedCount} updated.${skipped}`);
    },
    onError,
  });

  const assignMutation = useMutation({
    mutationFn: () => saveAssignSubjects({ classId: assignClassId, sectionId: assignSectionId, replace: true, assignments: assignRows }),
    onSuccess: () => {
      closeForm('assign-subjects');
      onSuccess('Subject assignments saved');
    },
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
      closeForm('class-teachers');
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
      closeForm('routine');
      onSuccess('Routine saved');
    },
    onError,
  });

  const generateRoutineMutation = useMutation({
    mutationFn: () =>
      generateClassRoutine({
        classId: routineClassId,
        sectionId: routineSectionId,
        classRoomId: routineRoomId || null,
        days: workingDayOptions.map((day) => day.value),
      }),
    onSuccess: (result) => {
      const skipped = result.skippedCount ? ` ${result.skippedCount} slots skipped.` : '';
      onSuccess('Timetable generated', `${result.createdCount} routine cells created.${skipped}`);
    },
    onError,
  });

  useEffect(() => {
    setActiveTab(tabFromUrl);
    setSearch('');
  }, [tabFromUrl]);

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
  const classFormSectionIds = new Set(classForm.sectionIds);
  const teachers = teachersQuery.data ?? [];
  const classTeacherItems = classTeachersQuery.data ?? [];
  const classTeacherAssignedClassIds = useMemo(
    () => new Set(classTeacherItems.filter((item) => item.id !== classTeacherForm.id).map((item) => item.classId)),
    [classTeacherItems, classTeacherForm.id],
  );
  const classTeacherAssignedTeacherIds = useMemo(
    () => new Set(classTeacherItems.filter((item) => item.id !== classTeacherForm.id).map((item) => item.teacherId)),
    [classTeacherItems, classTeacherForm.id],
  );
  const availableClassTeacherClasses = useMemo(
    () => (classesQuery.data ?? []).filter((item) => item.id === classTeacherForm.classId || !classTeacherAssignedClassIds.has(item.id)),
    [classesQuery.data, classTeacherForm.classId, classTeacherAssignedClassIds],
  );
  const availableClassTeacherTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.id === classTeacherForm.teacherId || !classTeacherAssignedTeacherIds.has(teacher.id)),
    [teachers, classTeacherForm.teacherId, classTeacherAssignedTeacherIds],
  );
  const classTeacherSections = useMemo(() => sectionOptionsForClass(availableClassTeacherClasses, classTeacherForm.classId), [availableClassTeacherClasses, classTeacherForm.classId]);
  const subjects = subjectsQuery.data ?? [];
  const normalizedAssignSubjectFilter = assignSubjectFilter.trim().toLowerCase();
  const normalizedAssignTeacherFilter = assignTeacherFilter.trim().toLowerCase();
  const filteredAssignSubjects = useMemo(
    () =>
      normalizedAssignSubjectFilter
        ? subjects.filter((subject) =>
            [subject.name, subject.code].some((value) => String(value ?? '').toLowerCase().includes(normalizedAssignSubjectFilter)),
          )
        : subjects,
    [subjects, normalizedAssignSubjectFilter],
  );
  const filteredAssignTeachers = useMemo(
    () =>
      normalizedAssignTeacherFilter
        ? teachers.filter((teacher) =>
            [teacherName(teacher), teacher.employeeNo, teacher.user?.email].some((value) => String(value ?? '').toLowerCase().includes(normalizedAssignTeacherFilter)),
          )
        : teachers,
    [teachers, normalizedAssignTeacherFilter],
  );
  const selectedAssignSubjectIds = assignRows.map((row) => row.subjectId).filter(Boolean);
  const duplicateAssignSubjectCount = selectedAssignSubjectIds.length - new Set(selectedAssignSubjectIds).size;
  const completedAssignRows = assignRows.filter((row) => row.subjectId && row.teacherId).length;
  const periods = periodsQuery.data ?? [];
  const classPeriods = periods.filter((period) => period.type === 'CLASS_TIME');
  const rooms = roomsQuery.data ?? [];
  const allRooms = allRoomsQuery.data ?? rooms;
  const routines = routinesQuery.data ?? [];
  const routineByCell = useMemo(() => {
    const map = new Map<string, ClassRoutine>();
    routines.forEach((item) => map.set(`${item.dayOfWeek}:${item.timePeriodId}`, item));
    return map;
  }, [routines]);
  const routineAssignedSubjects = routineAssignmentsQuery.data ?? [];
  const teacherRoutines = teacherRoutinesQuery.data ?? [];
  const teacherRoutineByCell = useMemo(() => {
    const map = new Map<string, ClassRoutine>();
    teacherRoutines.forEach((item) => map.set(`${item.dayOfWeek}:${item.timePeriodId}`, item));
    return map;
  }, [teacherRoutines]);
  const academicYears = yearsQuery.data ?? [];
  const filteredAcademicYears = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return academicYears;
    return academicYears.filter((year: { name?: string; startDate?: string; endDate?: string }) =>
      [year.name, year.startDate, year.endDate].some((field) => String(field ?? '').toLowerCase().includes(value)),
    );
  }, [academicYears, search]);
  const hasDuplicateValues = (values: string[]) => {
    const normalized = values.map((value) => value.trim().toLowerCase()).filter(Boolean);
    return normalized.length !== new Set(normalized).size;
  };

  const validateAcademicYear = () => {
    if (academicYearForm.id) {
      if (!academicYearForm.name.trim()) return notify.error('Validation error', 'Academic year name is required.');
      if (!academicYearForm.startDate || !academicYearForm.endDate) return notify.error('Validation error', 'Start and end date are required.');
      if (academicYearForm.endDate <= academicYearForm.startDate) return notify.error('Validation error', 'End date must be after start date.');
      academicYearMutation.mutate();
      return;
    }
    if (!academicYearBatchRows.length) return notify.error('Validation error', 'Add at least one academic year.');
    if (academicYearBatchRows.some((row) => !row.name.trim())) return notify.error('Validation error', 'Academic year name is required for every row.');
    if (academicYearBatchRows.some((row) => !row.startDate || !row.endDate)) return notify.error('Validation error', 'Start and end date are required for every academic year.');
    if (academicYearBatchRows.some((row) => row.endDate <= row.startDate)) return notify.error('Validation error', 'Every end date must be after its start date.');
    if (hasDuplicateValues(academicYearBatchRows.map((row) => row.name))) return notify.error('Validation error', 'Remove duplicate academic year names before saving.');
    academicYearBatchMutation.mutate();
  };
  const validateClass = () => {
    if (classForm.id) {
      if (!classForm.name.trim()) return notify.error('Validation error', 'Class name is required.');
      classMutation.mutate();
      return;
    }
    if (!classBatchRows.length) return notify.error('Validation error', 'Add at least one class.');
    if (classBatchRows.some((row) => !row.name.trim())) return notify.error('Validation error', 'Class name is required for every row.');
    if (hasDuplicateValues(classBatchRows.map((row) => row.name))) return notify.error('Validation error', 'Remove duplicate class names before saving.');
    classBatchMutation.mutate();
  };
  const validateSection = () => {
    if (sectionForm.id) {
      if (!sectionForm.name.trim()) return notify.error('Validation error', 'Section name is required.');
      sectionMutation.mutate();
      return;
    }
    if (!sectionBatchRows.length) return notify.error('Validation error', 'Add at least one section.');
    if (sectionBatchRows.some((row) => !row.name.trim())) return notify.error('Validation error', 'Section name is required for every row.');
    if (hasDuplicateValues(sectionBatchRows.map((row) => row.name))) return notify.error('Validation error', 'Remove duplicate section names before saving.');
    sectionBatchMutation.mutate();
  };
  const validateSubject = () => {
    if (subjectForm.id) {
      if (!subjectForm.name.trim()) return notify.error('Validation error', 'Subject name is required.');
      if (!subjectForm.code.trim()) return notify.error('Validation error', 'Subject code is required.');
      subjectMutation.mutate();
      return;
    }
    if (!subjectBatchRows.length) return notify.error('Validation error', 'Add at least one subject.');
    if (subjectBatchRows.some((row) => !row.name.trim())) return notify.error('Validation error', 'Subject name is required for every row.');
    if (subjectBatchRows.some((row) => !row.code.trim())) return notify.error('Validation error', 'Subject code is required for every row.');
    if (hasDuplicateValues(subjectBatchRows.map((row) => row.name))) return notify.error('Validation error', 'Remove duplicate subject names before saving.');
    if (hasDuplicateValues(subjectBatchRows.map((row) => row.code))) return notify.error('Validation error', 'Remove duplicate subject codes before saving.');
    subjectBatchMutation.mutate();
  };
  const validateRoom = () => {
    const roomNumber = roomForm.roomNumber.trim().replace(/\s+/g, ' ');
    if (!roomNumber) return notify.error('Validation error', 'Room number is required.');
    if (!Number(roomForm.capacity) || Number(roomForm.capacity) < 1) return notify.error('Validation error', 'Capacity must be greater than 0.');
    const duplicate = allRooms.some((room) => room.id !== roomForm.id && room.roomNumber.trim().replace(/\s+/g, ' ').toLowerCase() === roomNumber.toLowerCase());
    if (duplicate) return notify.error('Validation error', `Class room ${roomNumber} already exists.`);
    roomMutation.mutate();
  };
  const validateTime = () => {
    if (!timeForm.name.trim()) return notify.error('Validation error', 'Period name is required.');
    if (!timeForm.startTime || !timeForm.endTime) return notify.error('Validation error', 'Start and end time are required.');
    if (timeForm.endTime <= timeForm.startTime) return notify.error('Validation error', 'End time must be after start time.');
    timeMutation.mutate();
  };
  const subjectOptionsForAssignRow = (selectedId: string) => {
    if (!selectedId || filteredAssignSubjects.some((subject) => subject.id === selectedId)) return filteredAssignSubjects;
    const selected = subjects.find((subject) => subject.id === selectedId);
    return selected ? [selected, ...filteredAssignSubjects] : filteredAssignSubjects;
  };
  const teacherOptionsForAssignRow = (selectedId: string) => {
    if (!selectedId || filteredAssignTeachers.some((teacher) => teacher.id === selectedId)) return filteredAssignTeachers;
    const selected = teachers.find((teacher) => teacher.id === selectedId);
    return selected ? [selected, ...filteredAssignTeachers] : filteredAssignTeachers;
  };
  const loadSubjectsForAssignment = () => {
    if (!assignClassId || !assignSectionId) return notify.error('Validation error', 'Select class and section first.');
    const sourceSubjects = subjects;
    if (!sourceSubjects.length) return notify.error('Validation error', 'Add subjects before loading assignment rows.');
    const currentBySubject = new Map(assignRows.filter((row) => row.subjectId).map((row) => [row.subjectId, row.teacherId]));
    const existingBySubject = new Map((assignedQuery.data ?? []).map((item) => [item.subjectId, item.teacherId]));
    setAssignRows(
      sourceSubjects.map((subject, index) => ({
        subjectId: subject.id,
        teacherId:
          currentBySubject.get(subject.id) ||
          existingBySubject.get(subject.id) ||
          assignDefaultTeacherId ||
          teachers[index % Math.max(teachers.length, 1)]?.id ||
          '',
      })),
    );
    openForm('assign-subjects');
  };
  const applyDefaultTeacherToAssignments = () => {
    if (!assignDefaultTeacherId) return notify.error('Validation error', 'Select a default teacher first.');
    setAssignRows((rows) => rows.map((row) => ({ ...row, teacherId: assignDefaultTeacherId })));
  };
  const balanceAssignmentTeachers = () => {
    if (!teachers.length) return notify.error('Validation error', 'Add teachers before balancing assignments.');
    setAssignRows((rows) => rows.map((row, index) => ({ ...row, teacherId: teachers[index % teachers.length]?.id ?? row.teacherId })));
  };
  const clearAssignmentRows = () => setAssignRows([]);
  const validateAssign = () => {
    if (!assignClassId || !assignSectionId) return notify.error('Validation error', 'Select class and section first.');
    if (!assignRows.length) return notify.error('Validation error', 'Add at least one subject row.');
    if (assignRows.some((row) => !row.subjectId || !row.teacherId)) return notify.error('Validation error', 'Select subject and teacher for each row.');
    if (duplicateAssignSubjectCount > 0) return notify.error('Validation error', 'Remove duplicate subjects before saving.');
    assignMutation.mutate();
  };
  const validateClassTeacher = () => {
    if (!classTeacherForm.classId || !classTeacherForm.sectionId || !classTeacherForm.teacherId) {
      return notify.error('Validation error', 'Select class, section, and teacher.');
    }
    if (classTeacherAssignedClassIds.has(classTeacherForm.classId)) {
      return notify.error('Validation error', 'This class already has a class teacher.');
    }
    if (classTeacherAssignedTeacherIds.has(classTeacherForm.teacherId)) {
      return notify.error('Validation error', 'This teacher is already assigned to another class.');
    }
    classTeacherMutation.mutate();
  };
  const validateRoutine = () => {
    if (!routineForm.classId || !routineForm.sectionId || !routineForm.dayOfWeek || !routineForm.timePeriodId || !routineForm.subjectId || !routineForm.teacherId) {
      return notify.error('Validation error', 'Select class, section, day, period, subject, and teacher.');
    }
    if (weekendDayValues.has(routineForm.dayOfWeek)) return notify.error('Validation error', 'Selected day is configured as weekend in settings.');
    routineMutation.mutate();
  };
  const validateGenerateRoutine = () => {
    if (!routineClassId || !routineSectionId) return notify.error('Validation error', 'Select class and section first.');
    if (!classPeriods.length) return notify.error('Validation error', 'Generate or add class time periods first.');
    if (!routineAssignedSubjects.length) return notify.error('Validation error', 'Assign subjects with teachers before generating timetable.');
    if (!workingDayOptions.length) return notify.error('Validation error', 'All days are configured as weekend in settings.');
    generateRoutineMutation.mutate();
  };

  const confirmDelete = (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    action()
      .then(() => onSuccess('Deleted successfully'))
      .catch(onError);
  };

  const selectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearch('');
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`/dashboard/academics?${params.toString()}`, { scroll: false });
  };

  if (sessionLoading) {
    return <LoadingSkeleton />;
  }

  if (!canManageAcademicSetup) {
    return (
      <div>
        <PageHeader title="Academic Setup" subtitle="Academic setup access is controlled by Role Permissions." />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
          Academic setup is not enabled for your role. Ask a School Admin to enable Academic Setup from Role Permissions.
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academic Setup"
        subtitle="Configure academic years, classes, sections, subjects, subject assignments, and class teacher ownership."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Academics' },
          { label: tabs.find((tab) => tab.id === activeTab)?.label ?? 'Setup' },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <AcademicSideMenu activeTab={activeTab} onSelect={selectTab} />

        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <AcademicIcon name={tabs.find((tab) => tab.id === activeTab)?.icon ?? 'grid'} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Academic Module</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{tabs.find((tab) => tab.id === activeTab)?.label ?? 'Setup'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{tabs.find((tab) => tab.id === activeTab)?.description}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700">
                <AcademicIcon name="grid" className="h-3.5 w-3.5" />
                {tabs.findIndex((tab) => tab.id === activeTab) + 1} of {tabs.length}
              </span>
            </div>
          </section>

      {activeTab === 'academic-years' ? (
        <SimpleCrudLayout
          title={academicYearForm.id ? 'Edit Academic Year' : 'Add Academic Years'}
          listTitle="Academic Year List"
          isLoading={yearsQuery.isLoading}
          emptyMessage="No academic years found."
          actionLabel="Add Academic Year"
          isFormOpen={isFormOpen('academic-years', Boolean(academicYearForm.id))}
          onOpenForm={() => {
            setAcademicYearForm(emptyAcademicYearForm);
            setAcademicYearBatchRows((rows) => (rows.length ? rows : [createAcademicYearBatchRow()]));
            openForm('academic-years');
          }}
          onCloseForm={() => {
            setAcademicYearForm(emptyAcademicYearForm);
            setAcademicYearBatchRows([createAcademicYearBatchRow()]);
            closeForm('academic-years');
          }}
          search={search}
          setSearch={setSearch}
          form={
            academicYearForm.id ? (
              <>
                <Field label="Academic year">
                  <input
                    className={inputClass}
                    value={academicYearForm.name}
                    onChange={(e) => setAcademicYearForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Example: 2026 Year"
                  />
                </Field>
                <Field label="Starting date">
                  <input
                    type="date"
                    className={inputClass}
                    value={academicYearForm.startDate}
                    onChange={(e) => setAcademicYearForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </Field>
                <Field label="Ending date">
                  <input
                    type="date"
                    className={inputClass}
                    value={academicYearForm.endDate}
                    onChange={(e) => setAcademicYearForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={academicYearForm.isActive}
                    onChange={(e) => setAcademicYearForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active academic year
                </label>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  {academicYearBatchRows.map((row, index) => (
                    <div key={row.rowId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900">Academic Year {index + 1}</h3>
                        {academicYearBatchRows.length > 1 ? (
                          <IconButton
                            icon="trash"
                            label="Remove academic year"
                            variant="danger"
                            size="sm"
                            onClick={() => setAcademicYearBatchRows((rows) => rows.filter((item) => item.rowId !== row.rowId))}
                          />
                        ) : null}
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem]">
                        <Field label="Academic year">
                          <input
                            className={inputClass}
                            value={row.name}
                            onChange={(e) => setAcademicYearBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, name: e.target.value } : item))}
                            placeholder="Example: 2027-2028"
                          />
                        </Field>
                        <Field label="Starting date">
                          <input
                            type="date"
                            className={inputClass}
                            value={row.startDate}
                            onChange={(e) => setAcademicYearBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, startDate: e.target.value } : item))}
                          />
                        </Field>
                        <Field label="Ending date">
                          <input
                            type="date"
                            className={inputClass}
                            value={row.endDate}
                            onChange={(e) => setAcademicYearBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, endDate: e.target.value } : item))}
                          />
                        </Field>
                      </div>
                      <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(e) => setAcademicYearBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, isActive: e.target.checked } : item))}
                        />
                        Active academic year
                      </label>
                    </div>
                  ))}
                </div>
                <IconButton icon="plus" label="Add another academic year" variant="primary" onClick={() => setAcademicYearBatchRows((rows) => [...rows, createAcademicYearBatchRow()])} />
              </>
            )
          }
          footer={
            <div className="flex gap-2">
              <PrimaryButton icon={academicYearForm.id ? 'save' : 'plus'} disabled={academicYearMutation.isPending || academicYearBatchMutation.isPending} onClick={validateAcademicYear}>
                {academicYearForm.id ? 'Update Year' : `Save ${academicYearBatchRows.length} Year${academicYearBatchRows.length === 1 ? '' : 's'}`}
              </PrimaryButton>
              {academicYearForm.id ? (
                <SecondaryButton icon="x" onClick={() => {
                  setAcademicYearForm(emptyAcademicYearForm);
                  closeForm('academic-years');
                }}>
                  Cancel
                </SecondaryButton>
              ) : null}
            </div>
          }
          table={
            <AcademicYearTable
              items={filteredAcademicYears}
              onEdit={(year) => {
                setAcademicYearForm({
                  id: year.id,
                  name: year.name,
                  startDate: year.startDate?.slice(0, 10) ?? '',
                  endDate: year.endDate?.slice(0, 10) ?? '',
                  isActive: Boolean(year.isActive),
                });
                openForm('academic-years');
              }}
              onDelete={(year) => confirmDelete(`Delete academic year "${year.name}"?`, () => deleteAcademicYear(year.id))}
            />
          }
        />
      ) : null}

      {activeTab === 'classes' ? (
        <div className="space-y-5">
          <FormCard
            title={classForm.id ? 'Edit Class' : 'Add Classes'}
            actionLabel="Add Class"
            isOpen={isFormOpen('classes', Boolean(classForm.id))}
            onOpen={() => {
              setClassForm(emptyClassForm);
              setClassBatchRows((rows) => (rows.length ? rows : [createClassBatchRow()]));
              openForm('classes');
            }}
            onClose={() => {
              setClassForm(emptyClassForm);
              setClassBatchRows([createClassBatchRow()]);
              closeForm('classes');
            }}
          >
            {classForm.id ? (
              <>
                <Field label="Class name">
                  <input className={inputClass} value={classForm.name} onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: Grade 10" />
                </Field>
                <Field label="Academic year">
                  <select className={inputClass} value={classForm.academicYearId} onChange={(e) => setClassForm((p) => ({ ...p, academicYearId: e.target.value }))}>
                    <option value="">Select academic year</option>
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
              </>
            ) : (
              <>
                <div className="space-y-3">
                  {classBatchRows.map((row, index) => {
                    const rowSectionIds = new Set(row.sectionIds);
                    return (
                      <div key={row.rowId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-bold text-slate-900">Class {index + 1}</h3>
                          {classBatchRows.length > 1 ? (
                            <IconButton icon="trash" label="Remove class" variant="danger" size="sm" onClick={() => setClassBatchRows((rows) => rows.filter((item) => item.rowId !== row.rowId))} />
                          ) : null}
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <Field label="Class name">
                            <input className={inputClass} value={row.name} onChange={(e) => setClassBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, name: e.target.value } : item))} placeholder="Example: Class 1" />
                          </Field>
                          <Field label="Academic year">
                            <select className={inputClass} value={row.academicYearId} onChange={(e) => setClassBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, academicYearId: e.target.value } : item))}>
                              <option value="">Select academic year</option>
                              {(yearsQuery.data ?? []).map((year: { id: string; name: string }) => <option key={year.id} value={year.id}>{year.name}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="mt-3">
                          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Sections</span>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            {(sectionsQuery.data ?? []).map((section) => (
                              <label key={section.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={rowSectionIds.has(section.id)}
                                  onChange={(event) =>
                                    setClassBatchRows((rows) =>
                                      rows.map((item) =>
                                        item.rowId === row.rowId
                                          ? {
                                              ...item,
                                              sectionIds: event.target.checked
                                                ? [...item.sectionIds, section.id]
                                                : item.sectionIds.filter((id) => id !== section.id),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                                {section.name}
                              </label>
                            ))}
                          </div>
                          {!sectionsQuery.data?.length ? <p className="mt-2 text-xs text-slate-500">Create sections first, then link them to classes.</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <IconButton icon="plus" label="Add another class" variant="primary" onClick={() => setClassBatchRows((rows) => [...rows, createClassBatchRow()])} />
              </>
            )}
            <div className="flex gap-2">
              <PrimaryButton icon={classForm.id ? 'save' : 'plus'} disabled={classMutation.isPending || classBatchMutation.isPending} onClick={validateClass}>
                {classForm.id ? 'Update Class' : `Save ${classBatchRows.length} Class${classBatchRows.length === 1 ? '' : 'es'}`}
              </PrimaryButton>
              {classForm.id ? <SecondaryButton icon="x" onClick={() => {
                setClassForm(emptyClassForm);
                closeForm('classes');
              }}>Cancel</SecondaryButton> : null}
            </div>
          </FormCard>

          <ListCard title="Class List" search={search} setSearch={setSearch}>
            {classesQuery.isLoading ? (
              <LoadingSkeleton />
            ) : (
              <ClassTable
                items={classesQuery.data ?? []}
                onEdit={(item) => {
                  setClassForm({
                    id: item.id,
                    name: item.name,
                    academicYearId: item.academicYearId ?? '',
                    sectionIds: item.classSections?.map((link) => link.sectionId) ?? [],
                  });
                  openForm('classes');
                }}
                onDelete={(item) => confirmDelete(`Delete class "${item.name}"?`, () => deleteSetupClass(item.id))}
              />
            )}
          </ListCard>
        </div>
      ) : null}

      {activeTab === 'sections' ? (
        <SimpleCrudLayout
          title={sectionForm.id ? 'Edit Section' : 'Add Sections'}
          listTitle="Section List"
          isLoading={sectionsQuery.isLoading}
          emptyMessage="No sections found."
          actionLabel="Add Section"
          isFormOpen={isFormOpen('sections', Boolean(sectionForm.id))}
          onOpenForm={() => {
            setSectionForm(emptySectionForm);
            setSectionBatchRows((rows) => (rows.length ? rows : [createSectionBatchRow()]));
            openForm('sections');
          }}
          onCloseForm={() => {
            setSectionForm(emptySectionForm);
            setSectionBatchRows([createSectionBatchRow()]);
            closeForm('sections');
          }}
          search={search}
          setSearch={setSearch}
          form={
            sectionForm.id ? (
              <Field label="Section name">
                <input className={inputClass} value={sectionForm.name} onChange={(e) => setSectionForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: A" />
              </Field>
            ) : (
              <>
                <div className="space-y-3">
                  {sectionBatchRows.map((row, index) => (
                    <div key={row.rowId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900">Section {index + 1}</h3>
                        {sectionBatchRows.length > 1 ? (
                          <IconButton icon="trash" label="Remove section" variant="danger" size="sm" onClick={() => setSectionBatchRows((rows) => rows.filter((item) => item.rowId !== row.rowId))} />
                        ) : null}
                      </div>
                      <Field label="Section name">
                        <input className={inputClass} value={row.name} onChange={(e) => setSectionBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, name: e.target.value } : item))} placeholder="Example: A" />
                      </Field>
                    </div>
                  ))}
                </div>
                <IconButton icon="plus" label="Add another section" variant="primary" onClick={() => setSectionBatchRows((rows) => [...rows, createSectionBatchRow()])} />
              </>
            )
          }
          footer={
            <div className="flex gap-2">
              <PrimaryButton icon={sectionForm.id ? 'save' : 'plus'} disabled={sectionMutation.isPending || sectionBatchMutation.isPending} onClick={validateSection}>
                {sectionForm.id ? 'Update Section' : `Save ${sectionBatchRows.length} Section${sectionBatchRows.length === 1 ? '' : 's'}`}
              </PrimaryButton>
              {sectionForm.id ? <SecondaryButton icon="x" onClick={() => {
                setSectionForm(emptySectionForm);
                closeForm('sections');
              }}>Cancel</SecondaryButton> : null}
            </div>
          }
          table={<SectionTable items={sectionsQuery.data ?? []} onEdit={(item) => {
            setSectionForm({ id: item.id, name: item.name });
            openForm('sections');
          }} onDelete={(item) => confirmDelete(`Delete section "${item.name}"?`, () => deleteSetupSection(item.id))} />}
        />
      ) : null}

      {activeTab === 'subjects' ? (
        <SimpleCrudLayout
          title={subjectForm.id ? 'Edit Subject' : 'Add Subjects'}
          listTitle="Subject List"
          isLoading={subjectsQuery.isLoading}
          emptyMessage="No subjects found."
          actionLabel="Add Subject"
          isFormOpen={isFormOpen('subjects', Boolean(subjectForm.id))}
          onOpenForm={() => {
            setSubjectForm(emptySubjectForm);
            setSubjectBatchRows((rows) => (rows.length ? rows : [createSubjectBatchRow()]));
            openForm('subjects');
          }}
          onCloseForm={() => {
            setSubjectForm(emptySubjectForm);
            setSubjectBatchRows([createSubjectBatchRow()]);
            closeForm('subjects');
          }}
          search={search}
          setSearch={setSearch}
          form={
            subjectForm.id ? (
              <>
                <Field label="Subject name"><input className={inputClass} value={subjectForm.name} onChange={(e) => setSubjectForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example: Mathematics" /></Field>
                <Field label="Subject code"><input className={inputClass} value={subjectForm.code} onChange={(e) => setSubjectForm((p) => ({ ...p, code: e.target.value }))} placeholder="Example: MATH10" /></Field>
                <Field label="Subject type">
                  <select className={inputClass} value={subjectForm.type} onChange={(e) => setSubjectForm((p) => ({ ...p, type: e.target.value as SubjectType }))}>
                    <option value="THEORY">Theory</option>
                    <option value="PRACTICAL">Practical</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  {subjectBatchRows.map((row, index) => (
                    <div key={row.rowId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900">Subject {index + 1}</h3>
                        {subjectBatchRows.length > 1 ? (
                          <IconButton icon="trash" label="Remove subject" variant="danger" size="sm" onClick={() => setSubjectBatchRows((rows) => rows.filter((item) => item.rowId !== row.rowId))} />
                        ) : null}
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[1fr_14rem_12rem]">
                        <Field label="Subject name">
                          <input className={inputClass} value={row.name} onChange={(e) => setSubjectBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, name: e.target.value } : item))} placeholder="Example: Mathematics" />
                        </Field>
                        <Field label="Subject code">
                          <input className={inputClass} value={row.code} onChange={(e) => setSubjectBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, code: e.target.value } : item))} placeholder="Example: MATH10" />
                        </Field>
                        <Field label="Subject type">
                          <select className={inputClass} value={row.type} onChange={(e) => setSubjectBatchRows((rows) => rows.map((item) => item.rowId === row.rowId ? { ...item, type: e.target.value as SubjectType } : item))}>
                            <option value="THEORY">Theory</option>
                            <option value="PRACTICAL">Practical</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
                <IconButton icon="plus" label="Add another subject" variant="primary" onClick={() => setSubjectBatchRows((rows) => [...rows, createSubjectBatchRow()])} />
              </>
            )
          }
          footer={
            <div className="flex gap-2">
              <PrimaryButton icon={subjectForm.id ? 'save' : 'plus'} disabled={subjectMutation.isPending || subjectBatchMutation.isPending} onClick={validateSubject}>
                {subjectForm.id ? 'Update Subject' : `Save ${subjectBatchRows.length} Subject${subjectBatchRows.length === 1 ? '' : 's'}`}
              </PrimaryButton>
              {subjectForm.id ? <SecondaryButton icon="x" onClick={() => {
                setSubjectForm(emptySubjectForm);
                closeForm('subjects');
              }}>Cancel</SecondaryButton> : null}
            </div>
          }
          table={<SubjectTable items={subjectsQuery.data ?? []} onEdit={(item) => {
            setSubjectForm({ id: item.id, name: item.name, code: item.code ?? '', type: item.type });
            openForm('subjects');
          }} onDelete={(item) => confirmDelete(`Delete subject "${item.name}"?`, () => deleteSetupSubject(item.id))} />}
        />
      ) : null}

      {activeTab === 'holidays' ? (
        <SystemSetupTab section="holidays" showOverview={false} showSectionMenu={false} />
      ) : null}

      {activeTab === 'rooms' ? (
        <SimpleCrudLayout
          title={roomForm.id ? 'Edit Class Room' : 'Add Class Room'}
          listTitle="Room List"
          isLoading={roomsQuery.isLoading}
          emptyMessage="No rooms found."
          actionLabel="Add Class Room"
          isFormOpen={isFormOpen('rooms', Boolean(roomForm.id))}
          onOpenForm={() => {
            setRoomForm(emptyRoomForm);
            openForm('rooms');
          }}
          onCloseForm={() => {
            setRoomForm(emptyRoomForm);
            closeForm('rooms');
          }}
          search={search}
          setSearch={setSearch}
          form={
            <>
              <Field label="Room number"><input className={inputClass} value={roomForm.roomNumber} onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))} placeholder="Example: 201" /></Field>
              <Field label="Capacity"><input className={inputClass} type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: e.target.value }))} /></Field>
              <div className="flex gap-2">
                <PrimaryButton icon={roomForm.id ? 'save' : 'plus'} disabled={roomMutation.isPending} onClick={validateRoom}>{roomForm.id ? 'Update Room' : 'Add Room'}</PrimaryButton>
                {roomForm.id ? <SecondaryButton icon="x" onClick={() => {
                  setRoomForm(emptyRoomForm);
                  closeForm('rooms');
                }}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={<RoomTable items={roomsQuery.data ?? []} onEdit={(item) => {
            setRoomForm({ id: item.id, roomNumber: item.roomNumber, capacity: String(item.capacity) });
            openForm('rooms');
          }} onDelete={(item) => confirmDelete(`Delete room "${item.roomNumber}"?`, () => deleteClassRoom(item.id))} />}
        />
      ) : null}

      {activeTab === 'times' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-purple-700">Auto setup</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Generate Standard School Day</h2>
                <p className="mt-1 text-sm text-slate-500">Loads class periods and break slots used by the timetable generator.</p>
              </div>
              <PrimaryButton icon="sparkles" disabled={seedPeriodsMutation.isPending} onClick={() => seedPeriodsMutation.mutate()}>
                Generate Periods
              </PrimaryButton>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {defaultPeriodPreview.map((period) => (
                <div key={period.name} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{period.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${period.type === 'Break' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>{period.type}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{period.time}</p>
                </div>
              ))}
            </div>
          </section>
          <SimpleCrudLayout
            title={timeForm.id ? 'Edit Time / Period' : 'Add Time / Period'}
            listTitle="Time List"
            isLoading={periodsQuery.isLoading}
            emptyMessage="No time periods found."
            actionLabel="Add Time / Period"
            isFormOpen={isFormOpen('times', Boolean(timeForm.id))}
            onOpenForm={() => {
              setTimeForm(emptyTimeForm);
              openForm('times');
            }}
            onCloseForm={() => {
              setTimeForm(emptyTimeForm);
              closeForm('times');
            }}
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
                  <PrimaryButton icon={timeForm.id ? 'save' : 'plus'} disabled={timeMutation.isPending} onClick={validateTime}>{timeForm.id ? 'Update Time' : 'Add Time'}</PrimaryButton>
                  {timeForm.id ? <SecondaryButton icon="x" onClick={() => {
                    setTimeForm(emptyTimeForm);
                    closeForm('times');
                  }}>Cancel</SecondaryButton> : null}
                </div>
              </>
            }
            table={<TimeTable items={periodsQuery.data ?? []} onEdit={(item) => {
              setTimeForm({ id: item.id, type: item.type, name: item.name, startTime: item.startTime, endTime: item.endTime });
              openForm('times');
            }} onDelete={(item) => confirmDelete(`Delete time period "${item.name}"?`, () => deleteTimePeriod(item.id))} />}
          />
        </div>
      ) : null}

      {activeTab === 'assign-subjects' ? (
        <div className="space-y-5">
          <FormCard
            title="Assign Multiple Subjects"
            actionLabel="Assign Subjects"
            isOpen={isFormOpen('assign-subjects')}
            onOpen={() => {
              setAssignRows((rows) => (rows.length ? rows : [{ subjectId: '', teacherId: '' }]));
              openForm('assign-subjects');
            }}
            onClose={() => closeForm('assign-subjects')}
          >
            <ClassSectionPicker
              classes={classesQuery.data ?? []}
              classId={assignClassId}
              sectionId={assignSectionId}
              onClassChange={setAssignClassId}
              onSectionChange={setAssignSectionId}
              sectionOptions={assignedSections}
            />
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[1fr_1fr_1.1fr]">
              <Field label="Find subject">
                <input className={inputClass} value={assignSubjectFilter} onChange={(e) => setAssignSubjectFilter(e.target.value)} placeholder="Search by name or code" />
              </Field>
              <Field label="Find teacher">
                <input className={inputClass} value={assignTeacherFilter} onChange={(e) => setAssignTeacherFilter(e.target.value)} placeholder="Search by name, ID, email" />
              </Field>
              <Field label="Default teacher">
                <select className={inputClass} value={assignDefaultTeacherId} onChange={(e) => setAssignDefaultTeacherId(e.target.value)}>
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}{teacher.employeeNo ? ` (${teacher.employeeNo})` : ''}</option>)}
                </select>
              </Field>
              <div className="flex flex-wrap gap-2 xl:col-span-3">
                <SecondaryButton icon="plus" onClick={loadSubjectsForAssignment} disabled={!subjects.length}>Load All Subjects</SecondaryButton>
                <SecondaryButton icon="teacher" onClick={applyDefaultTeacherToAssignments} disabled={!assignRows.length}>Apply Teacher</SecondaryButton>
                <SecondaryButton icon="shuffle" onClick={balanceAssignmentTeachers} disabled={!assignRows.length || !teachers.length}>Balance Teachers</SecondaryButton>
                <SecondaryButton icon="x" onClick={clearAssignmentRows} disabled={!assignRows.length}>Clear</SecondaryButton>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Subjects</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{selectedAssignSubjectIds.length}/{subjects.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Ready rows</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{completedAssignRows}/{assignRows.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Teachers</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{teachers.length}</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${duplicateAssignSubjectCount ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                <p className={`text-xs font-bold uppercase ${duplicateAssignSubjectCount ? 'text-red-600' : 'text-slate-500'}`}>Duplicates</p>
                <p className={`mt-1 text-lg font-bold ${duplicateAssignSubjectCount ? 'text-red-700' : 'text-slate-950'}`}>{duplicateAssignSubjectCount}</p>
              </div>
            </div>
            <div className="space-y-2">
              {assignRows.length ? (
                <div className="hidden rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[3rem_1fr_1fr_3rem] lg:gap-3">
                  <span>No.</span>
                  <span>Subject</span>
                  <span>Teacher</span>
                  <span className="text-right">Action</span>
                </div>
              ) : null}
              {assignRows.map((row, index) => {
                const isDuplicate = Boolean(row.subjectId && assignRows.filter((item) => item.subjectId === row.subjectId).length > 1);
                const rowSubjectOptions = subjectOptionsForAssignRow(row.subjectId);
                const rowTeacherOptions = teacherOptionsForAssignRow(row.teacherId);
                return (
                  <div key={index} className={`grid gap-2 rounded-xl border p-3 lg:grid-cols-[3rem_1fr_1fr_3rem] lg:items-start ${isDuplicate ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex h-11 items-center text-sm font-bold text-slate-500">#{index + 1}</div>
                    <div>
                      <select className={inputClass} value={row.subjectId} onChange={(e) => setAssignRows((rows) => rows.map((item, idx) => idx === index ? { ...item, subjectId: e.target.value } : item))}>
                        <option value="">Select subject</option>
                        {rowSubjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}
                      </select>
                      {isDuplicate ? <p className="mt-1 text-xs font-semibold text-red-600">Duplicate subject selected</p> : null}
                    </div>
                    <select className={inputClass} value={row.teacherId} onChange={(e) => setAssignRows((rows) => rows.map((item, idx) => idx === index ? { ...item, teacherId: e.target.value } : item))}>
                      <option value="">Select teacher</option>
                      {rowTeacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}{teacher.employeeNo ? ` (${teacher.employeeNo})` : ''}</option>)}
                    </select>
                    <div className="flex justify-end">
                      <IconButton icon="trash" label="Remove row" variant="danger" onClick={() => setAssignRows((rows) => rows.filter((_, idx) => idx !== index))} />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <IconButton icon="plus" label="Add subject row" variant="primary" onClick={() => setAssignRows((rows) => [...rows, { subjectId: '', teacherId: assignDefaultTeacherId }])} />
              </div>
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
        <div className="space-y-5">
          <FormCard
            title={classTeacherForm.id ? 'Edit Class Teacher' : 'Assign Class Teacher'}
            actionLabel="Assign Class Teacher"
            isOpen={isFormOpen('class-teachers', Boolean(classTeacherForm.id))}
            onOpen={() => {
              setClassTeacherForm(emptyClassTeacherForm);
              openForm('class-teachers');
            }}
            onClose={() => {
              setClassTeacherForm(emptyClassTeacherForm);
              closeForm('class-teachers');
            }}
          >
            <ClassSectionPicker
              classes={availableClassTeacherClasses}
              classId={classTeacherForm.classId}
              sectionId={classTeacherForm.sectionId}
              onClassChange={(value) => setClassTeacherForm((p) => ({ ...p, classId: value, sectionId: '' }))}
              onSectionChange={(value) => setClassTeacherForm((p) => ({ ...p, sectionId: value }))}
              sectionOptions={classTeacherSections}
            />
            <Field label="Teacher">
              <select className={inputClass} value={classTeacherForm.teacherId} onChange={(e) => setClassTeacherForm((p) => ({ ...p, teacherId: e.target.value }))}>
                <option value="">Select teacher</option>
                {availableClassTeacherTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
              </select>
            </Field>
            <div className="flex gap-2">
              <PrimaryButton disabled={classTeacherMutation.isPending} onClick={validateClassTeacher}>Save Class Teacher</PrimaryButton>
              {classTeacherForm.id ? <SecondaryButton icon="x" onClick={() => {
                setClassTeacherForm(emptyClassTeacherForm);
                closeForm('class-teachers');
              }}>Cancel</SecondaryButton> : null}
            </div>
          </FormCard>
          <ListCard title="Class Teacher List">
            {classTeachersQuery.isLoading ? <LoadingSkeleton /> : !(classTeachersQuery.data ?? []).length ? <EmptyState message="No class teacher assignments found." /> : (
              <ClassTeacherTable
                items={classTeachersQuery.data ?? []}
                onEdit={(item) => {
                  setClassTeacherForm({ id: item.id, classId: item.classId, sectionId: item.sectionId, teacherId: item.teacherId });
                  openForm('class-teachers');
                }}
                onDelete={(item) => confirmDelete(`Delete class teacher assignment for ${item.class?.name}-${item.section?.name}?`, () => deleteClassTeacher(item.id))}
              />
            )}
          </ListCard>
        </div>
      ) : null}

      {activeTab === 'routine' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ClassSectionPicker
                classes={classesQuery.data ?? []}
                classId={routineClassId}
                sectionId={routineSectionId}
                onClassChange={setRoutineClassId}
                onSectionChange={setRoutineSectionId}
                sectionOptions={routineSections}
              />
              <Field label="Default room">
                <select className={inputClass} value={routineRoomId} onChange={(e) => setRoutineRoomId(e.target.value)}>
                  <option value="">No room</option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} ({room.capacity})</option>)}
                </select>
              </Field>
              <div className="flex items-end">
                <PrimaryButton icon="sparkles" disabled={generateRoutineMutation.isPending || !routineClassId || !routineSectionId} onClick={validateGenerateRoutine}>
                  Auto Generate
                </PrimaryButton>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Class periods</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{classPeriods.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Working days</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{workingDayOptions.length}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={weekendDayLabels.join(', ') || 'None'}>
                  Weekend: {weekendDayLabels.join(', ') || 'None'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Assigned teachers</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{new Set(routineAssignedSubjects.map((item) => item.teacherId)).size}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Existing routine cells</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{routines.length}</p>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            <FormCard
              title={routineForm.id ? 'Edit Routine Cell' : 'Create Routine Cell'}
              actionLabel="Create Routine Cell"
              isOpen={isFormOpen('routine', Boolean(routineForm.id))}
              onOpen={() => {
                setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId });
                openForm('routine');
              }}
              onClose={() => {
                setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId });
                closeForm('routine');
              }}
            >
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
                {routineForm.id ? <SecondaryButton icon="x" onClick={() => {
                  setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId });
                  closeForm('routine');
                }}>Cancel</SecondaryButton> : null}
              </div>
              {!routineAssignedSubjects.length ? <p className="text-xs text-amber-700">Assign subjects to this class-section before creating routine cells.</p> : null}
            </FormCard>

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
                            const isWeekend = weekendDayValues.has(day.value);
                            const isBreak = period.type === 'BREAK';
                            return (
                              <td key={`${day.value}-${period.id}`} className="h-24 border-b border-r border-slate-200 px-3 py-2 align-top">
                                {isBreak ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Break</span>
                                ) : cell ? (
                                  <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50 p-2">
                                    <div className="font-semibold text-purple-950">{cell.subject?.name}</div>
                                    <div className="text-xs text-purple-700">{teacherName(cell.teacher)}</div>
                                    <div className="text-xs text-purple-700">{cell.classRoom?.roomNumber ? `Room ${cell.classRoom.roomNumber}` : 'No room'}</div>
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        aria-label="Edit routine"
                                        title="Edit routine"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-700 shadow-sm transition hover:bg-purple-50"
                                        onClick={() => {
                                          setRoutineForm({ id: cell.id, classId: cell.classId, sectionId: cell.sectionId, dayOfWeek: cell.dayOfWeek, timePeriodId: cell.timePeriodId, subjectId: cell.subjectId, teacherId: cell.teacherId, classRoomId: cell.classRoomId ?? '' });
                                          openForm('routine');
                                        }}
                                      >
                                        <AcademicIcon name="edit" className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="Delete routine"
                                        title="Delete routine"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                                        onClick={() => confirmDelete('Delete this routine cell?', () => deleteClassRoutine(cell.id))}
                                      >
                                      <AcademicIcon name="trash" className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : isWeekend ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Weekend</span>
                                ) : (
                                  <button
                                    className="flex h-full min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-purple-600 hover:border-purple-300 hover:bg-purple-50"
                                    onClick={() => {
                                      setRoutineForm({ ...emptyRoutineForm, classId: routineClassId, sectionId: routineSectionId, dayOfWeek: day.value, timePeriodId: period.id });
                                      openForm('routine');
                                    }}
                                  >
                                    <AcademicIcon name="plus" className="h-5 w-5" />
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Teacher Timetable</h2>
                  <p className="mt-1 text-sm text-slate-500">Generated and manual routine cells appear here by teacher.</p>
                </div>
                <label className="w-full lg:max-w-xs">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Teacher</span>
                  <select className={inputClass} value={teacherRoutineTeacherId} onChange={(e) => setTeacherRoutineTeacherId(e.target.value)}>
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
                  </select>
                </label>
              </div>
              <TeacherRoutineGrid
                periods={periods}
                routinesByCell={teacherRoutineByCell}
                isLoading={teacherRoutinesQuery.isLoading}
                hasTeacher={Boolean(teacherRoutineTeacherId)}
                weekendDayValues={weekendDayValues}
              />
            </section>
          </div>
        </div>
      ) : null}
        </div>
      </section>
    </div>
  );
}

function AcademicSideMenu({ activeTab, onSelect }: { activeTab: TabId; onSelect: (tabId: TabId) => void }) {
  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="px-2 pb-3 pt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Academic Menu</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Setup Sections</h2>
        </div>
        <nav className="space-y-1" aria-label="Academic setup menu">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(tab.id)}
                className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  isActive
                    ? 'border-purple-200 bg-purple-50 text-purple-950 shadow-sm'
                    : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? 'bg-white text-purple-700 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:text-purple-700'
                }`}>
                  <AcademicIcon name={tab.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 text-sm font-bold">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function SimpleCrudLayout({
  title,
  listTitle,
  form,
  footer,
  table,
  isLoading,
  emptyMessage,
  actionLabel,
  isFormOpen,
  onOpenForm,
  onCloseForm,
  search,
  setSearch,
}: {
  title: string;
  listTitle: string;
  form: React.ReactNode;
  footer?: React.ReactNode;
  table: React.ReactNode;
  isLoading: boolean;
  emptyMessage: string;
  actionLabel?: string;
  isFormOpen?: boolean;
  onOpenForm?: () => void;
  onCloseForm?: () => void;
  search?: string;
  setSearch?: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <FormCard title={title} actionLabel={actionLabel} isOpen={isFormOpen} onOpen={onOpenForm} onClose={onCloseForm}>
        {form}
        {footer ? <div className="border-t border-slate-100 pt-4">{footer}</div> : null}
      </FormCard>
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

function TeacherRoutineGrid({
  periods,
  routinesByCell,
  isLoading,
  hasTeacher,
  weekendDayValues,
}: {
  periods: TimePeriod[];
  routinesByCell: Map<string, ClassRoutine>;
  isLoading: boolean;
  hasTeacher: boolean;
  weekendDayValues: Set<number>;
}) {
  if (!hasTeacher) return <div className="mt-4"><EmptyState message="Select a teacher to view timetable." /></div>;
  if (isLoading) return <div className="mt-4"><LoadingSkeleton /></div>;
  if (!periods.length) return <div className="mt-4"><EmptyState message="Generate or add time periods first." /></div>;

  return (
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
                const cell = routinesByCell.get(`${day.value}:${period.id}`);
                const isWeekend = weekendDayValues.has(day.value);
                const isBreak = period.type === 'BREAK';
                return (
                  <td key={`${day.value}-${period.id}`} className="h-24 border-b border-r border-slate-200 px-3 py-2 align-top">
                    {isBreak ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Break</span>
                    ) : cell ? (
                      <div className="space-y-1 rounded-xl border border-sky-100 bg-sky-50 p-2">
                        <div className="font-semibold text-sky-950">{cell.class?.name} - {cell.section?.name}</div>
                        <div className="text-xs text-sky-700">{cell.subject?.name}</div>
                        <div className="text-xs text-sky-700">{cell.classRoom?.roomNumber ? `Room ${cell.classRoom.roomNumber}` : 'No room'}</div>
                      </div>
                    ) : isWeekend ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Weekend</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Free</span>
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

type PaginationMeta = {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  pageSize: number;
};

function paginateItems<T>(items: T[], page: number, pageSize = ACADEMIC_PAGE_SIZE): { items: T[]; meta: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = total ? (currentPage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, total);

  return {
    items: items.slice(startIndex, endIndex),
    meta: {
      page: currentPage,
      totalPages,
      start: total ? startIndex + 1 : 0,
      end: endIndex,
      total,
      pageSize,
    },
  };
}

const visiblePageNumbers = (currentPage: number, totalPages: number) => {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);

  return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
};

function PaginationControls({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  if (!meta.total) return null;

  const pages = visiblePageNumbers(meta.page, meta.totalPages);
  const buttonClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 transition hover:border-purple-200 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40';
  const activeClass = 'border-purple-500 bg-purple-600 text-white shadow-sm shadow-purple-100 hover:bg-purple-600';

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing <span className="font-bold text-slate-700">{meta.start}</span> to <span className="font-bold text-slate-700">{meta.end}</span> of{' '}
        <span className="font-bold text-slate-700">{meta.total}</span> entries
      </p>
      {meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className={buttonClass} disabled={meta.page === 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
            <AcademicIcon name="chevron-left" className="h-4 w-4" />
          </button>
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              className={`${buttonClass} ${page === meta.page ? activeClass : ''}`}
              onClick={() => onPageChange(page)}
              aria-current={page === meta.page ? 'page' : undefined}
            >
              {page}
            </button>
          ))}
          <button type="button" className={buttonClass} disabled={meta.page === meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
            <AcademicIcon name="chevron-right" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">Page 1 of 1</span>
      )}
    </div>
  );
}

function PaginatedDataTable<T extends { id: string }>({
  headers,
  items,
  emptyMessage,
  renderRow,
}: {
  headers: string[];
  items: T[];
  emptyMessage: string;
  renderRow: (item: T) => React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const resetKey = items.map((item) => item.id).join('|');
  const { items: pageItems, meta } = useMemo(() => paginateItems(items, page), [items, page]);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  if (!items.length) return <EmptyState message={emptyMessage} />;

  return (
    <>
      <DataTable headers={headers}>{pageItems.map(renderRow)}</DataTable>
      <PaginationControls meta={meta} onPageChange={setPage} />
    </>
  );
}

type AcademicYearItem = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

function AcademicYearTable({
  items,
  onEdit,
  onDelete,
}: {
  items: AcademicYearItem[];
  onEdit: (item: AcademicYearItem) => void;
  onDelete: (item: AcademicYearItem) => void;
}) {
  return (
    <PaginatedDataTable
      headers={['Academic Year', 'Starting Date', 'Ending Date', 'Status', 'Actions']}
      items={items}
      emptyMessage="No academic years found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{formatDate(item.startDate)}</Cell>
          <Cell>{formatDate(item.endDate)}</Cell>
          <Cell>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {item.isActive ? 'Active' : 'Inactive'}
            </span>
          </Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
  );
}

function ClassTable({ items, onEdit, onDelete }: { items: AcademicClass[]; onEdit: (item: AcademicClass) => void; onDelete: (item: AcademicClass) => void }) {
  return (
    <PaginatedDataTable
      headers={['Class', 'Sections', 'Students', 'Actions']}
      items={items}
      emptyMessage="No classes found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.classSections?.map((link) => link.section.name).join(', ') || 'No sections'}</Cell>
          <Cell>{item._count?.students ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
  );
}

function SectionTable({ items, onEdit, onDelete }: { items: AcademicSection[]; onEdit: (item: AcademicSection) => void; onDelete: (item: AcademicSection) => void }) {
  return (
    <PaginatedDataTable
      headers={['Section', 'Linked Classes', 'Students', 'Actions']}
      items={items}
      emptyMessage="No sections found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.classSections?.map((link) => link.class?.name).filter(Boolean).join(', ') || 'Not linked'}</Cell>
          <Cell>{item._count?.students ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
  );
}

function SubjectTable({ items, onEdit, onDelete }: { items: AcademicSubject[]; onEdit: (item: AcademicSubject) => void; onDelete: (item: AcademicSubject) => void }) {
  return (
    <PaginatedDataTable
      headers={['Subject', 'Code', 'Type', 'Assignments', 'Actions']}
      items={items}
      emptyMessage="No subjects found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.code ?? '-'}</Cell>
          <Cell>{item.type === 'PRACTICAL' ? 'Practical' : 'Theory'}</Cell>
          <Cell>{item._count?.assignSubjects ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
  );
}

function RoomTable({ items, onEdit, onDelete }: { items: ClassRoom[]; onEdit: (item: ClassRoom) => void; onDelete: (item: ClassRoom) => void }) {
  return (
    <PaginatedDataTable
      headers={['Room', 'Capacity', 'Routine Cells', 'Actions']}
      items={items}
      emptyMessage="No rooms found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.roomNumber}</Cell>
          <Cell>{item.capacity}</Cell>
          <Cell>{item._count?.classRoutines ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
  );
}

function TimeTable({ items, onEdit, onDelete }: { items: TimePeriod[]; onEdit: (item: TimePeriod) => void; onDelete: (item: TimePeriod) => void }) {
  return (
    <PaginatedDataTable
      headers={['Type', 'Name', 'Start', 'End', 'Routine Cells', 'Actions']}
      items={items}
      emptyMessage="No time periods found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell>{formatPeriodType(item.type)}</Cell>
          <Cell strong>{item.name}</Cell>
          <Cell>{item.startTime}</Cell>
          <Cell>{item.endTime}</Cell>
          <Cell>{item._count?.classRoutines ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
  );
}

function AssignSubjectTable({ items, onDelete }: { items: AssignSubject[]; onDelete: (item: AssignSubject) => void }) {
  return (
    <PaginatedDataTable
      headers={['Subject', 'Code', 'Teacher', 'Type', 'Actions']}
      items={items}
      emptyMessage="No assigned subjects found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.subject?.name}</Cell>
          <Cell>{item.subject?.code ?? '-'}</Cell>
          <Cell>{teacherName(item.teacher)}</Cell>
          <Cell>{item.subject?.type === 'PRACTICAL' ? 'Practical' : 'Theory'}</Cell>
          <td className="px-4 py-3 text-right">
            <IconButton icon="trash" label="Delete" variant="danger" onClick={() => onDelete(item)} />
          </td>
        </tr>
      )}
    />
  );
}

function ClassTeacherTable({ items, onEdit, onDelete }: { items: ClassTeacher[]; onEdit: (item: ClassTeacher) => void; onDelete: (item: ClassTeacher) => void }) {
  return (
    <PaginatedDataTable
      headers={['Class', 'Section', 'Teacher', 'Actions']}
      items={items}
      emptyMessage="No class teacher assignments found."
      renderRow={(item) => (
        <tr key={item.id}>
          <Cell strong>{item.class?.name}</Cell>
          <Cell>{item.section?.name}</Cell>
          <Cell>{teacherName(item.teacher)}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      )}
    />
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
        <IconButton icon="edit" label="Edit" onClick={onEdit} />
        <IconButton icon="trash" label="Delete" variant="danger" onClick={onDelete} />
      </div>
    </td>
  );
}
