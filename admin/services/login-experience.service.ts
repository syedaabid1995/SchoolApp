import { api } from '../lib/api';

export type LoginTypeId = 'admin' | 'staff' | 'teacher' | 'student' | 'parent';
export type LoginAuthMode = 'password' | 'otp';

export type LoginExperienceTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  linkColor: string;
  errorColor: string;
  successColor: string;
};

export type LoginTypeConfig = {
  id: LoginTypeId;
  label: string;
  description: string;
  enabled: boolean;
  authMode: LoginAuthMode;
  requiresSchoolId: boolean;
  schoolIdOptional?: boolean;
  unavailableMessage?: string;
};

export type LoginExperience = {
  brandName: string;
  appName: string;
  consoleName: string;
  headline: string;
  subtitle: string;
  loginHeading: string;
  loginSubtitle: string;
  leftPanelTitle: string;
  leftPanelDescription: string;
  features: string[];
  securityNote: string;
  footerText: string;
  supportText: string;
  forgotPasswordText: string;
  loginButtonText: string;
  supportUrl: string;
  logoUrl: string;
  backgroundImageUrl: string;
  illustrationUrl: string;
  backgroundType: 'solid' | 'gradient' | 'image' | 'pattern';
  leftPanelEnabled: boolean;
  theme: LoginExperienceTheme;
  loginTypes: LoginTypeConfig[];
};

export const defaultLoginExperience: LoginExperience = {
  brandName: 'SchoolApp',
  appName: 'School Management System',
  consoleName: 'Admin Console',
  headline: 'Choose your login type',
  subtitle: 'Select your access role to continue to the right sign in method.',
  loginHeading: 'Welcome back',
  loginSubtitle: 'Sign in to continue to your dashboard',
  leftPanelTitle: 'Manage your school in one place',
  leftPanelDescription: 'Academics, attendance, exams, fees, and communication - all connected.',
  features: [
    'Multi-school management',
    'Attendance and exams',
    'Parent and teacher portal',
    'Secure role-based access',
  ],
  securityNote: 'Your session is protected with secure cookies.',
  footerText: '© 2026 School Management System. All rights reserved.',
  supportText: 'Need help? Contact your school administrator.',
  forgotPasswordText: 'Forgot password?',
  loginButtonText: 'Sign in',
  supportUrl: 'https://techstageit.com/#contact',
  logoUrl: '',
  backgroundImageUrl: '',
  illustrationUrl: '',
  backgroundType: 'gradient',
  leftPanelEnabled: true,
  theme: {
    primaryColor: '#0f172a',
    secondaryColor: '#0f172a',
    accentColor: '#0ea5e9',
    backgroundColor: '#eef4f8',
    panelColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    borderColor: '#e2e8f0',
    buttonBackgroundColor: '#2563eb',
    buttonTextColor: '#ffffff',
    linkColor: '#2563eb',
    errorColor: '#dc2626',
    successColor: '#16a34a',
  },
  loginTypes: [
    {
      id: 'admin',
      label: 'Admin',
      description: 'Platform and school administration access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: false,
      schoolIdOptional: true,
    },
    {
      id: 'staff',
      label: 'Staff',
      description: 'Office, accountant, librarian, and staff access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: true,
    },
    {
      id: 'teacher',
      label: 'Teacher',
      description: 'Classroom, timetable, attendance, and exam access',
      enabled: true,
      authMode: 'password',
      requiresSchoolId: true,
    },
    {
      id: 'student',
      label: 'Student',
      description: 'Student access',
      enabled: false,
      authMode: 'password',
      requiresSchoolId: true,
      unavailableMessage: 'Student login is not enabled yet.',
    },
    {
      id: 'parent',
      label: 'Parents',
      description: 'Parent portal access using mobile OTP or password',
      enabled: true,
      authMode: 'otp',
      requiresSchoolId: false,
    },
  ],
};

export const getLoginExperience = async (params?: { schoolId?: string }) => {
  const search = new URLSearchParams();
  if (params?.schoolId) search.set('schoolId', params.schoolId);
  const res = await fetch(`/api/proxy/auth/login-experience${search.toString() ? `?${search.toString()}` : ''}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return defaultLoginExperience;
  }
  return res.json() as Promise<LoginExperience>;
};

export const getLoginExperienceSettings = async () => {
  const { data } = await api.get<LoginExperience>('/features/login-experience');
  return data;
};

export const updateLoginExperienceSettings = async (payload: LoginExperience) => {
  const { data } = await api.put<LoginExperience>('/features/login-experience', payload);
  return data;
};
