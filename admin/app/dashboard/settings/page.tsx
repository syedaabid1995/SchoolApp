'use client';

import { useState } from 'react';
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
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';
import LoginExperienceSettings from '../../../components/LoginExperienceSettings';

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

export default function SettingsPage() {
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
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const configsQuery = useQuery({
    queryKey: ['config-entries'],
    queryFn: listConfigEntries,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
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
  const configs = configsQuery.data ?? [];

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
    setFlagError('');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40">
      {isBusy ? <FullPageLoader label="Processing..." /> : null}
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader title="System Settings" subtitle="Configure feature flags and tenant overrides." />

        <LoginExperienceSettings />

        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex items-center gap-3">
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

          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <input
              value={flagForm.key}
              onChange={(event) => setFlagForm({ ...flagForm, key: normalizeFlagKey(event.target.value) })}
              placeholder="Feature key"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              value={flagForm.name}
              onChange={(event) => setFlagForm({ ...flagForm, name: event.target.value })}
              placeholder="Name"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              value={flagForm.description}
              onChange={(event) => setFlagForm({ ...flagForm, description: event.target.value })}
              placeholder="Description"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <select
              value={flagForm.status}
              onChange={(event) => setFlagForm({ ...flagForm, status: event.target.value as FeatureFlagStatus })}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="ENABLED">Enabled</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateFlag}
            disabled={createFlagMutation.isPending}
            loading={createFlagMutation.isPending}
            icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
            iconPosition="left"
          >
            Create Flag
          </Button>
          {flagError ? <p className="mt-3 text-sm font-semibold text-rose-600">{flagError}</p> : null}

          <div className="mt-6 space-y-3">
            {flagsQuery.isLoading ? <p className="text-sm text-gray-500">Loading feature flags...</p> : null}
            {flags.map((flag) => {
              const draft = getFlagDraft(flag);
              const isEnabled = flag.status === 'ENABLED';

              return (
                <div key={flag.id} className="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-blue-300">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{flag.key}</p>
                          <p className="text-xs text-gray-500">{flag.status}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={draft.name}
                          onChange={(event) => updateFlagDraft(flag, { name: event.target.value })}
                          placeholder="Name"
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <input
                          value={draft.description}
                          onChange={(event) => updateFlagDraft(flag, { description: event.target.value })}
                          placeholder="Description"
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isEnabled
                            ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                        onClick={() => handleToggleFlag(flag)}
                      >
                        {isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        onClick={() => handleSaveFlag(flag)}
                      >
                        Save
                      </button>
                      <button
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        onClick={() => deleteFlagMutation.mutate(flag.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!flagsQuery.isLoading && !flags.length ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600">No feature flags</p>
                <p className="text-xs text-gray-500">Create your first flag above</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Config Entries</h2>
              <p className="text-sm text-gray-500">Manage system configuration values as JSON objects</p>
            </div>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
            <input
              value={configForm.key}
              onChange={(event) => setConfigForm({ ...configForm, key: event.target.value })}
              placeholder="Key"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <input
              value={configForm.description}
              onChange={(event) => setConfigForm({ ...configForm, description: event.target.value })}
              placeholder="Description"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <textarea
              value={configForm.value}
              onChange={(event) => setConfigForm({ ...configForm, value: event.target.value })}
              placeholder='{"enabled": true}'
              rows={4}
              className="rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateConfig}
            disabled={createConfigMutation.isPending}
            loading={createConfigMutation.isPending}
            icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
            iconPosition="left"
          >
            Create Config
          </Button>
          {configError ? <p className="mt-3 text-sm font-semibold text-rose-600">{configError}</p> : null}

          <div className="mt-6 space-y-3">
            {configsQuery.isLoading ? <p className="text-sm text-gray-500">Loading config entries...</p> : null}
            {configs.map((config) => {
              const draft = getConfigDraft(config);
              return (
                <div key={config.id} className="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-purple-300">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-start">
                    <input
                      value={draft.key}
                      onChange={(event) => updateConfigDraft(config, { key: event.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                    <input
                      value={draft.description}
                      onChange={(event) => updateConfigDraft(config, { description: event.target.value })}
                      placeholder="Description"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                    <textarea
                      value={draft.value}
                      onChange={(event) => updateConfigDraft(config, { value: event.target.value })}
                      rows={5}
                      className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                    <button
                      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => handleSaveConfig(config)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
            {!configsQuery.isLoading && !configs.length ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600">No config entries</p>
                <p className="text-xs text-gray-500">Create your first config above</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
