'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../../components/PageHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../../services/auth.service';
import { listSchools } from '../../../../services/school.service';
import {
  getPlatformEmailConfig,
  getSchoolMessagingConfigForScope,
  listMessagingServicesAdmin,
  listMessagingServicesForSchoolScope,
  togglePlatformEmailConfigStatus,
  upsertSchoolMessagingConfig,
  upsertPlatformEmailConfig,
  toggleSchoolMessagingConfigStatus,
  updateMessagingServiceStatus,
  type MessagingChannel,
  type MessagingServiceItem,
} from '../../../../services/messaging.service';
import FullPageLoader from '../../../../components/FullPageLoader';

type CredentialField = {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
  inputType?: 'text' | 'password' | 'email' | 'number' | 'url';
  placeholder?: string;
  help?: string;
};

const providerFields: Record<string, CredentialField[]> = {
  TWILIO: [
    { key: 'accountSid', label: 'Account SID', required: true, placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'authToken', label: 'Auth Token', required: true, secret: true, placeholder: 'Twilio auth token' },
    { key: 'from', label: 'From Number / WhatsApp Sender', required: true, placeholder: '+14155238886 or whatsapp:+14155238886' },
    { key: 'messagingServiceSid', label: 'Messaging Service SID', placeholder: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', help: 'Optional. If set, Twilio uses this instead of From.' },
  ],
  MSG91: [
    { key: 'authKey', label: 'Auth Key', required: true, secret: true, placeholder: 'MSG91 auth key' },
    { key: 'senderId', label: 'Sender ID', required: true, placeholder: 'DLT approved sender ID' },
    { key: 'route', label: 'Route', placeholder: '4', help: 'Optional. Default route is 4.' },
    { key: 'country', label: 'Country Code', placeholder: '91', help: 'Optional. Default country is 91.' },
    { key: 'templateId', label: 'Template ID', placeholder: 'DLT template ID', help: 'Optional. If set, flow API is used.' },
  ],
  WATI: [
    { key: 'apiEndpoint', label: 'API Endpoint', required: true, placeholder: 'https://live-mt-server.wati.io/{tenantId}' },
    { key: 'accessToken', label: 'Access Token', required: true, secret: true, placeholder: 'WATI bearer token' },
  ],
  SMTP: [
    { key: 'host', label: 'SMTP Host', required: true, placeholder: 'smtp.example.com' },
    { key: 'port', label: 'SMTP Port', required: true, inputType: 'number', placeholder: '587' },
    { key: 'username', label: 'SMTP Username', placeholder: 'smtp user or email' },
    { key: 'password', label: 'SMTP Password', secret: true, placeholder: 'SMTP password or app password' },
    { key: 'fromEmail', label: 'From Email', required: true, inputType: 'email', placeholder: 'no-reply@example.com' },
    { key: 'fromName', label: 'From Name', placeholder: 'School Management' },
    { key: 'secure', label: 'Secure TLS', placeholder: 'true or false', help: 'Use true for port 465. For port 587, false usually enables STARTTLS.' },
  ],
  SENDGRID: [
    { key: 'apiKey', label: 'SendGrid API Key', required: true, secret: true, placeholder: 'SG.xxxxx' },
    { key: 'fromEmail', label: 'From Email', required: true, inputType: 'email', placeholder: 'no-reply@example.com' },
    { key: 'fromName', label: 'From Name', placeholder: 'School Management' },
    { key: 'apiUrl', label: 'API URL', inputType: 'url', placeholder: 'https://api.sendgrid.com/v3/mail/send', help: 'Optional. Leave empty for SendGrid default.' },
  ],
};

const providerDescriptions: Record<string, string> = {
  TWILIO: 'SMS and WhatsApp through Twilio Programmable Messaging.',
  MSG91: 'SMS provider for India DLT and transactional messaging.',
  WATI: 'WhatsApp Business messaging through WATI session message API.',
  SMTP: 'Email delivery through your SMTP server.',
  SENDGRID: 'Transactional email through SendGrid Mail Send API.',
};

const defaultCredentialsForProvider = (code?: string): Record<string, string> => {
  if (code === 'MSG91') return { route: '4', country: '91' };
  if (code === 'SMTP') return { port: '587', secure: 'false' };
  return {};
};

const maskLabel = (value?: string) => (value ? value : 'Saved value hidden');

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const getApiErrorMessage = (error: unknown) => {
  const data = (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return data?.error?.message || data?.message || (error as Error)?.message || 'Unable to save messaging settings.';
};

export default function SmsSettingsPage() {
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [platformEmailServiceId, setPlatformEmailServiceId] = useState('');
  const [platformEmailCredentials, setPlatformEmailCredentials] = useState<Record<string, string>>({});
  const [platformEmailEnabled, setPlatformEmailEnabled] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [channel, setChannel] = useState<MessagingChannel>('WHATSAPP');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const schoolScopeReady = Boolean(isSuperAdmin && selectedSchoolId);
  const schoolScopeParams = {
    channel,
    ...(selectedSchoolId ? { schoolId: selectedSchoolId } : {}),
  };

  const { data: schools } = useQuery({
    queryKey: ['schools', 'messaging-settings'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: Boolean(isSuperAdmin),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: adminServices } = useQuery({
    queryKey: ['messaging-services-admin'],
    queryFn: listMessagingServicesAdmin,
    enabled: Boolean(isSuperAdmin),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: platformEmailConfig } = useQuery({
    queryKey: ['platform-email-config'],
    queryFn: getPlatformEmailConfig,
    enabled: Boolean(isSuperAdmin),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: schoolServices } = useQuery({
    queryKey: ['messaging-services-school', channel, selectedSchoolId],
    queryFn: () => listMessagingServicesForSchoolScope(schoolScopeParams),
    enabled: schoolScopeReady,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: currentConfig } = useQuery({
    queryKey: ['messaging-config', channel, selectedSchoolId],
    queryFn: () => getSchoolMessagingConfigForScope(schoolScopeParams),
    enabled: schoolScopeReady,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: currentSmsConfig } = useQuery({
    queryKey: ['messaging-config', 'SMS', selectedSchoolId],
    queryFn: () =>
      getSchoolMessagingConfigForScope({
        channel: 'SMS',
        ...(selectedSchoolId ? { schoolId: selectedSchoolId } : {}),
      }),
    enabled: schoolScopeReady,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: currentWhatsappConfig } = useQuery({
    queryKey: ['messaging-config', 'WHATSAPP', selectedSchoolId],
    queryFn: () =>
      getSchoolMessagingConfigForScope({
        channel: 'WHATSAPP',
        ...(selectedSchoolId ? { schoolId: selectedSchoolId } : {}),
      }),
    enabled: schoolScopeReady,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: currentEmailConfig } = useQuery({
    queryKey: ['messaging-config', 'EMAIL', selectedSchoolId],
    queryFn: () =>
      getSchoolMessagingConfigForScope({
        channel: 'EMAIL',
        ...(selectedSchoolId ? { schoolId: selectedSchoolId } : {}),
      }),
    enabled: schoolScopeReady,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => updateMessagingServiceStatus(id, status),
    onSuccess: () => {
      setMessage('Global provider status updated.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['messaging-services-admin'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-services-school'] });
    },
    onError: (mutationError) => {
      setMessage('');
      setError(getApiErrorMessage(mutationError));
    },
  });

  const saveSchoolConfigMutation = useMutation({
    mutationFn: upsertSchoolMessagingConfig,
    onSuccess: () => {
      setMessage('Messaging provider credentials saved.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['messaging-config'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-services-school'] });
    },
    onError: (mutationError) => {
      setMessage('');
      setError(getApiErrorMessage(mutationError));
    },
  });

  const savePlatformEmailMutation = useMutation({
    mutationFn: upsertPlatformEmailConfig,
    onSuccess: () => {
      setMessage('Platform email credentials saved.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['platform-email-config'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-services-admin'] });
    },
    onError: (mutationError) => {
      setMessage('');
      setError(getApiErrorMessage(mutationError));
    },
  });

  const togglePlatformEmailMutation = useMutation({
    mutationFn: togglePlatformEmailConfigStatus,
    onSuccess: () => {
      setMessage('Platform email status updated.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['platform-email-config'] });
    },
    onError: (mutationError) => {
      setMessage('');
      setError(getApiErrorMessage(mutationError));
    },
  });

  const toggleSchoolConfigMutation = useMutation({
    mutationFn: toggleSchoolMessagingConfigStatus,
    onSuccess: () => {
      setMessage('Channel status updated.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['messaging-config'] });
    },
    onError: (mutationError) => {
      setMessage('');
      setError(getApiErrorMessage(mutationError));
    },
  });

  const selectedService = useMemo<MessagingServiceItem | null>(
    () => schoolServices?.services.find((service) => service.id === selectedServiceId) ?? null,
    [schoolServices, selectedServiceId],
  );
  const activeServiceId = selectedServiceId || schoolServices?.currentServiceId || '';
  const activeService =
    selectedService || schoolServices?.services.find((service) => service.id === activeServiceId) || null;
  const credentialFields = providerFields[activeService?.code ?? ''] ?? [];
  const platformEmailServices = useMemo(
    () => adminServices?.filter((service) => service.status === 'ACTIVE' && service.supportedChannels.includes('EMAIL')) ?? [],
    [adminServices],
  );
  const activePlatformEmailServiceId = platformEmailServiceId || platformEmailConfig?.serviceId || '';
  const activePlatformEmailService =
    platformEmailServices.find((service) => service.id === activePlatformEmailServiceId) || null;
  const platformEmailFields = providerFields[activePlatformEmailService?.code ?? ''] ?? [];

  useEffect(() => {
    setSelectedServiceId('');
    setCredentials({});
    setMessage('');
    setError('');
  }, [channel, selectedSchoolId]);

  useEffect(() => {
    if (schoolServices?.currentServiceId && !selectedServiceId) {
      setSelectedServiceId(schoolServices.currentServiceId);
    }
  }, [schoolServices?.currentServiceId, selectedServiceId]);

  useEffect(() => {
    if (activeService?.code) {
      setCredentials((current) => ({ ...defaultCredentialsForProvider(activeService.code), ...current }));
    }
  }, [activeService?.code]);

  useEffect(() => {
    if (platformEmailConfig?.serviceId && !platformEmailServiceId) {
      setPlatformEmailServiceId(platformEmailConfig.serviceId);
      setPlatformEmailEnabled(platformEmailConfig.isEnabled);
    }
  }, [platformEmailConfig?.serviceId, platformEmailConfig?.isEnabled, platformEmailServiceId]);

  useEffect(() => {
    if (activePlatformEmailService?.code) {
      setPlatformEmailCredentials((current) => ({
        ...defaultCredentialsForProvider(activePlatformEmailService.code),
        ...current,
      }));
    }
  }, [activePlatformEmailService?.code]);

  const isBusy =
    toggleMutation.isPending ||
    saveSchoolConfigMutation.isPending ||
    savePlatformEmailMutation.isPending ||
    togglePlatformEmailMutation.isPending ||
    toggleSchoolConfigMutation.isPending;

  const validateAndSave = () => {
    if (!selectedSchoolId) {
      window.alert('Select a school before saving provider credentials.');
      return;
    }
    if (!activeServiceId || !activeService) {
      window.alert('Select a messaging provider.');
      return;
    }

    const missing = credentialFields.filter((field) => field.required && !credentials[field.key]?.trim());
    if (missing.length) {
      window.alert(`Enter required fields: ${missing.map((field) => field.label).join(', ')}`);
      return;
    }

    const invalidEmail = credentialFields.find(
      (field) => field.inputType === 'email' && credentials[field.key]?.trim() && !isValidEmail(credentials[field.key].trim()),
    );
    if (invalidEmail) {
      window.alert(`Enter a valid email for ${invalidEmail.label}.`);
      return;
    }

    const invalidUrl = credentialFields.find(
      (field) => field.inputType === 'url' && credentials[field.key]?.trim() && !isValidUrl(credentials[field.key].trim()),
    );
    if (invalidUrl) {
      window.alert(`Enter a valid URL for ${invalidUrl.label}.`);
      return;
    }

    saveSchoolConfigMutation.mutate({
      channel,
      serviceId: activeServiceId,
      isEnabled: enabled,
      credentials,
      schoolId: selectedSchoolId,
    });
  };

  const validateAndSavePlatformEmail = () => {
    if (!activePlatformEmailServiceId || !activePlatformEmailService) {
      window.alert('Select a platform email provider.');
      return;
    }

    const missing = platformEmailFields.filter((field) => field.required && !platformEmailCredentials[field.key]?.trim());
    if (missing.length) {
      window.alert(`Enter required fields: ${missing.map((field) => field.label).join(', ')}`);
      return;
    }

    const invalidEmail = platformEmailFields.find(
      (field) =>
        field.inputType === 'email' &&
        platformEmailCredentials[field.key]?.trim() &&
        !isValidEmail(platformEmailCredentials[field.key].trim()),
    );
    if (invalidEmail) {
      window.alert(`Enter a valid email for ${invalidEmail.label}.`);
      return;
    }

    const invalidUrl = platformEmailFields.find(
      (field) =>
        field.inputType === 'url' &&
        platformEmailCredentials[field.key]?.trim() &&
        !isValidUrl(platformEmailCredentials[field.key].trim()),
    );
    if (invalidUrl) {
      window.alert(`Enter a valid URL for ${invalidUrl.label}.`);
      return;
    }

    savePlatformEmailMutation.mutate({
      serviceId: activePlatformEmailServiceId,
      isEnabled: platformEmailEnabled,
      credentials: platformEmailCredentials,
    });
  };

  const renderProviderBadge = (code: string) => {
    const color =
      code === 'TWILIO'
        ? 'bg-indigo-100 text-indigo-700'
        : code === 'MSG91'
          ? 'bg-amber-100 text-amber-700'
          : code === 'WATI'
            ? 'bg-emerald-100 text-emerald-700'
            : code === 'SMTP'
              ? 'bg-sky-100 text-sky-700'
              : 'bg-violet-100 text-violet-700';
    return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{code}</span>;
  };

  if (isSessionLoading) {
    return <FullPageLoader label="Loading messaging settings..." />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
        <PageHeader
          title="Messaging Settings"
          subtitle="Provider credentials are managed only by Super Admin."
        />
        <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center">
          <h2 className="text-lg font-bold text-[var(--shell-text)]">Super Admin Only</h2>
          <p className="mt-2 text-sm text-[var(--shell-muted)]">
            Messaging provider credentials are configured centrally and per school by Super Admin.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isBusy ? <FullPageLoader label="Processing..." /> : null}
      <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
        <PageHeader
          title="Messaging Settings"
          subtitle={isSuperAdmin
            ? 'Enable Twilio, MSG91, WATI, SMTP, and SendGrid globally, then configure provider credentials for each school.'
            : 'Select an SMS, WhatsApp, or Email provider and save school-level credentials.'}
        />

        {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {isSuperAdmin ? (
          <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--shell-text)]">Global Providers</h2>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">
                  These providers become available to schools when active. Secrets are saved per school.
                </p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {adminServices?.map((service) => (
                <div key={service.id} className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[var(--shell-text)]">{service.name}</p>
                        {renderProviderBadge(service.code)}
                      </div>
                      <p className="mt-2 text-sm leading-5 text-[var(--shell-muted)]">
                        {providerDescriptions[service.code] ?? 'Messaging provider'}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-[var(--shell-muted)]">
                        Channels: {service.supportedChannels.join(', ')} | Schools: {service.schoolConfigsCount ?? 0}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        service.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {service.status}
                    </span>
                  </div>
                  <button
                    className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                      service.status === 'ACTIVE'
                        ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    onClick={() =>
                      toggleMutation.mutate({
                        id: service.id,
                        status: service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      })
                    }
                    disabled={toggleMutation.isPending}
                  >
                    {service.status === 'ACTIVE' ? 'Disable Provider' : 'Enable Provider'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {isSuperAdmin ? (
          <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--shell-text)]">Platform Email</h2>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">
                  Used for Super Admin verification, password reset, and system emails when no school-specific provider applies.
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  platformEmailConfig?.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {platformEmailConfig?.isEnabled ? 'Enabled' : 'Not enabled'}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[var(--shell-text)]">Email Provider</span>
                <select
                  value={activePlatformEmailServiceId}
                  onChange={(event) => {
                    setPlatformEmailServiceId(event.target.value);
                    const service = platformEmailServices.find((item) => item.id === event.target.value);
                    setPlatformEmailCredentials(defaultCredentialsForProvider(service?.code));
                  }}
                  className="w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">Select email provider</option>
                  {platformEmailServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-2 self-end rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3 text-sm font-semibold text-[var(--shell-text)]">
                <input
                  type="checkbox"
                  checked={platformEmailEnabled}
                  onChange={(event) => setPlatformEmailEnabled(event.target.checked)}
                  className="h-4 w-4"
                />
                Enable platform email after save
              </label>
            </div>

            {activePlatformEmailService ? (
              <div className="mt-5 rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[var(--shell-text)]">{activePlatformEmailService.name}</p>
                  {renderProviderBadge(activePlatformEmailService.code)}
                  <p className="text-sm text-[var(--shell-muted)]">{providerDescriptions[activePlatformEmailService.code]}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {platformEmailFields.map((field) => (
                    <label key={field.key} className="space-y-2">
                      <span className="text-sm font-semibold text-[var(--shell-text)]">
                        {field.label}
                        {field.required ? <span className="text-rose-600"> *</span> : null}
                      </span>
                      <input
                        type={field.secret ? 'password' : field.inputType ?? 'text'}
                        value={platformEmailCredentials[field.key] ?? ''}
                        onChange={(event) =>
                          setPlatformEmailCredentials((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        placeholder={field.placeholder || maskLabel(platformEmailConfig?.maskedCredentials[field.key])}
                        className="w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                      {field.help ? <span className="block text-xs text-[var(--shell-muted)]">{field.help}</span> : null}
                    </label>
                  ))}
                </div>

                {platformEmailConfig?.serviceId === activePlatformEmailService.id ? (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-bold">Saved platform email configuration</p>
                    <p className="mt-1">
                      {platformEmailConfig.serviceName} | {platformEmailConfig.isEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                    {platformEmailConfig.credentialKeys.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {platformEmailConfig.credentialKeys.map((key) => (
                          <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                            {key}: {platformEmailConfig.maskedCredentials[key] || 'saved'}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={validateAndSavePlatformEmail}
                    disabled={savePlatformEmailMutation.isPending}
                  >
                    Save Platform Email
                  </button>
                  <button
                    className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-6 py-3 text-sm font-bold text-[var(--shell-text)] transition-colors hover:bg-[var(--shell-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => togglePlatformEmailMutation.mutate({ isEnabled: !platformEmailConfig?.isEnabled })}
                    disabled={!platformEmailConfig || togglePlatformEmailMutation.isPending}
                  >
                    {platformEmailConfig?.isEnabled ? 'Disable Platform Email' : 'Enable Platform Email'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-[var(--shell-border)] p-6 text-center text-sm text-[var(--shell-muted)]">
                Enable SMTP Email or SendGrid globally, then select it here.
              </div>
            )}
          </section>
        ) : null}

        {isSuperAdmin ? (
          <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--shell-text)]">School Provider Setup</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">
              Select a school to configure SMS, WhatsApp, or Email credentials. Only Super Admin can edit these per-school provider settings.
            </p>
            <label className="mt-4 block max-w-xl space-y-2">
              <span className="text-sm font-semibold text-[var(--shell-text)]">School</span>
              <select
                value={selectedSchoolId}
                onChange={(event) => setSelectedSchoolId(event.target.value)}
                className="w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Select school</option>
                {schools?.items.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        {schoolScopeReady ? (
          <>
            <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-[var(--shell-text)]">Active Channels</h2>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">Current provider and enabled state for each channel.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { channel: 'WHATSAPP' as const, config: currentWhatsappConfig },
                  { channel: 'SMS' as const, config: currentSmsConfig },
                  { channel: 'EMAIL' as const, config: currentEmailConfig },
                ].map((item) => (
                  <div key={item.channel} className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--shell-text)]">{item.channel}</p>
                        <p className="mt-1 text-sm text-[var(--shell-muted)]">{item.config?.serviceName ?? 'Not configured'}</p>
                        {item.config ? (
                          <p className="mt-2 text-xs font-semibold text-[var(--shell-muted)]">
                            Provider: {item.config.serviceCode}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.config?.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.config?.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <button
                      className="mt-4 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-2 text-sm font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!item.config}
                      onClick={() =>
                        item.config
                          ? toggleSchoolConfigMutation.mutate({
                              channel: item.channel,
                              isEnabled: !item.config.isEnabled,
                              ...(isSuperAdmin ? { schoolId: selectedSchoolId } : {}),
                            })
                          : undefined
                      }
                    >
                      {item.config?.isEnabled ? 'Disable Channel' : 'Enable Channel'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-[var(--shell-text)]">Provider Configuration</h2>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">
                  Credentials are stored server-side and only masked keys are shown after saving.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--shell-text)]">Channel</span>
                  <select
                    value={channel}
                    onChange={(event) => setChannel(event.target.value as MessagingChannel)}
                    className="w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--shell-text)]">Provider</span>
                  <select
                    value={activeServiceId}
                    onChange={(event) => {
                      setSelectedServiceId(event.target.value);
                      const service = schoolServices?.services.find((item) => item.id === event.target.value);
                      setCredentials(defaultCredentialsForProvider(service?.code));
                    }}
                    className="w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Select provider</option>
                    {schoolServices?.services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {activeService ? (
                <div className="mt-5 rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[var(--shell-text)]">{activeService.name}</p>
                        {renderProviderBadge(activeService.code)}
                      </div>
                      <p className="mt-1 text-sm text-[var(--shell-muted)]">{providerDescriptions[activeService.code]}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) => setEnabled(event.target.checked)}
                        className="h-4 w-4"
                      />
                      Enable after save
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {credentialFields.map((field) => (
                      <label key={field.key} className="space-y-2">
                        <span className="text-sm font-semibold text-[var(--shell-text)]">
                          {field.label}
                          {field.required ? <span className="text-rose-600"> *</span> : null}
                        </span>
                        <input
                          type={field.secret ? 'password' : field.inputType ?? 'text'}
                          value={credentials[field.key] ?? ''}
                          onChange={(event) => setCredentials((current) => ({ ...current, [field.key]: event.target.value }))}
                          placeholder={field.placeholder || maskLabel(currentConfig?.maskedCredentials[field.key])}
                          className="w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                        {field.help ? <span className="block text-xs text-[var(--shell-muted)]">{field.help}</span> : null}
                      </label>
                    ))}
                  </div>

                  {currentConfig?.serviceId === activeService.id ? (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p className="font-bold">Saved {currentConfig.channel} configuration</p>
                      <p className="mt-1">
                        {currentConfig.serviceName} | {currentConfig.isEnabled ? 'Enabled' : 'Disabled'}
                      </p>
                      {currentConfig.credentialKeys.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentConfig.credentialKeys.map((key) => (
                            <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                              {key}: {currentConfig.maskedCredentials[key] || 'saved'}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={validateAndSave}
                    disabled={saveSchoolConfigMutation.isPending}
                  >
                    Save Provider Credentials
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-[var(--shell-border)] p-6 text-center text-sm text-[var(--shell-muted)]">
                  Select a provider to configure credentials.
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center">
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Select a school</h2>
            <p className="mt-2 text-sm text-[var(--shell-muted)]">
              Super Admin must choose a school before configuring school-level messaging credentials.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
