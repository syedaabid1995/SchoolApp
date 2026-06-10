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
  assignVehiclesToRoute,
  createStudentTransportAssignment,
  createTransportRoute,
  createTransportVehicle,
  deleteStudentTransportAssignment,
  deleteTransportAssignment,
  deleteTransportRoute,
  deleteTransportVehicle,
  getStudentTransportReport,
  listStudentTransportAssignments,
  listTransportAssignments,
  listTransportDrivers,
  listTransportRoutes,
  listTransportVehicles,
  updateStudentTransportAssignment,
  type StudentTransportAssignment,
  updateTransportRoute,
  updateTransportVehicle,
  type StudentTransportReportRow,
  type TransportDriver,
  type TransportAssignment,
  type TransportRoute,
  type TransportVehicle,
} from '../../../services/transport.service';

type TabId = 'routes' | 'vehicles' | 'routeAssign' | 'studentAssign' | 'report';

type AcademicOption = {
  id: string;
  name: string;
  classId?: string | null;
};

type AssignmentGroup = {
  routeId: string;
  routeTitle: string;
  fare: string | number;
  assignments: TransportAssignment[];
};

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: 'routes', label: 'Routes', description: 'Route title and fare' },
  { id: 'vehicles', label: 'Vehicles', description: 'Vehicle and staff driver' },
  { id: 'routeAssign', label: 'Route Vehicles', description: 'Connect vehicles to routes' },
  { id: 'studentAssign', label: 'Student Assign', description: 'Assign students to transport' },
  { id: 'report', label: 'Student Transport Report', description: 'Search students using transport' },
];

const emptyRouteForm = { id: '', title: '', fare: '0' };
const emptyVehicleForm = {
  id: '',
  vehicleNumber: '',
  vehicleModel: '',
  yearMade: '',
  driverStaffId: '',
  driverName: '',
  driverLicense: '',
  driverContact: '',
  note: '',
};
const emptyAssignForm = { routeId: '', vehicleIds: [] as string[] };
const emptyStudentAssignForm = { id: '', classId: '', sectionId: '', studentId: '', routeId: '', vehicleId: '', note: '' };
const emptyReportFilters = { classId: '', sectionId: '', routeId: '', vehicleId: '' };

const getErrorMessage = (error: unknown, fallback = 'Something went wrong') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

const money = (value?: string | number | null) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
};

const driverFullName = (driver: TransportDriver) => `${driver.firstName} ${driver.lastName}`.trim();

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-400';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const PrimaryButton = ({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
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

export default function TransportPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TabId>('routes');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [search, setSearch] = useState('');
  const [routeForm, setRouteForm] = useState(emptyRouteForm);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [studentAssignForm, setStudentAssignForm] = useState(emptyStudentAssignForm);
  const [reportFilters, setReportFilters] = useState(emptyReportFilters);
  const [submittedReportFilters, setSubmittedReportFilters] = useState(emptyReportFilters);
  const [reportSearched, setReportSearched] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const schoolsQuery = useQuery({
    queryKey: ['schools', 'transport'],
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
  const canUsePage = isSuperAdmin || isSchoolAdmin;
  const canQuery = Boolean(canUsePage && effectiveSchoolId);

  const routesQuery = useQuery({
    queryKey: ['transport-routes', effectiveSchoolId, search],
    queryFn: () => listTransportRoutes({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const vehiclesQuery = useQuery({
    queryKey: ['transport-vehicles', effectiveSchoolId, search],
    queryFn: () => listTransportVehicles({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const driversQuery = useQuery({
    queryKey: ['transport-drivers', effectiveSchoolId],
    queryFn: () => listTransportDrivers(scopedParams),
    enabled: canQuery,
  });
  const assignmentsQuery = useQuery({
    queryKey: ['transport-assignments', effectiveSchoolId, search],
    queryFn: () => listTransportAssignments({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const studentAssignmentsQuery = useQuery({
    queryKey: ['student-transport-assignments', effectiveSchoolId, search],
    queryFn: () => listStudentTransportAssignments({ ...scopedParams, search }),
    enabled: canQuery,
  });
  const classesQuery = useQuery({
    queryKey: ['transport-classes', effectiveSchoolId],
    queryFn: () => listClasses(scopedParams),
    enabled: canQuery,
  });
  const studentAssignSectionsQuery = useQuery({
    queryKey: ['transport-student-assign-sections', effectiveSchoolId, studentAssignForm.classId],
    queryFn: () => listSections({ ...scopedParams, classId: studentAssignForm.classId }),
    enabled: canQuery && Boolean(studentAssignForm.classId),
  });
  const studentsQuery = useQuery({
    queryKey: ['transport-students', effectiveSchoolId, studentAssignForm.classId, studentAssignForm.sectionId],
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
    queryKey: ['transport-sections', effectiveSchoolId, reportFilters.classId],
    queryFn: () => listSections({ ...scopedParams, classId: reportFilters.classId }),
    enabled: canQuery && Boolean(reportFilters.classId),
  });
  const reportQuery = useQuery({
    queryKey: ['student-transport-report', effectiveSchoolId, submittedReportFilters, reportSearched],
    queryFn: () => getStudentTransportReport({ ...scopedParams, ...submittedReportFilters }),
    enabled: canQuery && reportSearched,
  });

  const routes = routesQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const studentAssignments = studentAssignmentsQuery.data ?? [];
  const classes = (classesQuery.data ?? []) as AcademicOption[];
  const studentAssignSections = (studentAssignSectionsQuery.data ?? []) as AcademicOption[];
  const students = (studentsQuery.data ?? []) as Student[];
  const sections = (sectionsQuery.data ?? []) as AcademicOption[];

  const assignmentGroups = useMemo(() => {
    const groups = new Map<string, AssignmentGroup>();
    assignments.forEach((assignment) => {
      const routeId = assignment.routeId;
      if (!groups.has(routeId)) {
        groups.set(routeId, {
          routeId,
          routeTitle: assignment.route?.title ?? 'Route',
          fare: assignment.route?.fare ?? 0,
          assignments: [],
        });
      }
      groups.get(routeId)?.assignments.push(assignment);
    });
    return Array.from(groups.values());
  }, [assignments]);

  const reportVehicles = useMemo(() => {
    if (!reportFilters.routeId) return vehicles;
    const assignedVehicleIds = new Set(assignments.filter((item) => item.routeId === reportFilters.routeId).map((item) => item.vehicleId));
    return vehicles.filter((vehicle) => assignedVehicleIds.has(vehicle.id));
  }, [assignments, reportFilters.routeId, vehicles]);

  const studentAssignVehicles = useMemo(() => {
    if (!studentAssignForm.routeId) return vehicles;
    const assignedVehicleIds = new Set(assignments.filter((item) => item.routeId === studentAssignForm.routeId).map((item) => item.vehicleId));
    return vehicles.filter((vehicle) => assignedVehicleIds.has(vehicle.id));
  }, [assignments, studentAssignForm.routeId, vehicles]);

  const invalidateTransport = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] }),
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles'] }),
      queryClient.invalidateQueries({ queryKey: ['transport-drivers'] }),
      queryClient.invalidateQueries({ queryKey: ['transport-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['student-transport-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['student-transport-report'] }),
    ]);
  };

  const onSuccess = async (title: string) => {
    notify.success(title);
    await invalidateTransport();
  };
  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const routeMutation = useMutation({
    mutationFn: () =>
      routeForm.id
        ? updateTransportRoute(routeForm.id, { ...scopedParams, title: routeForm.title, fare: Number(routeForm.fare) })
        : createTransportRoute({ ...scopedParams, title: routeForm.title, fare: Number(routeForm.fare) }),
    onSuccess: () => {
      setRouteForm(emptyRouteForm);
      onSuccess('Route saved');
    },
    onError,
  });

  const vehicleMutation = useMutation({
    mutationFn: () =>
      vehicleForm.id
        ? updateTransportVehicle(vehicleForm.id, {
            ...scopedParams,
            vehicleNumber: vehicleForm.vehicleNumber,
            vehicleModel: vehicleForm.vehicleModel,
            yearMade: vehicleForm.yearMade ? Number(vehicleForm.yearMade) : null,
            driverName: vehicleForm.driverName,
            driverLicense: vehicleForm.driverLicense,
            driverContact: vehicleForm.driverContact,
            note: vehicleForm.note || null,
          })
        : createTransportVehicle({
            ...scopedParams,
            vehicleNumber: vehicleForm.vehicleNumber,
            vehicleModel: vehicleForm.vehicleModel,
            yearMade: vehicleForm.yearMade ? Number(vehicleForm.yearMade) : null,
            driverName: vehicleForm.driverName,
            driverLicense: vehicleForm.driverLicense,
            driverContact: vehicleForm.driverContact,
            note: vehicleForm.note || null,
          }),
    onSuccess: () => {
      setVehicleForm(emptyVehicleForm);
      onSuccess('Vehicle saved');
    },
    onError,
  });

  const assignMutation = useMutation({
    mutationFn: () => assignVehiclesToRoute({ ...scopedParams, routeId: assignForm.routeId, vehicleIds: assignForm.vehicleIds, replace: true }),
    onSuccess: () => {
      setAssignForm(emptyAssignForm);
      onSuccess('Vehicle assignment saved');
    },
    onError,
  });

  const studentAssignMutation = useMutation({
    mutationFn: () =>
      studentAssignForm.id
        ? updateStudentTransportAssignment(studentAssignForm.id, {
            ...scopedParams,
            studentId: studentAssignForm.studentId,
            routeId: studentAssignForm.routeId,
            vehicleId: studentAssignForm.vehicleId || null,
            active: true,
            note: studentAssignForm.note || null,
          })
        : createStudentTransportAssignment({
            ...scopedParams,
            studentId: studentAssignForm.studentId,
            routeId: studentAssignForm.routeId,
            vehicleId: studentAssignForm.vehicleId || null,
            active: true,
            note: studentAssignForm.note || null,
          }),
    onSuccess: () => {
      setStudentAssignForm(emptyStudentAssignForm);
      onSuccess('Student transport assignment saved');
    },
    onError,
  });

  const confirmDelete = (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    action()
      .then(() => onSuccess('Deleted'))
      .catch(onError);
  };

  const validateRoute = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!routeForm.title.trim()) return notify.error('Validation error', 'Route title is required.');
    if (Number(routeForm.fare) < 0 || Number.isNaN(Number(routeForm.fare))) return notify.error('Validation error', 'Fare must be zero or greater.');
    routeMutation.mutate();
  };

  const validateVehicle = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!vehicleForm.vehicleNumber.trim()) return notify.error('Validation error', 'Vehicle number is required.');
    if (!vehicleForm.vehicleModel.trim()) return notify.error('Validation error', 'Vehicle model is required.');
    if (vehicleForm.yearMade && (Number(vehicleForm.yearMade) < 1900 || Number.isNaN(Number(vehicleForm.yearMade)))) {
      return notify.error('Validation error', 'Year made is invalid.');
    }
    if (!vehicleForm.driverName.trim()) return notify.error('Validation error', 'Driver name is required.');
    if (!vehicleForm.driverLicense.trim()) return notify.error('Validation error', 'Driver license is required.');
    if (!vehicleForm.driverContact.trim()) return notify.error('Validation error', 'Driver contact is required.');
    vehicleMutation.mutate();
  };

  const selectDriver = (driverId: string) => {
    const driver = drivers.find((item) => item.id === driverId);
    setVehicleForm((current) => ({
      ...current,
      driverStaffId: driverId,
      driverName: driver ? driverFullName(driver) : '',
      driverLicense: driver?.drivingLicense ?? '',
      driverContact: driver?.phone || driver?.emergencyMobile || '',
    }));
  };

  const validateAssign = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!assignForm.routeId) return notify.error('Validation error', 'Select route.');
    if (!assignForm.vehicleIds.length) return notify.error('Validation error', 'Select at least one vehicle.');
    assignMutation.mutate();
  };

  const validateStudentAssign = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!studentAssignForm.classId) return notify.error('Validation error', 'Select class.');
    if (!studentAssignForm.sectionId) return notify.error('Validation error', 'Select section.');
    if (!studentAssignForm.studentId) return notify.error('Validation error', 'Select student.');
    if (!studentAssignForm.routeId) return notify.error('Validation error', 'Select route.');
    studentAssignMutation.mutate();
  };

  const searchReport = () => {
    setSubmittedReportFilters(reportFilters);
    setReportSearched(true);
  };

  const toggleVehicle = (vehicleId: string) => {
    setAssignForm((current) => ({
      ...current,
      vehicleIds: current.vehicleIds.includes(vehicleId)
        ? current.vehicleIds.filter((item) => item !== vehicleId)
        : [...current.vehicleIds, vehicleId],
    }));
  };

  const selectRouteForAssignment = (routeId: string) => {
    const existingVehicleIds = assignments.filter((item) => item.routeId === routeId).map((item) => item.vehicleId);
    setAssignForm({ routeId, vehicleIds: existingVehicleIds });
  };

  const editStudentAssignment = (assignment: StudentTransportAssignment) => {
    setStudentAssignForm({
      id: assignment.id,
      classId: assignment.student.class?.id ?? '',
      sectionId: assignment.student.section?.id ?? '',
      studentId: assignment.student.id,
      routeId: assignment.routeId,
      vehicleId: assignment.vehicleId ?? '',
      note: assignment.note ?? '',
    });
  };

  useEffect(() => {
    setRouteForm(emptyRouteForm);
    setVehicleForm(emptyVehicleForm);
    setAssignForm(emptyAssignForm);
    setStudentAssignForm(emptyStudentAssignForm);
    setReportFilters(emptyReportFilters);
    setSubmittedReportFilters(emptyReportFilters);
    setReportSearched(false);
    setSearch('');
  }, [effectiveSchoolId]);

  useEffect(() => {
    setReportFilters((current) => ({ ...current, sectionId: '' }));
  }, [reportFilters.classId]);

  useEffect(() => {
    setReportFilters((current) => ({ ...current, vehicleId: '' }));
  }, [reportFilters.routeId]);

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
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Checking transport access...</div>;
  }

  if (!canUsePage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-950">Transport is not available for your role.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transport"
        subtitle="Manage routes, vehicles, staff drivers, vehicle-route links, student assignments, and reports."
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

      {!effectiveSchoolId ? <EmptyState message="Select a school to manage transport records." /> : null}

      {effectiveSchoolId && activeTab === 'routes' ? (
        <SimpleCrudLayout
          title={routeForm.id ? 'Edit Route' : 'Add Route'}
          listTitle="Route List"
          search={search}
          setSearch={setSearch}
          isLoading={routesQuery.isLoading}
          emptyMessage="No routes found."
          form={
            <>
              <Field label="Route title *">
                <input className={inputClass} value={routeForm.title} onChange={(e) => setRouteForm((p) => ({ ...p, title: e.target.value }))} />
              </Field>
              <Field label="Fare *">
                <input className={inputClass} type="number" min={0} step="0.01" value={routeForm.fare} onChange={(e) => setRouteForm((p) => ({ ...p, fare: e.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={routeMutation.isPending} onClick={validateRoute}>Save Route</PrimaryButton>
                {routeForm.id ? <SecondaryButton onClick={() => setRouteForm(emptyRouteForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <RouteTable
              items={routes}
              onEdit={(item) => setRouteForm({ id: item.id, title: item.title, fare: String(item.fare) })}
              onDelete={(item) => confirmDelete(`Delete route "${item.title}"?`, () => deleteTransportRoute(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'vehicles' ? (
        <SimpleCrudLayout
          title={vehicleForm.id ? 'Edit Vehicle' : 'Add Vehicle'}
          listTitle="Vehicle List"
          search={search}
          setSearch={setSearch}
          isLoading={vehiclesQuery.isLoading}
          emptyMessage="No vehicles found."
          form={
            <>
              <Field label="Vehicle number *">
                <input className={inputClass} value={vehicleForm.vehicleNumber} onChange={(e) => setVehicleForm((p) => ({ ...p, vehicleNumber: e.target.value }))} />
              </Field>
              <Field label="Vehicle model *">
                <input className={inputClass} value={vehicleForm.vehicleModel} onChange={(e) => setVehicleForm((p) => ({ ...p, vehicleModel: e.target.value }))} />
              </Field>
              <Field label="Year made">
                <input className={inputClass} type="number" min={1900} value={vehicleForm.yearMade} onChange={(e) => setVehicleForm((p) => ({ ...p, yearMade: e.target.value }))} />
              </Field>
              <Field label="Driver from staff *">
                <select className={inputClass} value={vehicleForm.driverStaffId} onChange={(e) => selectDriver(e.target.value)}>
                  <option value="">{driversQuery.isLoading ? 'Loading staff...' : 'Select staff driver'}</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driverFullName(driver)}{driver.employeeNo ? ` (${driver.employeeNo})` : ''}{driver.designation?.name ? ` - ${driver.designation.name}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {vehicleForm.driverName && !vehicleForm.driverStaffId ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Existing driver details are saved as text. Select a staff member to replace them.
                </div>
              ) : null}
              <Field label="Driver license *">
                <input className={inputClass} value={vehicleForm.driverLicense} readOnly placeholder="Selected staff license" />
              </Field>
              <Field label="Driver contact *">
                <input className={inputClass} value={vehicleForm.driverContact} readOnly placeholder="Selected staff contact" />
              </Field>
              <Field label="Note">
                <textarea className={inputClass} rows={3} value={vehicleForm.note} onChange={(e) => setVehicleForm((p) => ({ ...p, note: e.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={vehicleMutation.isPending} onClick={validateVehicle}>Save Vehicle</PrimaryButton>
                {vehicleForm.id ? <SecondaryButton onClick={() => setVehicleForm(emptyVehicleForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <VehicleTable
              items={vehicles}
              onEdit={(item) => setVehicleForm({
                id: item.id,
                vehicleNumber: item.vehicleNumber,
                vehicleModel: item.vehicleModel,
                yearMade: item.yearMade ? String(item.yearMade) : '',
                driverStaffId: '',
                driverName: item.driverName,
                driverLicense: item.driverLicense,
                driverContact: item.driverContact,
                note: item.note ?? '',
              })}
              onDelete={(item) => confirmDelete(`Delete vehicle "${item.vehicleNumber}"?`, () => deleteTransportVehicle(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'routeAssign' ? (
        <SimpleCrudLayout
          title="Assign Vehicles to Route"
          listTitle="Route Vehicle Assignments"
          search={search}
          setSearch={setSearch}
          isLoading={assignmentsQuery.isLoading}
          emptyMessage="No vehicle assignments found."
          form={
            <>
              <Field label="Select route *">
                <select className={inputClass} value={assignForm.routeId} onChange={(e) => selectRouteForAssignment(e.target.value)}>
                  <option value="">Select route</option>
                  {routes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </Field>
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle *</span>
                {!vehicles.length ? <EmptyState message="Add a vehicle first." /> : (
                  <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
                    {vehicles.map((vehicle) => (
                      <label key={vehicle.id} className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          checked={assignForm.vehicleIds.includes(vehicle.id)}
                          onChange={() => toggleVehicle(vehicle.id)}
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">{vehicle.vehicleNumber}</span>
                          <span className="block text-xs text-slate-500">{vehicle.driverName} · {vehicle.driverContact}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={assignMutation.isPending} onClick={validateAssign}>Save</PrimaryButton>
                {assignForm.routeId ? <SecondaryButton onClick={() => setAssignForm(emptyAssignForm)}>Cancel</SecondaryButton> : null}
              </div>
            </>
          }
          table={
            <AssignmentTable
              groups={assignmentGroups}
              onEdit={(group) => setAssignForm({ routeId: group.routeId, vehicleIds: group.assignments.map((item) => item.vehicleId) })}
              onDelete={(group) => confirmDelete(`Delete vehicle assignments for "${group.routeTitle}"?`, () => Promise.all(group.assignments.map((item) => deleteTransportAssignment(item.id, scopedParams))))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'studentAssign' ? (
        <SimpleCrudLayout
          title={studentAssignForm.id ? 'Edit Student Transport' : 'Assign Student Transport'}
          listTitle="Student Transport Assignments"
          search={search}
          setSearch={setSearch}
          isLoading={studentAssignmentsQuery.isLoading}
          emptyMessage="No student transport assignments found."
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
              <Field label="Select route *">
                <select
                  className={inputClass}
                  value={studentAssignForm.routeId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, routeId: e.target.value, vehicleId: '' }))}
                >
                  <option value="">Select route</option>
                  {routes.map((item) => <option key={item.id} value={item.id}>{item.title} - {money(item.fare)}</option>)}
                </select>
              </Field>
              <Field label="Select vehicle">
                <select
                  className={inputClass}
                  value={studentAssignForm.vehicleId}
                  disabled={!studentAssignForm.routeId}
                  onChange={(e) => setStudentAssignForm((p) => ({ ...p, vehicleId: e.target.value }))}
                >
                  <option value="">No specific vehicle</option>
                  {studentAssignVehicles.map((item) => <option key={item.id} value={item.id}>{item.vehicleNumber} - {item.driverName}</option>)}
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
              onDelete={(item) => confirmDelete(`Remove transport assignment for "${item.student.fullName}"?`, () => deleteStudentTransportAssignment(item.id, scopedParams))}
            />
          }
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'report' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
            <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
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
              <Field label="Select route">
                <select className={inputClass} value={reportFilters.routeId} onChange={(e) => setReportFilters((p) => ({ ...p, routeId: e.target.value }))}>
                  <option value="">Select route</option>
                  {routes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </Field>
              <Field label="Select vehicle">
                <select className={inputClass} value={reportFilters.vehicleId} disabled={!reportFilters.routeId} onChange={(e) => setReportFilters((p) => ({ ...p, vehicleId: e.target.value }))}>
                  <option value="">Select vehicle</option>
                  {reportVehicles.map((item) => <option key={item.id} value={item.id}>{item.vehicleNumber}</option>)}
                </select>
              </Field>
              <PrimaryButton onClick={searchReport} disabled={reportQuery.isFetching}>Search</PrimaryButton>
            </div>
          </section>

          <ListCard title="Student Transport Report">
            {reportQuery.isFetching ? <LoadingSkeleton /> : (
              <ReportTable rows={reportQuery.data ?? []} searched={reportSearched} />
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

function RouteTable({ items, onEdit, onDelete }: { items: TransportRoute[]; onEdit: (item: TransportRoute) => void; onDelete: (item: TransportRoute) => void }) {
  if (!items.length) return <EmptyState message="No routes found." />;
  return (
    <DataTable headers={['Route Title', 'Fare', 'Assigned Vehicles', 'Students', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.title}</Cell>
          <Cell>{money(item.fare)}</Cell>
          <Cell>{item._count?.vehicleAssignments ?? 0}</Cell>
          <Cell>{item._count?.studentAssignments ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function VehicleTable({ items, onEdit, onDelete }: { items: TransportVehicle[]; onEdit: (item: TransportVehicle) => void; onDelete: (item: TransportVehicle) => void }) {
  if (!items.length) return <EmptyState message="No vehicles found." />;
  return (
    <DataTable headers={['Vehicle No.', 'Model No.', 'Year Made', 'Driver Name', 'Driver License', 'Phone', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.vehicleNumber}</Cell>
          <Cell>{item.vehicleModel}</Cell>
          <Cell>{item.yearMade ?? '-'}</Cell>
          <Cell>{item.driverName}</Cell>
          <Cell>{item.driverLicense}</Cell>
          <Cell>{item.driverContact}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function AssignmentTable({ groups, onEdit, onDelete }: { groups: AssignmentGroup[]; onEdit: (group: AssignmentGroup) => void; onDelete: (group: AssignmentGroup) => void }) {
  if (!groups.length) return <EmptyState message="No vehicle assignments found." />;
  return (
    <DataTable headers={['Route', 'Vehicle', 'Fare', 'Actions']}>
      {groups.map((group) => (
        <tr key={group.routeId}>
          <Cell strong>{group.routeTitle}</Cell>
          <Cell>
            <div className="space-y-1">
              {group.assignments.map((item) => (
                <div key={item.id}>
                  <span className="font-semibold text-slate-800">{item.vehicle?.vehicleNumber ?? '-'}</span>
                  <span className="ml-2 text-xs text-slate-500">{item.vehicle?.driverName ?? ''}</span>
                </div>
              ))}
            </div>
          </Cell>
          <Cell>{money(group.fare)}</Cell>
          <ActionCell onEdit={() => onEdit(group)} onDelete={() => onDelete(group)} />
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
  rows: StudentTransportAssignment[];
  onEdit: (item: StudentTransportAssignment) => void;
  onDelete: (item: StudentTransportAssignment) => void;
}) {
  if (!rows.length) return <EmptyState message="No student transport assignments found." />;
  return (
    <DataTable headers={['Class (Sec.)', 'Admission No.', 'Student', 'Route', 'Vehicle', 'Driver', 'Note', 'Actions']}>
      {rows.map((row) => (
        <tr key={row.id}>
          <Cell>{row.student.class?.name ?? '-'} {row.student.section?.name ? `(${row.student.section.name})` : ''}</Cell>
          <Cell>{row.student.admissionNo}</Cell>
          <Cell strong>{row.student.fullName}</Cell>
          <Cell>{row.route.title}</Cell>
          <Cell>{row.vehicle?.vehicleNumber ?? '-'}</Cell>
          <Cell>{row.vehicle?.driverName ?? '-'}</Cell>
          <Cell>{row.note || '-'}</Cell>
          <ActionCell onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
        </tr>
      ))}
    </DataTable>
  );
}

function ReportTable({ rows, searched }: { rows: StudentTransportReportRow[]; searched: boolean }) {
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        `${a.student.class?.name ?? ''} ${a.student.section?.name ?? ''} ${a.student.fullName}`.localeCompare(
          `${b.student.class?.name ?? ''} ${b.student.section?.name ?? ''} ${b.student.fullName}`,
        ),
      ),
    [rows],
  );

  if (!searched) return <EmptyState message="Select any filter or click Search to show all student transport records." />;
  if (!sortedRows.length) return <EmptyState message="No student transport records found for this criteria." />;

  return (
    <DataTable headers={['Class (Sec.)', 'Admission No.', 'Student Name', 'Mobile', "Father's Name", "Father's Phone", "Mother's Name", "Mother's Phone", 'Route Title', 'Vehicle Number', 'Driver Name', 'Driver Contact', 'Fare(s)']}>
      {sortedRows.map((row) => (
        <tr key={row.id}>
          <Cell>{row.student.class?.name ?? '-'} {row.student.section?.name ? `(${row.student.section.name})` : ''}</Cell>
          <Cell>{row.student.admissionNo}</Cell>
          <Cell strong>{row.student.fullName}</Cell>
          <Cell>{row.student.phone || row.student.parentPhone || '-'}</Cell>
          <Cell>{row.student.fatherName || '-'}</Cell>
          <Cell>{row.student.fatherPhone || '-'}</Cell>
          <Cell>{row.student.motherName || '-'}</Cell>
          <Cell>{row.student.motherPhone || '-'}</Cell>
          <Cell>{row.route.title}</Cell>
          <Cell>{row.vehicle?.vehicleNumber ?? '-'}</Cell>
          <Cell>{row.vehicle?.driverName ?? '-'}</Cell>
          <Cell>{row.vehicle?.driverContact ?? '-'}</Cell>
          <Cell>{money(row.route.fare)}</Cell>
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
  return <td className={`px-4 py-3 align-top ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{children}</td>;
}

function ActionCell({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-4 py-3 align-top">
      <div className="flex justify-end gap-2">
        <SecondaryButton onClick={onEdit}>Edit</SecondaryButton>
        <DangerButton onClick={onDelete}>Delete</DangerButton>
      </div>
    </td>
  );
}
