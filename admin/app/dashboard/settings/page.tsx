'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ConfigEntry,
  type ConfigValue,
  type FeatureFlag,
  type FeatureFlagStatus,
  createConfigEntry,
  createFeatureFlag,
  deleteFeatureFlag,
  listConfigEntries,
  listFeatureFlags,
  updateConfigEntry,
  updateFeatureFlag,
} from '../../../services/config.service';
import { getSession } from '../../../services/auth.service';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';
import BrandingPage from './branding/page';
import SecurityPage from './security/page';
import SmsPage from './sms/page';
import ConsentPage from './consent/page';
import AccessPage from './access/page';
import {
  getExamGradingSettings,
  updateExamGradingSettings,
  type ExamGradingSettings,
  type GradeScaleItem,
} from '../../../services/report.service';

type SettingsTabId =
  | 'brand'
  | 'marks-grading'
  | 'security'
  | 'messaging'
  | 'features'
  | 'modules'
  | 'access'
  | 'compliance'
  | 'backups'
  | 'advanced';

type SettingsTab = {
  id: SettingsTabId;
  label: string;
  description: string;
  roles: string[];
};

type FlagDraft = {
  name: string;
  description: string;
  status: FeatureFlagStatus;
};

type ConfigDraft = {
  key: string;
  description: string;
  value: string;
};

const flagKeyPattern = /^[a-z0-9][a-z0-9_-]*$/;
const managedConfigKeys = new Set([
  'platform.general',
  'login.experience',
]);

const settingsTabs: SettingsTab[] = [
  {
    id: 'brand',
    label: 'Branding & Theme',
    description: 'Platform identity, login branding, colors, publish, rollback, and preview.',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'MFA, password policy, sessions, and account security.',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF', 'PARENT'],
  },
  {
    id: 'marks-grading',
    label: 'Marks Grading',
    description: 'Configure grade ranges and exam fail criteria for this school.',
    roles: ['SCHOOL_ADMIN'],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    description: 'Super Admin provider settings for platform and per-school delivery credentials.',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'features',
    label: 'Feature Flags',
    description: 'Platform flags and advanced configuration entries.',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'modules',
    label: 'Modules',
    description: 'Create module flags for attendance, exams, fees, messaging, and reports.',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'access',
    label: 'Access',
    description: 'Role permissions and staff access control.',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Consent records and links to compliance operations.',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'backups',
    label: 'Backups',
    description: 'Backup/restore readiness and operational links.',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Raw JSON configs for rollout and developer settings.',
    roles: ['SUPER_ADMIN'],
  },
];

const moduleCatalog = [
  { key: 'module_attendance', label: 'Attendance', description: 'Attendance pages and related workflows.' },
  { key: 'module_academics', label: 'Academics', description: 'Academic setup, classes, sections, and terms.' },
  { key: 'module_timetable', label: 'Timetable', description: 'Scheduling and timetable management.' },
  { key: 'module_exams', label: 'Exams', description: 'Exams, marks upload, and results workflows.' },
  { key: 'module_fees', label: 'Fees', description: 'Fee collection and finance workflows.' },
  { key: 'module_library', label: 'Library', description: 'Library and book issue workflows.' },
  { key: 'module_transport', label: 'Transport', description: 'Routes, vehicles, and transport assignment.' },
  { key: 'module_support', label: 'Support', description: 'School support tickets and replies.' },
  { key: 'module_reports', label: 'Reports', description: 'Report landing pages and exports.' },
  { key: 'module_messaging', label: 'Messaging', description: 'SMS, notifications, and provider integrations.' },
  { key: 'module_parent_portal', label: 'Parent Portal', description: 'Parent portal access and school-facing communication.' },
  { key: 'module_id_cards', label: 'ID Cards', description: 'Student ID card generation workflows.' },
];

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const parseConfigValue = (raw: string): ConfigValue => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Config value must be valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config value must be a JSON object.');
  }

  return parsed as ConfigValue;
};

const normalizeFlagKey = (value: string) => value.trim().toLowerCase();

const getApiErrorMessage = (error: unknown) => {
  const responseMessage = (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return responseMessage?.error?.message || responseMessage?.message || 'Unable to save settings. Please try again.';
};

const textInputClass =
  'w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const selectClass =
  'w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm font-semibold text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const defaultGradeScale: GradeScaleItem[] = [
  { grade: 'A+', minPercentage: 80, maxPercentage: 100, status: 'PASS' },
  { grade: 'A', minPercentage: 70, maxPercentage: 79, status: 'PASS' },
  { grade: 'B+', minPercentage: 60, maxPercentage: 69, status: 'PASS' },
  { grade: 'B', minPercentage: 50, maxPercentage: 59, status: 'PASS' },
  { grade: 'C', minPercentage: 40, maxPercentage: 49, status: 'PASS' },
  { grade: 'D', minPercentage: 33, maxPercentage: 39, status: 'PASS' },
  { grade: 'F', minPercentage: 0, maxPercentage: 32, status: 'FAIL' },
];

function BrandThemeSettingsTab() {
  return (
    <div className="space-y-5">
      <BrandingPage embedded />
    </div>
  );
}

function MarksGradingSettingsTab() {
  const queryClient = useQueryClient();
  const [activeMode, setActiveMode] = useState<'grades' | 'fail'>('grades');
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>(defaultGradeScale);
  const [failCriteria, setFailCriteria] = useState<ExamGradingSettings['failCriteria']>({
    overallPercentage: 40,
    subjectPercentage: 33,
    minimumFailedSubjects: 1,
  });
  const [message, setMessage] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['exam-grading-settings'],
    queryFn: getExamGradingSettings,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setGradeScale(settingsQuery.data.gradeScale.length ? settingsQuery.data.gradeScale : defaultGradeScale);
    setFailCriteria(settingsQuery.data.failCriteria);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateExamGradingSettings,
    onSuccess: (next) => {
      setGradeScale(next.gradeScale);
      setFailCriteria(next.failCriteria);
      setMessage(`Marks grading saved. ${next.recalculatedMarks ?? 0} existing marks recalculated.`);
      queryClient.invalidateQueries({ queryKey: ['exam-grading-settings'] });
    },
    onError: (error) => {
      window.alert(getApiErrorMessage(error));
    },
  });

  const updateGradeRow = <K extends keyof GradeScaleItem>(index: number, key: K, value: GradeScaleItem[K]) => {
    setMessage('');
    setGradeScale((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const validateSettings = () => {
    if (!gradeScale.length) return 'At least one grading row is required.';
    const cleaned = gradeScale.map((row) => ({
      ...row,
      grade: row.grade.trim(),
      minPercentage: Number(row.minPercentage),
      maxPercentage: Number(row.maxPercentage),
    }));

    for (const row of cleaned) {
      if (!row.grade) return 'Grade name is required.';
      if (!Number.isFinite(row.minPercentage) || !Number.isFinite(row.maxPercentage)) return 'Grade percentages must be valid numbers.';
      if (row.minPercentage < 0 || row.maxPercentage > 100) return 'Grade percentages must be between 0 and 100.';
      if (row.maxPercentage < row.minPercentage) return '% Upto must be greater than or equal to % From.';
    }

    const sorted = [...cleaned].sort((a, b) => a.minPercentage - b.minPercentage);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].minPercentage <= sorted[index - 1].maxPercentage) {
        return `Grade ranges overlap: ${sorted[index - 1].grade} and ${sorted[index].grade}.`;
      }
    }

    if (
      failCriteria.overallPercentage < 0 ||
      failCriteria.overallPercentage > 100 ||
      failCriteria.subjectPercentage < 0 ||
      failCriteria.subjectPercentage > 100
    ) {
      return 'Fail criteria percentages must be between 0 and 100.';
    }
    if (!Number.isInteger(failCriteria.minimumFailedSubjects) || failCriteria.minimumFailedSubjects < 1) {
      return 'No. of subjects must be at least 1.';
    }
    return '';
  };

  const save = () => {
    const error = validateSettings();
    if (error) {
      window.alert(error);
      return;
    }
    saveMutation.mutate({
      gradeScale: gradeScale.map((row) => ({
        grade: row.grade.trim(),
        minPercentage: Number(row.minPercentage),
        maxPercentage: Number(row.maxPercentage),
        status: row.status,
      })),
      failCriteria,
    });
  };

  const addGrade = () => {
    setMessage('');
    setGradeScale((current) => [...current, { grade: '', minPercentage: 0, maxPercentage: 0, status: 'PASS' }]);
  };

  const removeGrade = (index: number) => {
    if (gradeScale.length <= 1) {
      window.alert('At least one grading row is required.');
      return;
    }
    setMessage('');
    setGradeScale((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  if (settingsQuery.isLoading) return <FullPageLoader label="Loading marks grading..." />;

  return (
    <div className="space-y-5">
      {saveMutation.isPending ? <FullPageLoader label="Saving marks grading..." /> : null}
      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Exam Grading</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">
              School Admin controls grade ranges and fail criteria for this school only.
            </p>
          </div>
          <div className="flex rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-1">
            <button
              type="button"
              onClick={() => setActiveMode('grades')}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${activeMode === 'grades' ? 'bg-blue-600 text-white' : 'text-[var(--shell-muted)] hover:text-[var(--shell-text)]'}`}
            >
              Marks Grading
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('fail')}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${activeMode === 'fail' ? 'bg-blue-600 text-white' : 'text-[var(--shell-muted)] hover:text-[var(--shell-text)]'}`}
            >
              Fail Criteria
            </button>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      </section>

      {activeMode === 'grades' ? (
        <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-[var(--shell-text)]">Customize Grading</h3>
              <p className="mt-1 text-sm text-[var(--shell-muted)]">Ranges are based on percentage scored in each paper.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addGrade}>Add Grade</Button>
          </div>

          <div className="space-y-3">
            {gradeScale.map((row, index) => (
              <div key={`${row.grade}-${index}`} className="grid gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-3 md:grid-cols-[1fr_120px_120px_140px_auto] md:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-[var(--shell-muted)]">Grade</span>
                  <input className={textInputClass} value={row.grade} onChange={(event) => updateGradeRow(index, 'grade', event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-[var(--shell-muted)]">% From</span>
                  <input className={textInputClass} type="number" min={0} max={100} value={row.minPercentage} onChange={(event) => updateGradeRow(index, 'minPercentage', Number(event.target.value))} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-[var(--shell-muted)]">% Upto</span>
                  <input className={textInputClass} type="number" min={0} max={100} value={row.maxPercentage} onChange={(event) => updateGradeRow(index, 'maxPercentage', Number(event.target.value))} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-[var(--shell-muted)]">Status</span>
                  <select className={selectClass} value={row.status} onChange={(event) => updateGradeRow(index, 'status', event.target.value as GradeScaleItem['status'])}>
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => removeGrade(index)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
          <h3 className="text-base font-bold text-[var(--shell-text)]">Fail Criteria</h3>
          <p className="mt-1 text-sm text-[var(--shell-muted)]">
            A student is marked failed when the overall percentage is at or below the overall limit, or when subject percentage is at or below the subject limit in the configured number of subjects.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--shell-text)]">Overall %</span>
              <input
                className={textInputClass}
                type="number"
                min={0}
                max={100}
                value={failCriteria.overallPercentage}
                onChange={(event) => setFailCriteria((current) => ({ ...current, overallPercentage: Number(event.target.value) }))}
                placeholder="Example 40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--shell-text)]">Subject %</span>
              <input
                className={textInputClass}
                type="number"
                min={0}
                max={100}
                value={failCriteria.subjectPercentage}
                onChange={(event) => setFailCriteria((current) => ({ ...current, subjectPercentage: Number(event.target.value) }))}
                placeholder="Example 33"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--shell-text)]">No. of Subjects</span>
              <input
                className={textInputClass}
                type="number"
                min={1}
                max={20}
                value={failCriteria.minimumFailedSubjects}
                onChange={(event) => setFailCriteria((current) => ({ ...current, minimumFailedSubjects: Number(event.target.value) }))}
                placeholder="Example 1"
              />
            </label>
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} loading={saveMutation.isPending} disabled={saveMutation.isPending}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function FeatureConfigSettingsTab({ advancedOnly = false }: { advancedOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [flagForm, setFlagForm] = useState({
    key: '',
    name: '',
    description: '',
    status: 'ENABLED' as FeatureFlagStatus,
  });
  const [configForm, setConfigForm] = useState({ key: '', value: '{}', description: '' });
  const [flagDrafts, setFlagDrafts] = useState<Record<string, FlagDraft>>({});
  const [configDrafts, setConfigDrafts] = useState<Record<string, ConfigDraft>>({});
  const [flagError, setFlagError] = useState('');
  const [configError, setConfigError] = useState('');

  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: listFeatureFlags,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const configsQuery = useQuery({
    queryKey: ['config-entries'],
    queryFn: listConfigEntries,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const refreshFlags = () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
  const refreshConfigs = () => queryClient.invalidateQueries({ queryKey: ['config-entries'] });

  const createFlagMutation = useMutation({
    mutationFn: createFeatureFlag,
    onSuccess: () => {
      setFlagForm({ key: '', name: '', description: '', status: 'ENABLED' });
      setFlagError('');
      refreshFlags();
    },
    onError: (error) => setFlagError(getApiErrorMessage(error)),
  });

  const updateFlagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<FeatureFlag> }) => updateFeatureFlag(id, payload),
    onSuccess: () => {
      setFlagError('');
      refreshFlags();
    },
    onError: (error) => setFlagError(getApiErrorMessage(error)),
  });

  const deleteFlagMutation = useMutation({
    mutationFn: deleteFeatureFlag,
    onSuccess: () => {
      setFlagError('');
      refreshFlags();
    },
    onError: (error) => setFlagError(getApiErrorMessage(error)),
  });

  const createConfigMutation = useMutation({
    mutationFn: createConfigEntry,
    onSuccess: () => {
      setConfigForm({ key: '', value: '{}', description: '' });
      setConfigError('');
      refreshConfigs();
    },
    onError: (error) => setConfigError(getApiErrorMessage(error)),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ConfigEntry> }) => updateConfigEntry(id, payload),
    onSuccess: () => {
      setConfigError('');
      refreshConfigs();
    },
    onError: (error) => setConfigError(getApiErrorMessage(error)),
  });

  const isBusy =
    createFlagMutation.isPending ||
    updateFlagMutation.isPending ||
    deleteFlagMutation.isPending ||
    createConfigMutation.isPending ||
    updateConfigMutation.isPending;

  const flags = flagsQuery.data ?? [];
  const configs = (configsQuery.data ?? []).filter((config) => !managedConfigKeys.has(config.key));

  const getFlagDraft = (flag: FeatureFlag): FlagDraft =>
    flagDrafts[flag.id] ?? {
      name: flag.name ?? '',
      description: flag.description ?? '',
      status: flag.status,
    };

  const updateFlagDraft = (flag: FeatureFlag, changes: Partial<FlagDraft>) => {
    setFlagDrafts((current) => ({
      ...current,
      [flag.id]: { ...getFlagDraft(flag), ...changes },
    }));
  };

  const getConfigDraft = (config: ConfigEntry): ConfigDraft =>
    configDrafts[config.id] ?? {
      key: config.key,
      description: config.description ?? '',
      value: formatJson(config.value),
    };

  const updateConfigDraft = (config: ConfigEntry, changes: Partial<ConfigDraft>) => {
    setConfigDrafts((current) => ({
      ...current,
      [config.id]: { ...getConfigDraft(config), ...changes },
    }));
  };

  const handleCreateFlag = () => {
    const key = normalizeFlagKey(flagForm.key);
    if (!key) {
      setFlagError('Feature flag key is required.');
      return;
    }
    if (!flagKeyPattern.test(key)) {
      setFlagError('Feature flag key must use lowercase letters, numbers, hyphens, or underscores.');
      return;
    }
    setFlagError('');
    createFlagMutation.mutate({
      key,
      name: flagForm.name.trim() || undefined,
      description: flagForm.description.trim() || undefined,
      status: flagForm.status,
    });
  };

  const handleSaveFlag = (flag: FeatureFlag) => {
    const draft = getFlagDraft(flag);
    updateFlagMutation.mutate({
      id: flag.id,
      payload: {
        name: draft.name.trim() || null,
        description: draft.description.trim() || null,
        status: draft.status,
      },
    });
  };

  const handleToggleFlag = (flag: FeatureFlag) => {
    updateFlagMutation.mutate({
      id: flag.id,
      payload: { status: flag.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' },
    });
  };

  const handleCreateConfig = () => {
    const key = configForm.key.trim();
    if (!key) {
      setConfigError('Config key is required.');
      return;
    }

    let value: ConfigValue;
    try {
      value = parseConfigValue(configForm.value);
    } catch (error) {
      setConfigError((error as Error).message);
      return;
    }

    setConfigError('');
    createConfigMutation.mutate({
      key,
      description: configForm.description.trim() || undefined,
      value,
    });
  };

  const handleSaveConfig = (config: ConfigEntry) => {
    const draft = getConfigDraft(config);
    if (!draft.key.trim()) {
      setConfigError('Config key is required.');
      return;
    }

    let value: ConfigValue;
    try {
      value = parseConfigValue(draft.value);
    } catch (error) {
      setConfigError((error as Error).message);
      return;
    }

    setConfigError('');
    updateConfigMutation.mutate({
      id: config.id,
      payload: {
        key: draft.key.trim(),
        description: draft.description.trim() || null,
        value,
      },
    });
  };

  return (
    <div className="space-y-5">
      {isBusy ? <FullPageLoader label="Processing..." /> : null}
      {!advancedOnly ? (
        <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Feature Flags</h2>
            <p className="text-sm text-[var(--shell-muted)]">Toggle global feature behavior and module readiness.</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <input
              value={flagForm.key}
              onChange={(event) => setFlagForm({ ...flagForm, key: normalizeFlagKey(event.target.value) })}
              placeholder="Feature key"
              className={textInputClass}
            />
            <input
              value={flagForm.name}
              onChange={(event) => setFlagForm({ ...flagForm, name: event.target.value })}
              placeholder="Name"
              className={textInputClass}
            />
            <input
              value={flagForm.description}
              onChange={(event) => setFlagForm({ ...flagForm, description: event.target.value })}
              placeholder="Description"
              className={textInputClass}
            />
            <select
              value={flagForm.status}
              onChange={(event) => setFlagForm({ ...flagForm, status: event.target.value as FeatureFlagStatus })}
              className={selectClass}
            >
              <option value="ENABLED">Enabled</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>

          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={handleCreateFlag} disabled={createFlagMutation.isPending} loading={createFlagMutation.isPending}>
              Create Flag
            </Button>
          </div>
          {flagError ? <p className="mt-3 text-sm font-semibold text-rose-600">{flagError}</p> : null}

          <div className="mt-5 space-y-3">
            {flagsQuery.isLoading ? <div className="h-16 animate-pulse rounded-xl bg-[var(--shell-hover)]" /> : null}
            {flags.map((flag) => {
              const draft = getFlagDraft(flag);
              const isEnabled = flag.status === 'ENABLED';

              return (
                <div key={flag.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="mb-3 flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <div>
                          <p className="text-sm font-bold text-[var(--shell-text)]">{flag.key}</p>
                          <p className="text-xs text-[var(--shell-muted)]">{flag.status}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={draft.name}
                          onChange={(event) => updateFlagDraft(flag, { name: event.target.value })}
                          placeholder="Name"
                          className={textInputClass}
                        />
                        <input
                          value={draft.description}
                          onChange={(event) => updateFlagDraft(flag, { description: event.target.value })}
                          placeholder="Description"
                          className={textInputClass}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                          isEnabled
                            ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                        onClick={() => handleToggleFlag(flag)}
                      >
                        {isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="rounded-lg border border-[var(--shell-border)] px-3 py-2 text-xs font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                        onClick={() => handleSaveFlag(flag)}
                      >
                        Save
                      </button>
                      <button
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          if (window.confirm(`Delete feature flag "${flag.key}"?`)) {
                            deleteFlagMutation.mutate(flag.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!flagsQuery.isLoading && !flags.length ? (
              <div className="rounded-xl border border-dashed border-[var(--shell-border)] p-6 text-center text-sm text-[var(--shell-muted)]">
                No feature flags found.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-[var(--shell-text)]">Config Entries</h2>
          <p className="text-sm text-[var(--shell-muted)]">Manage system configuration values as JSON objects.</p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_2fr]">
          <input
            value={configForm.key}
            onChange={(event) => setConfigForm({ ...configForm, key: event.target.value })}
            placeholder="Key"
            className={textInputClass}
          />
          <input
            value={configForm.description}
            onChange={(event) => setConfigForm({ ...configForm, description: event.target.value })}
            placeholder="Description"
            className={textInputClass}
          />
          <textarea
            value={configForm.value}
            onChange={(event) => setConfigForm({ ...configForm, value: event.target.value })}
            placeholder='{"enabled": true}'
            rows={4}
            className={`${textInputClass} font-mono`}
          />
        </div>

        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={handleCreateConfig} disabled={createConfigMutation.isPending} loading={createConfigMutation.isPending}>
            Create Config
          </Button>
        </div>
        {configError ? <p className="mt-3 text-sm font-semibold text-rose-600">{configError}</p> : null}

        <div className="mt-5 space-y-3">
          {configsQuery.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-[var(--shell-hover)]" /> : null}
          {configs.map((config) => {
            const draft = getConfigDraft(config);
            return (
              <div key={config.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-start">
                  <input
                    value={draft.key}
                    onChange={(event) => updateConfigDraft(config, { key: event.target.value })}
                    className={textInputClass}
                  />
                  <input
                    value={draft.description}
                    onChange={(event) => updateConfigDraft(config, { description: event.target.value })}
                    placeholder="Description"
                    className={textInputClass}
                  />
                  <textarea
                    value={draft.value}
                    onChange={(event) => updateConfigDraft(config, { value: event.target.value })}
                    rows={5}
                    className={`${textInputClass} font-mono text-xs`}
                  />
                  <button
                    className="rounded-lg border border-[var(--shell-border)] px-3 py-2 text-xs font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                    onClick={() => handleSaveConfig(config)}
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
          {!configsQuery.isLoading && !configs.length ? (
            <div className="rounded-xl border border-dashed border-[var(--shell-border)] p-6 text-center text-sm text-[var(--shell-muted)]">
              No config entries found.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ModuleSettingsTab() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: listFeatureFlags,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createFeatureFlag,
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeatureFlagStatus }) => updateFeatureFlag(id, { status }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  const flagsByKey = useMemo(() => new Map((flagsQuery.data ?? []).map((flag) => [flag.key, flag])), [flagsQuery.data]);

  const toggleModule = (module: (typeof moduleCatalog)[number]) => {
    const flag = flagsByKey.get(module.key);
    if (!flag) {
      createMutation.mutate({
        key: module.key,
        name: module.label,
        description: module.description,
        status: 'ENABLED',
      });
      return;
    }
    updateMutation.mutate({
      id: flag.id,
      status: flag.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
    });
  };

  return (
    <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      {(createMutation.isPending || updateMutation.isPending) ? <FullPageLoader label="Saving module setting..." /> : null}
      <div>
        <h2 className="text-lg font-bold text-[var(--shell-text)]">Module Settings</h2>
        <p className="mt-1 text-sm text-[var(--shell-muted)]">
          Module switches are stored as feature flags. Pages that already check these flags will follow the saved state.
        </p>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {moduleCatalog.map((module) => {
          const flag = flagsByKey.get(module.key);
          const enabled = flag?.status === 'ENABLED';
          const created = Boolean(flag);
          return (
            <div key={module.key} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--shell-text)]">{module.label}</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--shell-muted)]">{module.description}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {enabled ? 'Enabled' : created ? 'Disabled' : 'Not created'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleModule(module)}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="mt-4 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enabled ? 'Disable Module' : 'Enable Module'}
              </button>
              <p className="mt-2 text-[11px] font-semibold text-[var(--shell-muted)]">{module.key}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SuperAdminAccessTab() {
  return (
    <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[var(--shell-text)]">Access Control</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--shell-muted)]">
        Employee permission assignment is school-scoped. Open a school admin workspace or use Global Users for platform-level account security.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/users"
          className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3 text-sm font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
        >
          Global User Management
        </Link>
        <Link
          href="/dashboard/schools"
          className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3 text-sm font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
        >
          Open School Workspaces
        </Link>
      </div>
    </section>
  );
}

function OperationsLinkTab({ type }: { type: 'compliance' | 'backups' }) {
  const isCompliance = type === 'compliance';
  return (
    <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[var(--shell-text)]">{isCompliance ? 'Compliance Settings' : 'Backup & Restore Settings'}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--shell-muted)]">
        {isCompliance
          ? 'Consent records are available here, while operational export/deletion workflows are managed from the Compliance page.'
          : 'Backup execution and restore operations are managed from the dedicated Backups & Restore page.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {isCompliance ? (
          <>
            <Link
              href="/dashboard/compliance"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Open Compliance Operations
            </Link>
            <ConsentPage />
          </>
        ) : (
          <Link
            href="/dashboard/backups"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Open Backups & Restore
          </Link>
        )}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTabParam = searchParams.get('tab') || 'brand';
  const requestedTab = (['general', 'branding', 'login', 'theme'].includes(requestedTabParam) ? 'brand' : requestedTabParam) as SettingsTabId;

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const role = session?.role ?? null;
  const availableTabs = useMemo(
    () => settingsTabs.filter((tab) => (role ? tab.roles.includes(role) : false)),
    [role],
  );
  const activeTab = availableTabs.some((tab) => tab.id === requestedTab) ? requestedTab : availableTabs[0]?.id;
  const activeTabMeta = availableTabs.find((tab) => tab.id === activeTab);

  useEffect(() => {
    if (!role || !availableTabs.length) return;
    if (!activeTab || requestedTab !== activeTab) {
      router.replace(`/dashboard/settings?tab=${activeTab ?? 'security'}`);
    }
  }, [activeTab, availableTabs.length, requestedTab, role, router]);

  if (isLoading) {
    return <FullPageLoader label="Loading settings..." />;
  }

  if (!role || !availableTabs.length) {
    return (
      <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center">
        <h1 className="text-xl font-bold text-[var(--shell-text)]">Settings Not Available</h1>
        <p className="mt-2 text-sm text-[var(--shell-muted)]">Your account does not have access to settings.</p>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'brand':
        return <BrandThemeSettingsTab />;
      case 'marks-grading':
        return <MarksGradingSettingsTab />;
      case 'security':
        return <SecurityPage />;
      case 'messaging':
        return <SmsPage />;
      case 'features':
        return <FeatureConfigSettingsTab />;
      case 'modules':
        return <ModuleSettingsTab />;
      case 'access':
        return role === 'SUPER_ADMIN' ? <SuperAdminAccessTab /> : <AccessPage />;
      case 'compliance':
        return <OperationsLinkTab type="compliance" />;
      case 'backups':
        return <OperationsLinkTab type="backups" />;
      case 'advanced':
        return <FeatureConfigSettingsTab advancedOnly />;
      default:
        return <BrandThemeSettingsTab />;
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Settings"
        subtitle="One workspace for branding, theme, security, modules, messaging, and advanced configuration."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
          ...(activeTabMeta ? [{ label: activeTabMeta.label }] : []),
        ]}
      />

      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {availableTabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => router.push(`/dashboard/settings?tab=${tab.id}`)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
                }`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-1 block text-xs leading-4 ${active ? 'text-blue-700' : 'text-[var(--shell-muted)]'}`}>
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {renderActiveTab()}
    </div>
  );
}
