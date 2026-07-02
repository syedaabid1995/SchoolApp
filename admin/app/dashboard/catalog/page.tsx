'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import { useNotify } from '../../../components/NotificationProvider';
import { PLAN_PERMISSION_MODULES, buildPlanPermissionGroups } from '../../../config/plan-module-permissions';
import { getSession } from '../../../services/auth.service';
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getPlanPermissions,
  listSubscriptionPlans,
  updatePlanPermissions,
  updateSubscriptionPlan,
  type PlanPermissionItem,
  type SubscriptionPlan,
} from '../../../services/subscription.service';

const initialPlanForm = {
  name: '',
  status: 'ACTIVE',
  price: '0',
  studentLimit: '',
  teacherLimit: '',
  trialDays: '0',
  features: '',
};

type PlanFormState = typeof initialPlanForm;
type PlanModalMode = 'create' | 'edit' | 'modules';
type PlanPermissionGroupView = ReturnType<typeof buildPlanPermissionGroups>[number];
type PlanSectionView = { parent: string; codes: string[] };

const formatLabel = (value?: string | null) =>
  (value ?? 'N/A')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value?: number | null, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatNumber = (value?: number | null) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN') : '0';

const statusBadgeClass = (status?: string | null) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'INACTIVE') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

function Icon({ path, className = 'h-4 w-4' }: { path: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

const buildPlanSectionDefinitions = (): PlanSectionView[] => {
  const sections = new Map<string, Set<string>>();

  PLAN_PERMISSION_MODULES.forEach((definition) => {
    const sectionCodes = sections.get(definition.parent) ?? new Set<string>();
    definition.codes.forEach((code) => sectionCodes.add(code));
    sections.set(definition.parent, sectionCodes);
  });

  return Array.from(sections.entries()).map(([parent, codes]) => ({
    parent,
    codes: Array.from(codes),
  }));
};

const planSectionDefinitions = buildPlanSectionDefinitions();

const getGroupCodes = (group: PlanPermissionGroupView) =>
  Array.from(new Set(group.modules.flatMap((module) => module.permissions.map((permission) => permission.code))));

const getSectionState = (codes: string[], enabledSet: Set<string>) => {
  const enabledCount = codes.filter((code) => enabledSet.has(code)).length;
  return {
    enabledCount,
    isIncluded: codes.length > 0 && enabledCount === codes.length,
    isPartial: enabledCount > 0 && enabledCount < codes.length,
  };
};

const getSectionsFromGroups = (groups: PlanPermissionGroupView[]): PlanSectionView[] =>
  groups.map((group) => ({ parent: group.parent, codes: getGroupCodes(group) }));

const countIncludedSections = (sections: PlanSectionView[], enabledSet: Set<string>) =>
  sections.filter((section) => getSectionState(section.codes, enabledSet).isIncluded).length;

const buildPlanPayload = (form: PlanFormState) => {
  const price = Number(form.price);
  const studentLimit = Number(form.studentLimit);
  const teacherLimit = Number(form.teacherLimit);
  const trialDays = Number(form.trialDays);
  const features = form.features
    .split('\n')
    .map((feature) => feature.trim())
    .filter(Boolean);

  if (!form.name.trim()) throw new Error('Plan name is required.');
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid plan price.');
  if (!Number.isInteger(studentLimit) || studentLimit < 1) throw new Error('Student limit must be at least 1.');
  if (!Number.isInteger(teacherLimit) || teacherLimit < 1) throw new Error('Teacher limit must be at least 1.');
  if (!Number.isInteger(trialDays) || trialDays < 0) throw new Error('Trial days cannot be negative.');

  return {
    name: form.name.trim(),
    status: form.status,
    priceCents: Math.round(price * 100),
    studentLimit,
    teacherLimit,
    trialDays,
    features,
  };
};

export default function CatalogPage() {
  const router = useRouter();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planModalMode, setPlanModalMode] = useState<PlanModalMode | null>(null);
  const [editedPermissionCodes, setEditedPermissionCodes] = useState<string[]>([]);
  const [planForm, setPlanForm] = useState<PlanFormState>(initialPlanForm);

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [isSessionLoading, isSuperAdmin, router, session?.role]);

  const { data: plans, isLoading: isPlansLoading, isError: isPlansError, refetch } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: listSubscriptionPlans,
    enabled: isSuperAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: modulePermissions, isLoading: isModulePermissionsLoading } = useQuery({
    queryKey: ['subscription-plan-modules', selectedPlanId],
    queryFn: () => getPlanPermissions(selectedPlanId as string),
    enabled: Boolean(selectedPlanId) && isSuperAdmin && planModalMode === 'modules',
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!modulePermissions) return;
    setEditedPermissionCodes(modulePermissions.permissions.filter((permission) => permission.enabled).map((permission) => permission.code));
  }, [modulePermissions]);

  const filteredPlans = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return plans ?? [];
    return (plans ?? []).filter((plan) => {
      const values = [plan.name, plan.status, ...(plan.features ?? [])].join(' ').toLowerCase();
      return values.includes(keyword);
    });
  }, [plans, search]);

  const selectedPlan = plans?.find((plan) => plan.id === selectedPlanId) ?? null;

  const closePlanModal = () => {
    setPlanModalMode(null);
    setSelectedPlanId(null);
    setEditedPermissionCodes([]);
    setPlanForm(initialPlanForm);
  };

  const openPlanCreator = () => {
    setPlanForm(initialPlanForm);
    setEditedPermissionCodes([]);
    setSelectedPlanId(null);
    setPlanModalMode('create');
  };

  const openPlanEditor = (plan: SubscriptionPlan) => {
    setPlanForm({
      name: plan.name,
      status: plan.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      price: String(plan.priceCents / 100),
      studentLimit: String(plan.studentLimit),
      teacherLimit: String(plan.teacherLimit),
      trialDays: String(plan.trialDays ?? 0),
      features: (plan.features ?? []).join('\n'),
    });
    setSelectedPlanId(plan.id);
    setPlanModalMode('edit');
  };

  const openPlanModules = (plan: SubscriptionPlan) => {
    setSelectedPlanId(plan.id);
    setPlanModalMode('modules');
  };

  const planCreateMutation = useMutation({
    mutationFn: async () => {
      const plan = await createSubscriptionPlan(buildPlanPayload(planForm));
      await updatePlanPermissions(plan.id, editedPermissionCodes);
      return plan;
    },
    onSuccess: () => {
      notify.success('Plan created', 'Plan details and module sections were saved.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
      closePlanModal();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to create plan.';
      notify.error('Plan create failed', message);
    },
  });

  const planEditMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId) throw new Error('Select a plan.');
      return updateSubscriptionPlan(selectedPlanId, buildPlanPayload(planForm));
    },
    onSuccess: () => {
      notify.success('Plan updated', 'Plan details were saved.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
      closePlanModal();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to update plan.';
      notify.error('Plan update failed', message);
    },
  });

  const modulePermissionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId) throw new Error('Select a plan.');
      return updatePlanPermissions(selectedPlanId, editedPermissionCodes);
    },
    onSuccess: () => {
      notify.success('Plan modules updated', 'Sidebar modules and permissions were saved for this plan.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plan-modules', selectedPlanId] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to update plan modules.';
      notify.error('Save failed', message);
    },
  });

  const planDeleteMutation = useMutation({
    mutationFn: (planId: string) => deleteSubscriptionPlan(planId),
    onSuccess: () => {
      notify.success('Plan deleted', 'The plan was removed from the catalog.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to delete plan.';
      notify.error('Plan delete failed', message);
    },
  });

  const confirmDeletePlan = (plan: SubscriptionPlan) => {
    if (
      !window.confirm(
        `Delete "${plan.name}"? Existing schools keep their current plan name, but this plan will no longer be available for assignment.`,
      )
    ) {
      return;
    }
    planDeleteMutation.mutate(plan.id);
  };

  const busy = isSessionLoading || isPlansLoading || planCreateMutation.isPending || planEditMutation.isPending || planDeleteMutation.isPending;

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 pb-8">
      {busy ? <FullPageLoader label="Loading catalog..." /> : null}

      <header className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--shell-text)]">Catalog</h1>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">Create plans, update limits, and manage module access.</p>
          </div>
          <span className="text-sm font-semibold text-[var(--shell-muted)]">Dashboard / Catalog</span>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Plan Catalog</h2>
            <p className="text-sm text-[var(--shell-muted)]">{filteredPlans.length} plans shown</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans"
              className="h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
            />
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--shell-border)] px-3 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
            >
              <Icon path={<><path d="M21 12a9 9 0 0 1-9 9 8.6 8.6 0 0 1-6-2.4" /><path d="M3 12a9 9 0 0 1 15-6.7" /><path d="M21 3v6h-6" /></>} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openPlanCreator}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Icon path={<><path d="M12 5v14" /><path d="M5 12h14" /></>} />
              Create Plan
            </button>
          </div>
        </div>

        {isPlansError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Unable to load plan catalog.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Retry
            </button>
          </div>
        ) : filteredPlans.length === 0 && !isPlansLoading ? (
          <div className="p-10 text-center text-sm text-[var(--shell-muted)]">No subscription plans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-y border-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)] text-left text-sm font-semibold text-[var(--shell-text)]">
                <tr>
                  <th className="px-4 py-3">Plan Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Limits</th>
                  <th className="px-4 py-3">Trial</th>
                  <th className="px-4 py-3">Features</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {filteredPlans.map((plan) => {
                  const featurePreview = (plan.features ?? []).slice(0, 2);
                  return (
                    <tr key={plan.id} className="hover:bg-[var(--shell-hover)]">
                      <td className="min-w-[14rem] px-4 py-3">
                        <div className="font-semibold text-[var(--shell-text)]">{plan.name}</div>
                        <div className="mt-1 text-xs text-[var(--shell-muted)]">{plan.id}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--shell-text)]">{formatCurrency(plan.priceCents / 100)}</td>
                      <td className="min-w-[12rem] px-4 py-3 text-[var(--shell-muted)]">
                        {formatNumber(plan.studentLimit)} students / {formatNumber(plan.teacherLimit)} teachers
                      </td>
                      <td className="px-4 py-3 text-[var(--shell-muted)]">{formatNumber(plan.trialDays)} days</td>
                      <td className="min-w-[18rem] px-4 py-3 text-[var(--shell-muted)]">
                        {featurePreview.length ? featurePreview.join(', ') : 'No features'}
                        {(plan.features?.length ?? 0) > featurePreview.length ? ` +${(plan.features?.length ?? 0) - featurePreview.length} more` : ''}
                      </td>
                      <td className="px-4 py-3"><Badge className={statusBadgeClass(plan.status)}>{formatLabel(plan.status)}</Badge></td>
                      <td className="min-w-[12rem] px-4 py-3 text-[var(--shell-muted)]">{formatDateTime(plan.updatedAt)}</td>
                      <td className="min-w-[13rem] px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <ActionButton onClick={() => openPlanEditor(plan)}>Edit</ActionButton>
                          <ActionButton onClick={() => openPlanModules(plan)}>Modules</ActionButton>
                          <ActionButton danger onClick={() => confirmDeletePlan(plan)}>Delete</ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {planModalMode === 'create' ? (
        <PlanEditModal
          mode="create"
          plan={null}
          form={planForm}
          saving={planCreateMutation.isPending}
          moduleSections={planSectionDefinitions}
          enabledCodes={editedPermissionCodes}
          onFormChange={(patch) => setPlanForm((current) => ({ ...current, ...patch }))}
          onModuleChange={setEditedPermissionCodes}
          onClose={closePlanModal}
          onSubmit={() => planCreateMutation.mutate()}
        />
      ) : null}

      {selectedPlanId && planModalMode === 'edit' ? (
        <PlanEditModal
          mode="edit"
          plan={selectedPlan}
          form={planForm}
          saving={planEditMutation.isPending}
          onFormChange={(patch) => setPlanForm((current) => ({ ...current, ...patch }))}
          onClose={closePlanModal}
          onSubmit={() => planEditMutation.mutate()}
        />
      ) : null}

      {selectedPlanId && planModalMode === 'modules' ? (
        <PlanModulesModal
          plan={selectedPlan}
          permissions={modulePermissions?.permissions ?? []}
          editedCodes={editedPermissionCodes}
          loading={isModulePermissionsLoading}
          saving={modulePermissionMutation.isPending}
          onChange={setEditedPermissionCodes}
          onClose={closePlanModal}
          onSubmit={() => modulePermissionMutation.mutate()}
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
      }`}
    >
      {children}
    </button>
  );
}

function PlanEditModal({
  mode,
  plan,
  form,
  saving,
  moduleSections = [],
  enabledCodes = [],
  onFormChange,
  onModuleChange,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  plan: SubscriptionPlan | null;
  form: PlanFormState;
  saving: boolean;
  moduleSections?: PlanSectionView[];
  enabledCodes?: string[];
  onFormChange: (patch: Partial<PlanFormState>) => void;
  onModuleChange?: (codes: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isCreate = mode === 'create';
  const enabledSet = useMemo(() => new Set(enabledCodes), [enabledCodes]);
  const includedSectionCount = useMemo(() => countIncludedSections(moduleSections, enabledSet), [moduleSections, enabledSet]);
  const allModuleCodes = useMemo(() => Array.from(new Set(moduleSections.flatMap((section) => section.codes))), [moduleSections]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close plan drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[var(--shell-card)] shadow-2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{isCreate ? 'Create plan' : 'Edit plan'}</p>
              <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{isCreate ? 'New Subscription Plan' : plan?.name ?? 'Subscription Plan'}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <section className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
              <h3 className="text-base font-bold text-[var(--shell-text)]">Plan Details</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FormInput label="Plan Name" value={form.name} onChange={(value) => onFormChange({ name: value })} />
                <FormSelect label="Status" value={form.status} onChange={(value) => onFormChange({ status: value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </FormSelect>
                <FormInput label="Monthly Price" type="number" value={form.price} onChange={(value) => onFormChange({ price: value })} />
                <FormInput label="Trial Days" type="number" value={form.trialDays} onChange={(value) => onFormChange({ trialDays: value })} />
                <FormInput label="Student Limit" type="number" value={form.studentLimit} onChange={(value) => onFormChange({ studentLimit: value })} />
                <FormInput label="Teacher Limit" type="number" value={form.teacherLimit} onChange={(value) => onFormChange({ teacherLimit: value })} />
                <label className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Feature Lines</span>
                  <textarea
                    value={form.features}
                    onChange={(event) => onFormChange({ features: event.target.value })}
                    rows={8}
                    className="mt-1 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="One feature per line"
                  />
                </label>
              </div>
            </section>

            {isCreate ? (
              <section className="mt-4 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[var(--shell-text)]">Modules</h3>
                    <p className="mt-1 text-sm text-[var(--shell-muted)]">
                      {includedSectionCount} of {moduleSections.length} sections enabled
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onModuleChange?.(allModuleCodes)}
                      className="rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                    >
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => onModuleChange?.([])}
                      className="rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                    >
                      Disable All
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <PlanSectionList
                    sections={moduleSections}
                    enabledCodes={enabledCodes}
                    disabled={saving}
                    onChange={(codes) => onModuleChange?.(codes)}
                  />
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--shell-border)] p-4">
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--shell-border)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving...' : isCreate ? 'Create Plan' : 'Save Plan'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function PlanSectionList({
  sections,
  enabledCodes,
  disabled = false,
  onChange,
}: {
  sections: PlanSectionView[];
  enabledCodes: string[];
  disabled?: boolean;
  onChange: (codes: string[]) => void;
}) {
  const enabledSet = useMemo(() => new Set(enabledCodes), [enabledCodes]);

  const toggleCodes = (codes: string[], enabled: boolean) => {
    const next = new Set(enabledCodes);
    codes.forEach((code) => {
      if (enabled) next.add(code);
      else next.delete(code);
    });
    onChange(Array.from(next));
  };

  if (!sections.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center text-sm text-[var(--shell-muted)]">
        No module sections found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)]">
      {sections.map((section) => {
        const sectionState = getSectionState(section.codes, enabledSet);
        return (
          <div
            key={section.parent}
            className={`flex flex-col gap-3 border-b border-[var(--shell-border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${
              sectionState.isIncluded ? 'bg-emerald-50/45' : sectionState.isPartial ? 'bg-amber-50/50' : 'bg-[var(--shell-card)]'
            }`}
          >
            <h4 className="text-sm font-bold text-[var(--shell-text)]">{section.parent}</h4>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleCodes(section.codes, !sectionState.isIncluded)}
              className={`w-24 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                sectionState.isIncluded
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : sectionState.isPartial
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {sectionState.isIncluded ? 'Enabled' : sectionState.isPartial ? 'Partial' : 'Disabled'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PlanModulesModal({
  plan,
  permissions,
  editedCodes,
  loading,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  plan: SubscriptionPlan | null;
  permissions: PlanPermissionItem[];
  editedCodes: string[];
  loading: boolean;
  saving: boolean;
  onChange: (codes: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const groups = useMemo(() => buildPlanPermissionGroups(permissions), [permissions]);
  const sections = useMemo(() => getSectionsFromGroups(groups), [groups]);
  const enabledSet = useMemo(() => new Set(editedCodes), [editedCodes]);
  const allCodes = useMemo(() => Array.from(new Set(permissions.map((permission) => permission.code))), [permissions]);
  const includedSectionCount = useMemo(() => countIncludedSections(sections, enabledSet), [sections, enabledSet]);

  const setCodes = (codes: string[]) => onChange(Array.from(new Set(codes)));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close modules drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[var(--shell-card)] shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">Plan modules and sidebar access</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{plan?.name ?? 'Subscription Plan'}</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">{includedSectionCount} of {sections.length} sections enabled</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCodes(allCodes)} disabled={loading} className="rounded-md border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-50">
              Enable All
            </button>
            <button type="button" onClick={() => onChange([])} disabled={loading} className="rounded-md border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-50">
              Disable All
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-[var(--shell-subtle)]" />
              ))}
            </div>
          ) : sections.length ? (
            <PlanSectionList sections={sections} enabledCodes={editedCodes} disabled={saving || loading} onChange={onChange} />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--shell-border)] p-10 text-center text-sm text-[var(--shell-muted)]">
              No module permissions found for this plan.
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--shell-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--shell-muted)]">{includedSectionCount} of {sections.length} sections enabled</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--shell-border)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)]">
              Cancel
            </button>
            <button type="button" disabled={saving || loading} onClick={onSubmit} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Modules'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
    </label>
  );
}
