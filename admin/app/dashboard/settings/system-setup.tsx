'use client';

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import {
  type BaseSetups,
  type FeeChallanBankSetting,
  type GeneralSchoolSettings,
  type HolidaySetting,
  type PaymentGatewaySettings,
  type SchoolSessionSetting,
  type SmsSystemSettings,
  getSchoolSystemSettings,
  updateSchoolSystemSettings,
} from '../../../services/system-settings.service';

export type SetupSection =
  | 'general'
  | 'payments'
  | 'roles'
  | 'base'
  | 'sessions'
  | 'holidays'
  | 'sms'
  | 'fee-challan';

const inputClass =
  'w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm font-semibold text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const subtleButtonClass =
  'rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-xs font-bold text-[var(--shell-text)] transition-colors hover:bg-[var(--shell-hover)]';

const primaryButtonClass =
  'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';

const dangerButtonClass =
  'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100';

const setupTabs: Array<{ id: SetupSection; label: string; metric: string }> = [
  { id: 'general', label: 'General', metric: 'Institution' },
  { id: 'payments', label: 'Payments', metric: 'Gateways' },
  { id: 'roles', label: 'Roles', metric: 'Permissions' },
  { id: 'base', label: 'Base Setup', metric: 'Master data' },
  { id: 'sessions', label: 'Sessions', metric: 'Terms' },
  { id: 'holidays', label: 'Holidays', metric: 'Calendar' },
  { id: 'sms', label: 'SMS', metric: 'Providers' },
  { id: 'fee-challan', label: 'Fee Challan', metric: 'Banks' },
];

type SystemSetupTabProps = {
  section?: SetupSection;
  showOverview?: boolean;
  showSectionMenu?: boolean;
};

const currencyOptions = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'BDT', symbol: 'Tk', name: 'Bangladeshi Taka' },
  { code: 'INR', symbol: 'Rs', name: 'Indian Rupee' },
  { code: 'EUR', symbol: 'EUR', name: 'Euro' },
  { code: 'GBP', symbol: 'GBP', name: 'British Pound' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: 'JPY', name: 'Japanese Yen' },
];

const languageOptions = ['English', 'Bangla', 'Hindi', 'Arabic', 'French', 'Spanish', 'Urdu'];
const dateFormatOptions = ['DD MMMM, YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'D MMM, YYYY'];
const bankLogoMaxBytes = 500 * 1024;
const bankLogoMimeTypes = ['image/jpeg', 'image/png'];

const emptyFeeChallanBankDraft: FeeChallanBankSetting = {
  id: '',
  bankName: '',
  branchAddress: '',
  accountNumber: '',
  instructions: '',
  logoDataUrl: '',
  logoFileName: '',
  logoMimeType: '',
  logoSize: 0,
  isActive: true,
};

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;

const countBaseItems = (baseSetups: BaseSetups) =>
  Object.values(baseSetups).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);

const formatFileSize = (value: number) => {
  if (!value) return '0 KB';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Unable to read bank logo.'));
    reader.readAsDataURL(file);
  });

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--shell-muted)]">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SectionPanel({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--shell-text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-5 text-[var(--shell-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      {label ?? (active ? 'Active' : 'Inactive')}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--shell-border)] p-6 text-center text-sm font-semibold text-[var(--shell-muted)]">
      {label}
    </div>
  );
}

function ActionIcon({ name, className = 'h-4 w-4' }: { name: 'edit' | 'trash' | 'plus' | 'x'; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'edit') {
    return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
  }

  if (name === 'trash') {
    return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 18h10l1-18" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
  }

  if (name === 'plus') {
    return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  }

  return <svg {...common}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
}

export default function SystemSetupTab({
  section = 'general',
  showOverview = true,
  showSectionMenu = true,
}: SystemSetupTabProps = {}) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SetupSection>(section);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [general, setGeneral] = useState<GeneralSchoolSettings | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewaySettings[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState('paypal');
  const [baseSetups, setBaseSetups] = useState<BaseSetups>({ gender: [], religion: [], bloodGroup: [] });
  const [newBaseValues, setNewBaseValues] = useState<Record<keyof BaseSetups, string>>({
    gender: '',
    religion: '',
    bloodGroup: '',
  });
  const [sessions, setSessions] = useState<SchoolSessionSetting[]>([]);
  const [sessionDraft, setSessionDraft] = useState('');
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  const [holidayDraft, setHolidayDraft] = useState<HolidaySetting>({
    id: '',
    title: '',
    fromDate: '',
    toDate: '',
    details: '',
  });
  const [smsSettings, setSmsSettings] = useState<SmsSystemSettings | null>(null);
  const [feeChallanBanks, setFeeChallanBanks] = useState<FeeChallanBankSetting[]>([]);
  const [feeChallanBankDraft, setFeeChallanBankDraft] = useState<FeeChallanBankSetting>({ ...emptyFeeChallanBankDraft });
  const [bankLogoError, setBankLogoError] = useState('');

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const schoolScopeReady = Boolean(isSchoolAdmin || (isSuperAdmin && selectedSchoolId));
  const schoolParams = isSuperAdmin && selectedSchoolId ? { schoolId: selectedSchoolId } : undefined;

  const schoolsQuery = useQuery({
    queryKey: ['system-setup-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: Boolean(isSuperAdmin),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const settingsQuery = useQuery({
    queryKey: ['school-system-settings', isSuperAdmin ? selectedSchoolId : session?.schoolId],
    queryFn: () => getSchoolSystemSettings(schoolParams),
    enabled: schoolScopeReady,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setGeneral(data.general);
    setPaymentGateways(data.paymentGateways);
    setSelectedGatewayId(data.paymentGateways.find((gateway) => gateway.enabled)?.id ?? data.paymentGateways[0]?.id ?? 'paypal');
    setBaseSetups(data.baseSetups);
    setSessions(data.sessions);
    setHolidays(data.holidays);
    setSmsSettings(data.smsSettings);
    setFeeChallanBanks(data.feeChallanBanks ?? []);
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateSchoolSystemSettings,
    onSuccess: (next) => {
      setGeneral(next.general);
      setPaymentGateways(next.paymentGateways);
      setBaseSetups(next.baseSetups);
      setSessions(next.sessions);
      setHolidays(next.holidays);
      setSmsSettings(next.smsSettings);
      setFeeChallanBanks(next.feeChallanBanks ?? []);
      setMessage('System settings saved.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['school-system-settings'] });
    },
    onError: (mutationError: any) => {
      setMessage('');
      setError(mutationError?.response?.data?.error?.message || mutationError?.response?.data?.message || 'Unable to save system settings.');
    },
  });

  const busy =
    sessionLoading ||
    settingsQuery.isLoading ||
    updateMutation.isPending;

  const selectedGateway = paymentGateways.find((gateway) => gateway.id === selectedGatewayId) ?? paymentGateways[0];
  const enabledGateways = paymentGateways.filter((gateway) => gateway.enabled).length;
  const sessionChoices = Array.from(
    new Set([general?.currentSession, ...sessions.map((item) => item.title)].filter((item): item is string => Boolean(item))),
  );

  const saveSettings = (payload: Parameters<typeof updateSchoolSystemSettings>[0]) => {
    if (!schoolScopeReady) {
      setError('Select a school before saving settings.');
      return;
    }
    updateMutation.mutate({ ...payload, ...(schoolParams ?? {}) });
  };

  const updateGeneralField = <K extends keyof GeneralSchoolSettings>(key: K, value: GeneralSchoolSettings[K]) => {
    setGeneral((current) => (current ? { ...current, [key]: value } : current));
    if (key === 'currency') {
      const currency = currencyOptions.find((item) => item.code === value);
      if (currency) {
        setGeneral((current) => (current ? { ...current, currency: currency.code, currencySymbol: currency.symbol } : current));
      }
    }
  };

  const updateGateway = (id: string, patch: Partial<PaymentGatewaySettings>) => {
    setPaymentGateways((current) => current.map((gateway) => (gateway.id === id ? { ...gateway, ...patch } : gateway)));
  };

  const switchGateway = (id: string) => {
    setSelectedGatewayId(id);
    setPaymentGateways((current) => current.map((gateway) => ({ ...gateway, enabled: gateway.id === id })));
  };

  const addBaseItem = (group: keyof BaseSetups) => {
    const value = newBaseValues[group].trim();
    if (!value) return;
    setBaseSetups((current) => ({ ...current, [group]: [...current[group], value] }));
    setNewBaseValues((current) => ({ ...current, [group]: '' }));
  };

  const updateBaseItem = (group: keyof BaseSetups, index: number, value: string) => {
    setBaseSetups((current) => ({
      ...current,
      [group]: current[group].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const removeBaseItem = (group: keyof BaseSetups, index: number) => {
    setBaseSetups((current) => ({
      ...current,
      [group]: current[group].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addSession = () => {
    const title = sessionDraft.trim();
    if (!title) return;
    setSessions((current) => [...current, { id: newId('session'), title, isActive: current.length === 0 }]);
    setSessionDraft('');
  };

  const markSessionActive = (id: string) => {
    setSessions((current) => current.map((item) => ({ ...item, isActive: item.id === id })));
  };

  const removeSession = (id: string) => {
    setSessions((current) => current.filter((item) => item.id !== id));
  };

  const editHoliday = (holiday: HolidaySetting) => {
    setHolidayDraft(holiday);
  };

  const saveHolidayDraft = () => {
    if (!holidayDraft.title.trim() || !holidayDraft.fromDate || !holidayDraft.toDate) return;
    const nextHoliday = {
      ...holidayDraft,
      id: holidayDraft.id || newId('holiday'),
      details: holidayDraft.details.trim(),
    };
    setHolidays((current) => {
      const exists = current.some((item) => item.id === nextHoliday.id);
      return exists ? current.map((item) => (item.id === nextHoliday.id ? nextHoliday : item)) : [...current, nextHoliday];
    });
    setHolidayDraft({ id: '', title: '', fromDate: '', toDate: '', details: '' });
  };

  const removeHoliday = (id: string) => {
    setHolidays((current) => current.filter((holiday) => holiday.id !== id));
  };

  const updateSmsProvider = (provider: SmsSystemSettings['activeProvider']) => {
    setSmsSettings((current) => (current ? { ...current, activeProvider: provider } : current));
  };

  const updateFeeChallanDraft = <K extends keyof FeeChallanBankSetting>(key: K, value: FeeChallanBankSetting[K]) => {
    setFeeChallanBankDraft((current) => ({ ...current, [key]: value }));
  };

  const handleBankLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!bankLogoMimeTypes.includes(file.type)) {
      setBankLogoError('Only JPG and PNG bank logos are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > bankLogoMaxBytes) {
      setBankLogoError('Bank logo must be 500KB or smaller.');
      event.target.value = '';
      return;
    }

    try {
      const logoDataUrl = await fileToDataUrl(file);
      setBankLogoError('');
      setFeeChallanBankDraft((current) => ({
        ...current,
        logoDataUrl,
        logoFileName: file.name,
        logoMimeType: file.type,
        logoSize: file.size,
      }));
    } catch (fileError) {
      setBankLogoError((fileError as Error).message || 'Unable to read bank logo.');
    }
  };

  const resetFeeChallanDraft = () => {
    setFeeChallanBankDraft({ ...emptyFeeChallanBankDraft });
    setBankLogoError('');
  };

  const persistFeeChallanBanks = (nextBanks: FeeChallanBankSetting[]) => {
    setFeeChallanBanks(nextBanks);
    saveSettings({ feeChallanBanks: nextBanks });
  };

  const saveFeeChallanBank = () => {
    const nextBank: FeeChallanBankSetting = {
      ...feeChallanBankDraft,
      id: feeChallanBankDraft.id || newId('challan-bank'),
      bankName: feeChallanBankDraft.bankName.trim(),
      branchAddress: feeChallanBankDraft.branchAddress.trim(),
      accountNumber: feeChallanBankDraft.accountNumber.trim(),
      instructions: feeChallanBankDraft.instructions.trim(),
      isActive: Boolean(feeChallanBankDraft.isActive),
    };

    if (!nextBank.logoDataUrl || !nextBank.bankName || !nextBank.branchAddress || !nextBank.accountNumber) {
      setMessage('');
      setError('Bank logo, bank name, branch address, and account number are required.');
      return;
    }

    const exists = feeChallanBanks.some((bank) => bank.id === nextBank.id);
    const nextBanks = exists
      ? feeChallanBanks.map((bank) => (bank.id === nextBank.id ? nextBank : bank))
      : [nextBank, ...feeChallanBanks];

    resetFeeChallanDraft();
    persistFeeChallanBanks(nextBanks);
  };

  const editFeeChallanBank = (bank: FeeChallanBankSetting) => {
    setFeeChallanBankDraft(bank);
    setBankLogoError('');
  };

  const deleteFeeChallanBank = (id: string) => {
    if (!window.confirm('Delete this fee challan bank?')) return;
    persistFeeChallanBanks(feeChallanBanks.filter((bank) => bank.id !== id));
    if (feeChallanBankDraft.id === id) resetFeeChallanDraft();
  };

  const toggleFeeChallanBank = (id: string) => {
    persistFeeChallanBanks(
      feeChallanBanks.map((bank) => (bank.id === id ? { ...bank, isActive: !bank.isActive } : bank)),
    );
  };

  const renderGatewayFields = () => {
    if (!selectedGateway) return null;
    const commonFields = (
      <>
        <Field label="Mode">
          <select className={inputClass} value={selectedGateway.mode} onChange={(event) => updateGateway(selectedGateway.id, { mode: event.target.value })}>
            <option value="test">Test</option>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
        </Field>
        <label className="flex items-center gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3 text-sm font-bold text-[var(--shell-text)]">
          <input
            type="checkbox"
            checked={selectedGateway.enabled}
            onChange={(event) => updateGateway(selectedGateway.id, { enabled: event.target.checked })}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </>
    );

    if (selectedGateway.id === 'paypal') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="PayPal username" required>
            <input className={inputClass} value={selectedGateway.username ?? ''} onChange={(event) => updateGateway('paypal', { username: event.target.value })} />
          </Field>
          <Field label="PayPal client ID">
            <input className={inputClass} value={selectedGateway.clientId ?? ''} onChange={(event) => updateGateway('paypal', { clientId: event.target.value })} />
          </Field>
          <Field label="PayPal secret ID">
            <input type="password" className={inputClass} value={selectedGateway.secretId ?? ''} onChange={(event) => updateGateway('paypal', { secretId: event.target.value })} />
          </Field>
          <Field label="PayPal signature">
            <input type="password" className={inputClass} value={selectedGateway.signature ?? ''} onChange={(event) => updateGateway('paypal', { signature: event.target.value })} />
          </Field>
          {commonFields}
        </div>
      );
    }

    if (selectedGateway.id === 'stripe') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Stripe publishable key" required>
            <input className={inputClass} value={selectedGateway.publishableKey ?? ''} onChange={(event) => updateGateway('stripe', { publishableKey: event.target.value })} />
          </Field>
          <Field label="Stripe API secret key" required>
            <input type="password" className={inputClass} value={selectedGateway.secretKey ?? ''} onChange={(event) => updateGateway('stripe', { secretKey: event.target.value })} />
          </Field>
          <Field label="Webhook secret">
            <input type="password" className={inputClass} value={selectedGateway.webhookSecret ?? ''} onChange={(event) => updateGateway('stripe', { webhookSecret: event.target.value })} />
          </Field>
          {commonFields}
        </div>
      );
    }

    if (selectedGateway.id === 'payumoney') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Merchant key" required>
            <input className={inputClass} value={selectedGateway.merchantKey ?? ''} onChange={(event) => updateGateway('payumoney', { merchantKey: event.target.value })} />
          </Field>
          <Field label="Merchant salt" required>
            <input type="password" className={inputClass} value={selectedGateway.merchantSalt ?? ''} onChange={(event) => updateGateway('payumoney', { merchantSalt: event.target.value })} />
          </Field>
          {commonFields}
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Merchant email" required>
          <input className={inputClass} value={selectedGateway.merchantEmail ?? ''} onChange={(event) => updateGateway(selectedGateway.id, { merchantEmail: event.target.value })} />
        </Field>
        {commonFields}
      </div>
    );
  };

  const renderGeneral = () => {
    if (!general) return <EmptyState label="General settings are loading." />;
    return (
      <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <SectionPanel
          title="Institution Logo"
          subtitle="Published logo assets are managed in Branding & Theme."
          actions={
            <Link href="/dashboard/settings/branding" className={primaryButtonClass}>
              Open Branding
            </Link>
          }
        >
          <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white shadow-lg shadow-blue-600/20">
              {general.schoolName.charAt(0).toUpperCase()}
            </div>
            <p className="mt-4 text-lg font-black text-[var(--shell-text)]">{general.schoolName}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--shell-muted)]">{general.schoolCode}</p>
          </div>
        </SectionPanel>

        <SectionPanel
          title="General Settings View"
          subtitle="Institution identity, session, language, date, and currency settings."
          actions={
            <button className={primaryButtonClass} onClick={() => saveSettings({ general })} disabled={updateMutation.isPending}>
              Update General
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="School name" required>
              <input className={inputClass} value={general.schoolName} onChange={(event) => updateGeneralField('schoolName', event.target.value)} />
            </Field>
            <Field label="Site title" required>
              <input className={inputClass} value={general.siteTitle} onChange={(event) => updateGeneralField('siteTitle', event.target.value)} />
            </Field>
            <Field label="School code" required>
              <input className={inputClass} value={general.schoolCode} onChange={(event) => updateGeneralField('schoolCode', event.target.value)} />
            </Field>
            <Field label="Phone" required>
              <input className={inputClass} value={general.phone} onChange={(event) => updateGeneralField('phone', event.target.value)} />
            </Field>
            <Field label="Email" required>
              <input className={inputClass} value={general.email} onChange={(event) => updateGeneralField('email', event.target.value)} />
            </Field>
            <Field label="Session">
              <select className={inputClass} value={general.currentSession} onChange={(event) => updateGeneralField('currentSession', event.target.value)}>
                {sessionChoices.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Language">
              <select className={inputClass} value={general.language} onChange={(event) => updateGeneralField('language', event.target.value)}>
                {languageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Date format">
              <select className={inputClass} value={general.dateFormat} onChange={(event) => updateGeneralField('dateFormat', event.target.value)}>
                {dateFormatOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <select className={inputClass} value={general.currency} onChange={(event) => updateGeneralField('currency', event.target.value)}>
                {currencyOptions.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} - {currency.name}</option>)}
              </select>
            </Field>
            <Field label="Currency symbol" required>
              <input className={inputClass} value={general.currencySymbol} onChange={(event) => updateGeneralField('currencySymbol', event.target.value)} />
            </Field>
            <Field label="Timezone">
              <input className={inputClass} value={general.timezone} onChange={(event) => updateGeneralField('timezone', event.target.value)} />
            </Field>
            <Field label="Address">
              <textarea className={inputClass} rows={3} value={general.address} onChange={(event) => updateGeneralField('address', event.target.value)} />
            </Field>
          </div>
        </SectionPanel>
      </div>
    );
  };

  const renderPayments = () => (
    <SectionPanel
      title="Payment Methods"
      subtitle="Switch the active online gateway and store account keys for parent and student payments."
      actions={
        <button className={primaryButtonClass} onClick={() => saveSettings({ paymentGateways })} disabled={updateMutation.isPending}>
          Update Payment Methods
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          {paymentGateways.map((gateway) => (
            <button
              key={gateway.id}
              type="button"
              onClick={() => switchGateway(gateway.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedGatewayId === gateway.id
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
              }`}
            >
              <span className="text-sm font-black">{gateway.name}</span>
              <StatusPill active={gateway.enabled} label={gateway.enabled ? 'Selected' : 'Off'} />
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-3xl font-black tracking-tight text-[var(--shell-text)]">{selectedGateway?.name ?? 'Gateway'}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--shell-muted)]">Mode: {selectedGateway?.mode ?? 'test'}</p>
            </div>
            {selectedGateway ? <StatusPill active={selectedGateway.enabled} /> : null}
          </div>
          {renderGatewayFields()}
        </div>
      </div>
    </SectionPanel>
  );

  const renderRoles = () => {
    const roles = [
      { name: 'Super Admin', type: 'System', permissions: 'All modules', locked: true },
      { name: 'School Admin', type: 'System', permissions: 'School setup, academics, users', locked: false },
      { name: 'Teacher', type: 'Staff', permissions: 'Classes, attendance, homework', locked: false },
      { name: 'Accountant', type: 'Staff', permissions: 'Fees, payroll, reports', locked: false },
      { name: 'Librarian', type: 'Staff', permissions: 'Library, issued books, reports', locked: false },
      { name: 'Receptionist', type: 'Staff', permissions: 'Front desk, admission, support', locked: false },
    ];
    return (
      <SectionPanel
        title="Roles Permissions"
        subtitle="Role permission assignment is already connected to the Access tab."
        actions={<Link className={primaryButtonClass} href="/dashboard/settings?tab=access">Assign Permission</Link>}
      >
        <div className="overflow-x-auto rounded-xl border border-[var(--shell-border)]">
          <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
            <thead className="bg-[var(--shell-subtle)] text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--shell-muted)]">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Default Access</th>
                <th className="px-4 py-3">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--shell-border)]">
              {roles.map((role) => (
                <tr key={role.name}>
                  <td className="px-4 py-3 font-bold text-[var(--shell-text)]">{role.name}</td>
                  <td className="px-4 py-3 text-[var(--shell-muted)]">{role.type}</td>
                  <td className="px-4 py-3 text-[var(--shell-muted)]">{role.permissions}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {['View', 'Add', 'Edit', 'Delete'].map((item) => (
                        <span key={item} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{item}</span>
                      ))}
                      {role.locked ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">Locked</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    );
  };

  const renderBaseSetup = () => {
    const groups: Array<{ key: keyof BaseSetups; label: string }> = [
      { key: 'gender', label: 'Gender' },
      { key: 'religion', label: 'Religion' },
      { key: 'bloodGroup', label: 'Blood Group' },
    ];
    return (
      <SectionPanel
        title="Base Setup"
        subtitle="Master values used across student, staff, and admission forms."
        actions={<button className={primaryButtonClass} onClick={() => saveSettings({ baseSetups })}>Save Base Setup</button>}
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-black text-[var(--shell-text)]">{group.label}</h3>
                <span className="rounded-full bg-[var(--shell-card)] px-2.5 py-1 text-xs font-black text-[var(--shell-muted)]">
                  {baseSetups[group.key].length}
                </span>
              </div>
              <div className="space-y-2">
                {baseSetups[group.key].map((item, index) => (
                  <div key={`${group.key}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                    <input className={inputClass} value={item} onChange={(event) => updateBaseItem(group.key, index, event.target.value)} />
                    <button className={dangerButtonClass} onClick={() => removeBaseItem(group.key, index)}>Delete</button>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <input
                  className={inputClass}
                  value={newBaseValues[group.key]}
                  onChange={(event) => setNewBaseValues((current) => ({ ...current, [group.key]: event.target.value }))}
                  placeholder={`Add ${group.label}`}
                />
                <button className={subtleButtonClass} onClick={() => addBaseItem(group.key)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      </SectionPanel>
    );
  };

  const renderSessions = () => (
    <SectionPanel
      title="Session"
      subtitle="Session values are available to general settings and academic workflows."
      actions={<button className={primaryButtonClass} onClick={() => saveSettings({ sessions })}>Save Sessions</button>}
    >
      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className={inputClass} value={sessionDraft} onChange={(event) => setSessionDraft(event.target.value)} placeholder="Add session, e.g. 2027" />
        <button className={subtleButtonClass} onClick={addSession}>Add Session</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sessions.map((item) => (
          <div key={item.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
            <div className="flex items-start justify-between gap-3">
              <input className={inputClass} value={item.title} onChange={(event) => setSessions((current) => current.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row))} />
              <StatusPill active={item.isActive} />
            </div>
            <div className="mt-3 flex gap-2">
              <button className={subtleButtonClass} onClick={() => markSessionActive(item.id)}>Set Active</button>
              <button className={dangerButtonClass} onClick={() => removeSession(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </SectionPanel>
  );

  const renderHolidays = () => (
    <SectionPanel
      title="Holiday"
      subtitle="Holidays appear in the school calendar and attendance planning."
      actions={<button className={primaryButtonClass} onClick={() => saveSettings({ holidays })}>Save Holidays</button>}
    >
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
          <div className="space-y-4">
            <Field label="Holiday title" required>
              <input className={inputClass} value={holidayDraft.title} onChange={(event) => setHolidayDraft((current) => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label="From date" required>
              <input type="date" className={inputClass} value={holidayDraft.fromDate} onChange={(event) => setHolidayDraft((current) => ({ ...current, fromDate: event.target.value }))} />
            </Field>
            <Field label="To date" required>
              <input type="date" className={inputClass} value={holidayDraft.toDate} onChange={(event) => setHolidayDraft((current) => ({ ...current, toDate: event.target.value }))} />
            </Field>
            <Field label="Details">
              <textarea className={inputClass} rows={3} value={holidayDraft.details} onChange={(event) => setHolidayDraft((current) => ({ ...current, details: event.target.value }))} />
            </Field>
            <button className={subtleButtonClass} onClick={saveHolidayDraft}>{holidayDraft.id ? 'Update Holiday' : 'Add Holiday'}</button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--shell-border)]">
          <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
            <thead className="bg-[var(--shell-subtle)] text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--shell-muted)]">
              <tr>
                <th className="px-4 py-3">Holiday Title</th>
                <th className="px-4 py-3">From Date</th>
                <th className="px-4 py-3">To Date</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--shell-border)]">
              {holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="px-4 py-3 font-bold text-[var(--shell-text)]">{holiday.title}</td>
                  <td className="px-4 py-3 text-[var(--shell-muted)]">{holiday.fromDate}</td>
                  <td className="px-4 py-3 text-[var(--shell-muted)]">{holiday.toDate}</td>
                  <td className="px-4 py-3 text-[var(--shell-muted)]">{holiday.details}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className={subtleButtonClass} onClick={() => editHoliday(holiday)}>Edit</button>
                      <button className={dangerButtonClass} onClick={() => removeHoliday(holiday.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!holidays.length ? (
                <tr><td colSpan={5} className="px-4 py-8"><EmptyState label="No holidays found." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </SectionPanel>
  );

  const renderFeeChallan = () => (
    <SectionPanel
      title="Fee Challan Details"
      subtitle="Manage the bank accounts printed on student fee challans."
      actions={
        <button className={primaryButtonClass} onClick={() => saveSettings({ feeChallanBanks })} disabled={updateMutation.isPending}>
          Save Fee Challan Details
        </button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-[var(--shell-text)]">
                {feeChallanBankDraft.id ? 'Edit Bank' : 'Add New Bank'}
              </h3>
              <p className="mt-1 text-xs font-semibold text-[var(--shell-muted)]">JPG, PNG. Max 500KB.</p>
            </div>
            {feeChallanBankDraft.id ? (
              <button type="button" className={subtleButtonClass} onClick={resetFeeChallanDraft}>
                Clear
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            <Field label="Bank Logo" required>
              <div className="rounded-2xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--shell-border)] bg-white">
                    {feeChallanBankDraft.logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={feeChallanBankDraft.logoDataUrl} alt="Bank logo preview" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-lg font-black text-slate-400">BK</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--shell-text)]">
                      {feeChallanBankDraft.logoFileName || 'No file chosen'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--shell-muted)]">
                      {feeChallanBankDraft.logoSize ? formatFileSize(feeChallanBankDraft.logoSize) : 'Choose Logo'}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="block w-full text-sm font-semibold text-[var(--shell-muted)] file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-black file:text-white hover:file:bg-blue-700"
                  onChange={handleBankLogoChange}
                />
                <p className="mt-2 text-xs font-semibold text-[var(--shell-muted)]">JPG, PNG. Max 500KB</p>
                {bankLogoError ? <p className="mt-2 text-xs font-bold text-rose-600">{bankLogoError}</p> : null}
              </div>
            </Field>

            <Field label="Bank Name" required>
              <input
                className={inputClass}
                value={feeChallanBankDraft.bankName}
                onChange={(event) => updateFeeChallanDraft('bankName', event.target.value)}
                placeholder="Your Bank Name"
              />
            </Field>

            <Field label="Bank / Branch Address" required>
              <textarea
                className={inputClass}
                rows={3}
                value={feeChallanBankDraft.branchAddress}
                onChange={(event) => updateFeeChallanDraft('branchAddress', event.target.value)}
                placeholder="Bank Address"
              />
            </Field>

            <Field label="Account Number" required>
              <input
                className={inputClass}
                value={feeChallanBankDraft.accountNumber}
                onChange={(event) => updateFeeChallanDraft('accountNumber', event.target.value)}
                placeholder="Bank Account No"
              />
            </Field>

            <Field label="Instructions">
              <textarea
                className={inputClass}
                rows={4}
                value={feeChallanBankDraft.instructions}
                onChange={(event) => updateFeeChallanDraft('instructions', event.target.value)}
                placeholder="Write Instructions"
              />
            </Field>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm font-bold text-[var(--shell-text)]">
              <span>Use this bank on fee challans</span>
              <input
                type="checkbox"
                checked={feeChallanBankDraft.isActive}
                onChange={(event) => updateFeeChallanDraft('isActive', event.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <button type="button" className={primaryButtonClass} onClick={saveFeeChallanBank} disabled={updateMutation.isPending}>
              <span className="inline-flex items-center gap-2">
                <ActionIcon name="plus" />
                {feeChallanBankDraft.id ? 'Update Bank' : 'Add Bank'}
              </span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-black text-[var(--shell-text)]">Bank List</h3>
              <p className="mt-1 text-xs font-semibold text-[var(--shell-muted)]">{feeChallanBanks.length} configured challan bank(s)</p>
            </div>
          </div>

          {feeChallanBanks.length ? (
            <div className="space-y-3">
              {feeChallanBanks.map((bank) => (
                <article key={bank.id} className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--shell-border)] bg-white">
                        {bank.logoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bank.logoDataUrl} alt={`${bank.bankName} logo`} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-lg font-black text-slate-400">BK</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-black text-[var(--shell-text)]">{bank.bankName}</h4>
                          <StatusPill active={bank.isActive} label={bank.isActive ? 'Active' : 'Hidden'} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[var(--shell-muted)]">{bank.accountNumber}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--shell-muted)]">{bank.branchAddress}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className={subtleButtonClass}
                        onClick={() => toggleFeeChallanBank(bank.id)}
                      >
                        {bank.isActive ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-2 text-[var(--shell-text)] transition-colors hover:bg-[var(--shell-hover)]"
                        onClick={() => editFeeChallanBank(bank)}
                        aria-label={`Edit ${bank.bankName}`}
                      >
                        <ActionIcon name="edit" />
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition-colors hover:bg-rose-100"
                        onClick={() => deleteFeeChallanBank(bank.id)}
                        aria-label={`Delete ${bank.bankName}`}
                      >
                        <ActionIcon name="trash" />
                      </button>
                    </div>
                  </div>
                  {bank.instructions ? (
                    <div className="mt-4 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--shell-muted)]">Instructions</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--shell-text)]">{bank.instructions}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState label="No fee challan banks found. Add a bank to print challan account details." />
          )}
        </div>
      </div>
    </SectionPanel>
  );

  const renderSms = () => {
    if (!smsSettings) return <EmptyState label="SMS settings are loading." />;
    return (
      <SectionPanel
        title="SMS Settings"
        subtitle="School SMS provider preference. Central delivery credentials are still managed in Messaging Settings."
        actions={
          <>
            <Link className={subtleButtonClass} href="/dashboard/settings?tab=messaging">Messaging Providers</Link>
            <button className={primaryButtonClass} onClick={() => saveSettings({ smsSettings })}>Update SMS</button>
          </>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {['CLICKATELL', 'TWILIO'].map((provider) => (
            <button
              key={provider}
              className={`rounded-xl border px-4 py-2 text-sm font-black ${smsSettings.activeProvider === provider ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)]'}`}
              onClick={() => updateSmsProvider(provider)}
            >
              {provider === 'CLICKATELL' ? 'Clickatell Settings' : 'Twilio Settings'}
            </button>
          ))}
        </div>
        {smsSettings.activeProvider === 'CLICKATELL' ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Clickatell username" required>
              <input className={inputClass} value={smsSettings.clickatell.username} onChange={(event) => setSmsSettings((current) => current ? { ...current, clickatell: { ...current.clickatell, username: event.target.value } } : current)} />
            </Field>
            <Field label="Clickatell password" required>
              <input type="password" className={inputClass} value={smsSettings.clickatell.password} onChange={(event) => setSmsSettings((current) => current ? { ...current, clickatell: { ...current.clickatell, password: event.target.value } } : current)} />
            </Field>
            <Field label="Clickatell API ID" required>
              <input className={inputClass} value={smsSettings.clickatell.apiId} onChange={(event) => setSmsSettings((current) => current ? { ...current, clickatell: { ...current.clickatell, apiId: event.target.value } } : current)} />
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Twilio account SID" required>
              <input className={inputClass} value={smsSettings.twilio.accountSid} onChange={(event) => setSmsSettings((current) => current ? { ...current, twilio: { ...current.twilio, accountSid: event.target.value } } : current)} />
            </Field>
            <Field label="Authentication token" required>
              <input type="password" className={inputClass} value={smsSettings.twilio.authToken} onChange={(event) => setSmsSettings((current) => current ? { ...current, twilio: { ...current.twilio, authToken: event.target.value } } : current)} />
            </Field>
            <Field label="Registered phone number" required>
              <input className={inputClass} value={smsSettings.twilio.registeredPhoneNumber} onChange={(event) => setSmsSettings((current) => current ? { ...current, twilio: { ...current.twilio, registeredPhoneNumber: event.target.value } } : current)} />
            </Field>
          </div>
        )}
      </SectionPanel>
    );
  };

  if (sessionLoading) return <FullPageLoader label="Loading system setup..." />;
  if (!isSuperAdmin && !isSchoolAdmin) {
    return <EmptyState label="System setup is available for administrators only." />;
  }

  if (isSuperAdmin && !selectedSchoolId) {
    return (
      <SectionPanel title="Select School" subtitle="Choose a school before editing school-scoped system settings.">
        <select className={inputClass} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
          <option value="">Select school</option>
          {schoolsQuery.data?.items.map((school) => (
            <option key={school.id} value={school.id}>{school.name} ({school.code})</option>
          ))}
        </select>
      </SectionPanel>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneral();
      case 'payments':
        return renderPayments();
      case 'roles':
        return renderRoles();
      case 'base':
        return renderBaseSetup();
      case 'sessions':
        return renderSessions();
      case 'holidays':
        return renderHolidays();
      case 'sms':
        return renderSms();
      case 'fee-challan':
        return renderFeeChallan();
      default:
        return renderGeneral();
    }
  };

  return (
    <div className="space-y-5">
      {busy ? <FullPageLoader label="Saving system setup..." /> : null}

      {isSuperAdmin ? (
        <SectionPanel title="School Scope">
          <select className={inputClass} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
            <option value="">Select school</option>
            {schoolsQuery.data?.items.map((school) => (
              <option key={school.id} value={school.id}>{school.name} ({school.code})</option>
            ))}
          </select>
        </SectionPanel>
      ) : null}

      {message ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}

      {showOverview ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Enabled Gateways', value: enabledGateways, detail: `${paymentGateways.length} configured` },
          { label: 'Base Setup Items', value: countBaseItems(baseSetups), detail: 'Gender, religion, blood group' },
          { label: 'Sessions', value: sessions.length, detail: 'Academic terms configured' },
          { label: 'Challan Banks', value: feeChallanBanks.length, detail: `${feeChallanBanks.filter((bank) => bank.isActive).length} active` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--shell-muted)]">{item.label}</p>
            <p className="mt-3 text-3xl font-black text-[var(--shell-text)]">{item.value}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--shell-muted)]">{item.detail}</p>
          </div>
        ))}
      </section> : null}

      {showSectionMenu ? <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {setupTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                activeSection === tab.id
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
              }`}
            >
              <span className="block text-sm font-black">{tab.label}</span>
              <span className={`mt-1 block text-xs font-semibold ${activeSection === tab.id ? 'text-blue-700' : 'text-[var(--shell-muted)]'}`}>
                {tab.metric}
              </span>
            </button>
          ))}
        </div>
      </section> : null}

      {renderActiveSection()}
    </div>
  );
}
