import { api } from '../lib/api';

export type FeatureFlagStatus = 'ENABLED' | 'DISABLED';

export type FeatureFlag = {
  id: string;
  key: string;
  name?: string | null;
  description?: string | null;
  status: FeatureFlagStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateFeatureFlagInput = {
  key: string;
  name?: string;
  description?: string;
  status: FeatureFlagStatus;
};

export type UpdateFeatureFlagInput = {
  key?: string;
  name?: string | null;
  description?: string | null;
  status?: FeatureFlagStatus;
};

export type LegacyFeatureFlagInput = {
  code?: string;
  enabled?: boolean;
  key?: string;
  name?: string | null;
  description?: string | null;
  status?: FeatureFlagStatus;
};

export type ConfigValue = Record<string, unknown>;

export type ConfigEntry = {
  id: string;
  key: string;
  value: ConfigValue;
  description?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateConfigEntryInput = {
  key: string;
  description?: string;
  value: ConfigValue;
};

export type UpdateConfigEntryInput = {
  key?: string;
  description?: string | null;
  value?: ConfigValue;
};

const mapFeatureFlagFormToApi = (input: LegacyFeatureFlagInput): CreateFeatureFlagInput | UpdateFeatureFlagInput => {
  const status = input.status ?? (typeof input.enabled === 'boolean' ? (input.enabled ? 'ENABLED' : 'DISABLED') : undefined);

  return {
    key: input.key ?? input.code,
    name: input.name,
    description: input.description,
    status,
  };
};

export const listFeatureFlags = async () => {
  const { data } = await api.get<FeatureFlag[]>('/features/flags');
  return data;
};

export const createFeatureFlag = async (payload: CreateFeatureFlagInput | LegacyFeatureFlagInput) => {
  const { data } = await api.post<FeatureFlag>('/features/flags', mapFeatureFlagFormToApi(payload));
  return data;
};

export const updateFeatureFlag = async (id: string, payload: UpdateFeatureFlagInput | LegacyFeatureFlagInput) => {
  const { data } = await api.patch<FeatureFlag>(`/features/flags/${id}`, mapFeatureFlagFormToApi(payload));
  return data;
};

export const deleteFeatureFlag = async (id: string) => {
  await api.delete(`/features/flags/${id}`);
};

export const listConfigEntries = async () => {
  const { data } = await api.get<ConfigEntry[]>('/features/configs');
  return data;
};

export const createConfigEntry = async (payload: CreateConfigEntryInput) => {
  const { data } = await api.post<ConfigEntry>('/features/configs', payload);
  return data;
};

export const updateConfigEntry = async (id: string, payload: UpdateConfigEntryInput) => {
  const { data } = await api.patch<ConfigEntry>(`/features/configs/${id}`, payload);
  return data;
};
