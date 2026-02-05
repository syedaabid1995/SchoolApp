'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../../services/auth.service';
import {
  getSchoolMessagingConfig,
  listMessagingServicesAdmin,
  listMessagingServicesForSchool,
  upsertSchoolMessagingConfig,
  updateMessagingServiceStatus,
} from '../../../../services/messaging.service';

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

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  const { data: adminServices } = useQuery({
    queryKey: ['messaging-services-admin'],
    queryFn: listMessagingServicesAdmin,
    enabled: isSuperAdmin,
  });

  const { data: schoolServices } = useQuery({
    queryKey: ['messaging-services-school', channel],
    queryFn: () => listMessagingServicesForSchool(channel),
    enabled: !isSuperAdmin,
  });

  const { data: currentConfig } = useQuery({
    queryKey: ['messaging-config', channel],
    queryFn: () => getSchoolMessagingConfig(channel),
    enabled: !isSuperAdmin,
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

  const selectedSchoolService = useMemo(
    () => schoolServices?.services.find((service) => service.id === selectedServiceId) ?? null,
    [schoolServices, selectedServiceId],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">SMS Settings</h1>
        <p className="text-sm text-slate">
          {isSuperAdmin
            ? 'Manage globally available messaging providers.'
            : 'Select active provider and save school-level credentials.'}
        </p>
      </header>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">Global Services</h2>
          <div className="mt-4 space-y-3">
            {adminServices?.map((service) => (
              <div key={service.id} className="flex items-center justify-between rounded-xl border border-slate/10 p-4">
                <div>
                  <p className="font-semibold text-ink">{service.name}</p>
                  <p className="text-xs text-slate">
                    {service.code} • Channels: {service.supportedChannels.join(', ')} • Used by {service.schoolConfigsCount ?? 0} schools
                  </p>
                </div>
                <button
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    service.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
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
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">School Messaging Provider</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-ink">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'WHATSAPP' | 'SMS')}
                className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-ink">Provider</span>
              <select
                value={selectedServiceId || schoolServices?.currentServiceId || ''}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">Select provider</option>
                {schoolServices?.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-slate/10 p-4">
            <p className="text-sm font-medium text-ink">Twilio Credentials</p>
            <p className="text-xs text-slate">Required: accountSid, authToken, from</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                placeholder="accountSid"
                value={credentials.accountSid}
                onChange={(e) => setCredentials((prev) => ({ ...prev, accountSid: e.target.value }))}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                placeholder="authToken"
                value={credentials.authToken}
                onChange={(e) => setCredentials((prev) => ({ ...prev, authToken: e.target.value }))}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <input
                placeholder="from (e.g. +1415.. or whatsapp:+1415..)"
                value={credentials.from}
                onChange={(e) => setCredentials((prev) => ({ ...prev, from: e.target.value }))}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                placeholder="messagingServiceSid (optional)"
                value={credentials.messagingServiceSid}
                onChange={(e) => setCredentials((prev) => ({ ...prev, messagingServiceSid: e.target.value }))}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm md:col-span-2"
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enable this provider for selected channel
          </label>

          <button
            className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
            Save Provider
          </button>

          {currentConfig ? (
            <div className="mt-4 rounded-lg border border-slate/10 bg-sand p-3 text-xs text-slate">
              Current: {currentConfig.serviceName} • {currentConfig.channel} • {currentConfig.isEnabled ? 'Enabled' : 'Disabled'}
            </div>
          ) : null}
          {selectedSchoolService ? (
            <div className="mt-2 text-xs text-slate">Selected service code: {selectedSchoolService.code}</div>
          ) : null}
        </section>
      )}
    </div>
  );
}

