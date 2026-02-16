'use client';

import { useMemo, useState } from 'react';
import PageHeader from '../../../../components/PageHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../../services/auth.service';
import {
  getSchoolMessagingConfig,
  listMessagingServicesAdmin,
  listMessagingServicesForSchool,
  upsertSchoolMessagingConfig,
  toggleSchoolMessagingConfigStatus,
  updateMessagingServiceStatus,
} from '../../../../services/messaging.service';
import FullPageLoader from '../../../../components/FullPageLoader';

const DEFAULT_CREDENTIALS = {
  accountSid: '',
  authToken: '',
  from: '',
  messagingServiceSid: '',
};

export default function SmsSettingsPage() {
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState(DEFAULT_CREDENTIALS);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  const { data: adminServices } = useQuery({
    queryKey: ['messaging-services-admin'],
    queryFn: listMessagingServicesAdmin,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const { data: schoolServices } = useQuery({
    queryKey: ['messaging-services-school', channel],
    queryFn: () => listMessagingServicesForSchool(channel),
    enabled: !isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const { data: currentConfig } = useQuery({
    queryKey: ['messaging-config', channel],
    queryFn: () => getSchoolMessagingConfig(channel),
    enabled: !isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: currentSmsConfig } = useQuery({
    queryKey: ['messaging-config', 'SMS'],
    queryFn: () => getSchoolMessagingConfig('SMS'),
    enabled: !isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: currentWhatsappConfig } = useQuery({
    queryKey: ['messaging-config', 'WHATSAPP'],
    queryFn: () => getSchoolMessagingConfig('WHATSAPP'),
    enabled: !isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => updateMessagingServiceStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messaging-services-admin'] }),
  });

  const saveSchoolConfigMutation = useMutation({
    mutationFn: upsertSchoolMessagingConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-config', channel] });
      queryClient.invalidateQueries({ queryKey: ['messaging-services-school', channel] });
    },
  });
  const toggleSchoolConfigMutation = useMutation({
    mutationFn: toggleSchoolMessagingConfigStatus,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messaging-config', vars.channel] });
    },
  });

  const selectedSchoolService = useMemo(
    () => schoolServices?.services.find((service) => service.id === selectedServiceId) ?? null,
    [schoolServices, selectedServiceId],
  );

  const isBusy = toggleMutation.isPending || saveSchoolConfigMutation.isPending || toggleSchoolConfigMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40">
      {isBusy ? <FullPageLoader label="Processing..." /> : null}
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader
          title="SMS Settings"
          subtitle={isSuperAdmin
            ? 'Manage globally available messaging providers.'
            : 'Select active provider and save school-level credentials.'}
        />

        {isSuperAdmin ? (
          <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-full bg-gradient-to-br from-green-100 to-emerald-100 p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Global Services</h2>
                <p className="text-sm text-gray-500">Manage messaging providers for all schools</p>
              </div>
            </div>
            <div className="space-y-4">
              {adminServices?.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-5 hover:border-green-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white font-bold text-lg">
                      {service.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{service.name}</p>
                      <p className="text-xs text-gray-500">
                        {service.code} • Channels: {service.supportedChannels.join(', ')} • Used by {service.schoolConfigsCount ?? 0} schools
                      </p>
                    </div>
                  </div>
                  <button
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                      service.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                    }`}
                    onClick={() =>
                      toggleMutation.mutate({
                        id: service.id,
                        status: service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      })
                    }
                    disabled={toggleMutation.isPending}
                  >
                    {service.status}
                  </button>
                </div>
              ))}
              {!adminServices?.length && (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-600">No services configured</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Active Channels</h2>
                  <p className="text-sm text-gray-500">Current messaging channel status</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[currentWhatsappConfig, currentSmsConfig].map((cfg, index) => {
                  const channelName = index === 0 ? 'WHATSAPP' : 'SMS';
                  return (
                    <div key={channelName} className="rounded-xl border-2 border-gray-200 p-5 hover:border-green-300 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-3 w-3 rounded-full ${cfg?.isEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                        <p className="text-sm font-semibold text-gray-900">{channelName}</p>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">{cfg?.serviceName ?? 'Not configured'}</p>
                      <button
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                          cfg?.isEnabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        disabled={!cfg}
                        onClick={() =>
                          cfg
                            ? toggleSchoolConfigMutation.mutate({
                                channel: channelName as 'WHATSAPP' | 'SMS',
                                isEnabled: !cfg.isEnabled,
                              })
                            : undefined
                        }
                      >
                        {cfg?.isEnabled ? 'Active (Click to Inactivate)' : 'Inactive (Click to Activate)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-full bg-gradient-to-br from-green-100 to-emerald-100 p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Provider Configuration</h2>
                  <p className="text-sm text-gray-500">Configure messaging provider and credentials</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-2 block">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as 'WHATSAPP' | 'SMS')}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-2 block">Provider</label>
                  <select
                    value={selectedServiceId || schoolServices?.currentServiceId || ''}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">Select provider</option>
                    {schoolServices?.services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border-2 border-gray-200 p-5 mb-4">
                <p className="text-sm font-semibold text-gray-900 mb-1">Twilio Credentials</p>
                <p className="text-xs text-gray-500 mb-4">Required: accountSid, authToken, from</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    placeholder="accountSid"
                    value={credentials.accountSid}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, accountSid: e.target.value }))}
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <input
                    placeholder="authToken"
                    value={credentials.authToken}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, authToken: e.target.value }))}
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <input
                    placeholder="from (e.g. +1415.. or whatsapp:+1415..)"
                    value={credentials.from}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, from: e.target.value }))}
                    className="md:col-span-2 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <input
                    placeholder="messagingServiceSid (optional)"
                    value={credentials.messagingServiceSid}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, messagingServiceSid: e.target.value }))}
                    className="md:col-span-2 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-900 mb-4">
                <input 
                  type="checkbox" 
                  checked={enabled} 
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Enable this provider for selected channel
              </label>

              <button
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl disabled:opacity-50"
                onClick={() =>
                  saveSchoolConfigMutation.mutate({
                    channel,
                    serviceId: selectedServiceId || schoolServices?.currentServiceId || '',
                    isEnabled: enabled,
                    credentials,
                  })
                }
                disabled={saveSchoolConfigMutation.isPending || !(selectedServiceId || schoolServices?.currentServiceId)}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Provider
              </button>

              {currentConfig && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <p className="font-medium">Current Configuration:</p>
                  <p className="text-xs mt-1">{currentConfig.serviceName} • {currentConfig.channel} • {currentConfig.isEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              )}
              {selectedSchoolService && (
                <div className="mt-2 text-xs text-gray-500">Selected service code: {selectedSchoolService.code}</div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
