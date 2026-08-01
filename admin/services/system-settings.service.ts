import { api } from '../lib/api';

export type GeneralSchoolSettings = {
  schoolName: string;
  siteTitle: string;
  address: string;
  phone: string;
  email: string;
  schoolCode: string;
  contacts: SchoolContactDetail[];
  currentSession: string;
  language: string;
  dateFormat: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
};

export type SchoolContactDetail = {
  id: string;
  department: string;
  name: string;
  email: string;
  contactNumber: string;
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
  caste: string[];
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

export type FeeChallanBankSetting = {
  id: string;
  bankName: string;
  branchAddress: string;
  accountNumber: string;
  instructions: string;
  logoDataUrl: string;
  logoFileName: string;
  logoMimeType: string;
  logoSize: number;
  isActive: boolean;
};

export type SchoolDocument = {
  id: string;
  title: string;
  documentNumber?: string | null;
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
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
  feeChallanBanks: FeeChallanBankSetting[];
  createdAt: string;
  updatedAt: string;
};

export type UpdateSchoolSystemSettingsInput = Partial<
  Pick<
    SchoolSystemSettings,
    'general' | 'paymentGateways' | 'baseSetups' | 'sessions' | 'holidays' | 'weekends' | 'smsSettings' | 'feeChallanBanks'
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

export const listSchoolDocuments = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<SchoolDocument[]>('/system-settings/school/documents', { params });
  return data;
};

export const uploadSchoolDocument = async (
  payload: { title: string; documentNumber?: string | null; file: File },
  params?: { schoolId?: string },
) => {
  const form = new FormData();
  form.append('title', payload.title);
  if (payload.documentNumber) form.append('documentNumber', payload.documentNumber);
  form.append('file', payload.file);
  const { data } = await api.post<SchoolDocument>('/system-settings/school/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params,
  });
  return data;
};

export const deleteSchoolDocument = async (documentId: string, params?: { schoolId?: string }) => {
  await api.delete(`/system-settings/school/documents/${documentId}`, { params });
};
