import { api } from '../lib/api';

export type GeneralSchoolSettings = {
  schoolName: string;
  siteTitle: string;
  address: string;
  phone: string;
  email: string;
  schoolCode: string;
  currentSession: string;
  language: string;
  dateFormat: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
};

export type PaymentGatewaySettings = {
  id: string;
  name: string;
  enabled: boolean;
  mode: string;
  username?: string;
  clientId?: string;
  secretId?: string;
  signature?: string;
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  merchantKey?: string;
  merchantSalt?: string;
  merchantEmail?: string;
};

export type BaseSetups = {
  gender: string[];
  religion: string[];
  bloodGroup: string[];
};

export type SchoolSessionSetting = {
  id: string;
  title: string;
  isActive: boolean;
};

export type HolidaySetting = {
  id: string;
  title: string;
  fromDate: string;
  toDate: string;
  details: string;
};

export type WeekendSetting = {
  id: string;
  name: string;
  isWeekend: boolean;
};

export type SmsSystemSettings = {
  activeProvider: string;
  clickatell: {
    username: string;
    password: string;
    apiId: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    registeredPhoneNumber: string;
  };
};

export type SchoolSystemSettings = {
  id: string;
  schoolId: string;
  general: GeneralSchoolSettings;
  paymentGateways: PaymentGatewaySettings[];
  baseSetups: BaseSetups;
  sessions: SchoolSessionSetting[];
  holidays: HolidaySetting[];
  weekends: WeekendSetting[];
  smsSettings: SmsSystemSettings;
  createdAt: string;
  updatedAt: string;
};

export type UpdateSchoolSystemSettingsInput = Partial<
  Pick<
    SchoolSystemSettings,
    'general' | 'paymentGateways' | 'baseSetups' | 'sessions' | 'holidays' | 'weekends' | 'smsSettings'
  >
> & {
  schoolId?: string;
};

export const getSchoolSystemSettings = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<SchoolSystemSettings>('/system-settings/school', { params });
  return data;
};

export const updateSchoolSystemSettings = async (payload: UpdateSchoolSystemSettingsInput) => {
  const { data } = await api.put<SchoolSystemSettings>('/system-settings/school', payload);
  return data;
};
