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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [flagForm, setFlagForm] = useState({ code: '', description: '', enabled: true });
  const [configForm, setConfigForm] = useState({ key: '', value: '', description: '' });
  const [flagError, setFlagError] = useState('');
  const [configError, setConfigError] = useState('');

  const { data: flags } = useQuery({ queryKey: ['feature-flags'], queryFn: listFeatureFlags });
  const { data: configs } = useQuery({ queryKey: ['config-entries'], queryFn: listConfigEntries });

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-slate">Configure feature flags and tenant overrides.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Feature Flags</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={flagForm.code}
            onChange={(e) => setFlagForm({ ...flagForm, code: e.target.value })}
            placeholder="Flag code"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={flagForm.description}
            onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
            placeholder="Description"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={flagForm.enabled ? 'true' : 'false'}
            onChange={(e) => setFlagForm({ ...flagForm, enabled: e.target.value === 'true' })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            const error = flagForm.code.trim() ? '' : 'Flag code is required.';
            setFlagError(error);
            if (error) return;
            createFlagMutation.mutate(flagForm);
          }}
          disabled={createFlagMutation.isPending}
        >
          Create Flag
        </button>
        {flagError ? <p className="mt-3 text-sm font-semibold text-rose-600">{flagError}</p> : null}
        <div className="mt-4 space-y-2 text-sm">
          {flags?.map((flag: { id: string; code: string; enabled: boolean }) => (
            <div key={flag.id} className="flex items-center justify-between rounded-lg border border-slate/10 px-3 py-2">
              <span>{flag.code}</span>
              <button
                className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                onClick={() => updateFlagMutation.mutate({ id: flag.id, enabled: !flag.enabled })}
              >
                {flag.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Config Entries</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={configForm.key}
            onChange={(e) => setConfigForm({ ...configForm, key: e.target.value })}
            placeholder="Key"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={configForm.value}
            onChange={(e) => setConfigForm({ ...configForm, value: e.target.value })}
            placeholder="Value"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={configForm.description}
            onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
            placeholder="Description"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            let error = '';
            if (!configForm.key.trim()) error = 'Config key is required.';
            else if (!configForm.value.trim()) error = 'Config value is required.';
            setConfigError(error);
            if (error) return;
            createConfigMutation.mutate(configForm);
          }}
          disabled={createConfigMutation.isPending}
        >
          Create Config
        </button>
        {configError ? <p className="mt-3 text-sm font-semibold text-rose-600">{configError}</p> : null}
        <div className="mt-4 space-y-2 text-sm">
          {configs?.map((config: { id: string; key: string; value: string }) => (
            <div key={config.id} className="flex items-center justify-between rounded-lg border border-slate/10 px-3 py-2">
              <span>
                {config.key}: {config.value}
              </span>
              <button
                className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                onClick={() => updateConfigMutation.mutate({ id: config.id, value: config.value })}
              >
                Save
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
