'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  listConfigEntries,
  createConfigEntry,
  updateConfigEntry,
} from '../../../services/config.service';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [flagForm, setFlagForm] = useState({ code: '', description: '', enabled: true });
  const [configForm, setConfigForm] = useState({ key: '', value: '', description: '' });
  const [flagError, setFlagError] = useState('');
  const [configError, setConfigError] = useState('');

  const { data: flags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: listFeatureFlags,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const { data: configs } = useQuery({
    queryKey: ['config-entries'],
    queryFn: listConfigEntries,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  const createFlagMutation = useMutation({
    mutationFn: createFeatureFlag,
    onSuccess: () => {
      setFlagForm({ code: '', description: '', enabled: true });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateFeatureFlag(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });

  const createConfigMutation = useMutation({
    mutationFn: createConfigEntry,
    onSuccess: () => {
      setConfigForm({ key: '', value: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['config-entries'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateConfigEntry(id, { value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config-entries'] }),
  });

  const isBusy = createFlagMutation.isPending || updateFlagMutation.isPending || createConfigMutation.isPending || updateConfigMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40">
      {isBusy ? <FullPageLoader label="Processing..." /> : null}
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader title="System Settings" subtitle="Configure feature flags and tenant overrides." />

        {/* Feature Flags Section */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Feature Flags</h2>
              <p className="text-sm text-gray-500">Toggle features across the platform</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <input
              value={flagForm.code}
              onChange={(e) => setFlagForm({ ...flagForm, code: e.target.value })}
              placeholder="Flag code"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              value={flagForm.description}
              onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
              placeholder="Description"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <select
              value={flagForm.enabled ? 'true' : 'false'}
              onChange={(e) => setFlagForm({ ...flagForm, enabled: e.target.value === 'true' })}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <Button variant="primary" size="sm" onClick={() => {
              const error = flagForm.code.trim() ? '' : 'Flag code is required.';
              setFlagError(error);
              if (error) return;
              createFlagMutation.mutate(flagForm);
            }} disabled={createFlagMutation.isPending} loading={createFlagMutation.isPending} icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>} iconPosition="left">Create Flag</Button>
          {flagError && <p className="mt-3 text-sm font-semibold text-rose-600">{flagError}</p>}
          <div className="mt-6 space-y-3">
            {flags?.map((flag: { id: string; code: string; enabled: boolean; description?: string }) => (
              <div key={flag.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${flag.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{flag.code}</p>
                    {flag.description && <p className="text-xs text-gray-500">{flag.description}</p>}
                  </div>
                </div>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    flag.enabled 
                      ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100' 
                      : 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                  onClick={() => updateFlagMutation.mutate({ id: flag.id, enabled: !flag.enabled })}
                >
                  {flag.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
            {!flags?.length && (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600">No feature flags</p>
                <p className="text-xs text-gray-500">Create your first flag above</p>
              </div>
            )}
          </div>
        </section>

        {/* Config Entries Section */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Config Entries</h2>
              <p className="text-sm text-gray-500">Manage system configuration values</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <input
              value={configForm.key}
              onChange={(e) => setConfigForm({ ...configForm, key: e.target.value })}
              placeholder="Key"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <input
              value={configForm.value}
              onChange={(e) => setConfigForm({ ...configForm, value: e.target.value })}
              placeholder="Value"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <input
              value={configForm.description}
              onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
              placeholder="Description"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
          <Button variant="primary" size="sm" onClick={() => {
              let error = '';
              if (!configForm.key.trim()) error = 'Config key is required.';
              else if (!configForm.value.trim()) error = 'Config value is required.';
              setConfigError(error);
              if (error) return;
              createConfigMutation.mutate(configForm);
            }} disabled={createConfigMutation.isPending} loading={createConfigMutation.isPending} icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>} iconPosition="left">Create Config</Button>
          {configError && <p className="mt-3 text-sm font-semibold text-rose-600">{configError}</p>}
          <div className="mt-6 space-y-3">
            {configs?.map((config: { id: string; key: string; value: string; description?: string }) => (
              <div key={config.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-300 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{config.key}</p>
                  <p className="text-xs text-gray-600 font-mono">{config.value}</p>
                  {config.description && <p className="text-xs text-gray-500 mt-1">{config.description}</p>}
                </div>
                <button
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => updateConfigMutation.mutate({ id: config.id, value: config.value })}
                >
                  Save
                </button>
              </div>
            ))}
            {!configs?.length && (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600">No config entries</p>
                <p className="text-xs text-gray-500">Create your first config above</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
