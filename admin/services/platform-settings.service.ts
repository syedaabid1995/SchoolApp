export type PlatformThemeMode = 'light' | 'dark' | 'system';

export type PlatformGeneralSettings = {
  platformName: string;
  consoleName: string;
  supportEmail: string;
  supportUrl: string;
  footerText: string;
  defaultThemeMode: PlatformThemeMode;
  maintenanceMode: boolean;
};

export const PLATFORM_GENERAL_CONFIG_KEY = 'platform.general';

export const DEFAULT_PLATFORM_GENERAL_SETTINGS: PlatformGeneralSettings = {
  platformName: 'SAAPT',
  consoleName: 'School Management Console',
  supportEmail: 'support@schoolapp.local',
  supportUrl: '',
  footerText: 'SAAPT - School Management Console',
  defaultThemeMode: 'system',
  maintenanceMode: false,
};

const isThemeMode = (value: unknown): value is PlatformThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

const stringValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

export const normalizePlatformGeneralSettings = (value: unknown): PlatformGeneralSettings => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  return {
    platformName: stringValue(source.platformName, DEFAULT_PLATFORM_GENERAL_SETTINGS.platformName),
    consoleName: stringValue(source.consoleName, DEFAULT_PLATFORM_GENERAL_SETTINGS.consoleName),
    supportEmail: stringValue(source.supportEmail, DEFAULT_PLATFORM_GENERAL_SETTINGS.supportEmail),
    supportUrl: typeof source.supportUrl === 'string' ? source.supportUrl.trim() : DEFAULT_PLATFORM_GENERAL_SETTINGS.supportUrl,
    footerText: stringValue(source.footerText, DEFAULT_PLATFORM_GENERAL_SETTINGS.footerText),
    defaultThemeMode: isThemeMode(source.defaultThemeMode)
      ? source.defaultThemeMode
      : DEFAULT_PLATFORM_GENERAL_SETTINGS.defaultThemeMode,
    maintenanceMode:
      typeof source.maintenanceMode === 'boolean'
        ? source.maintenanceMode
        : DEFAULT_PLATFORM_GENERAL_SETTINGS.maintenanceMode,
  };
};
