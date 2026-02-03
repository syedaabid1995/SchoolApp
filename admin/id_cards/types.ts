export type IdCardTemplate = {
  slug: string;
  name: string;
  description: string;
  variant: 'classic' | 'split' | 'ribbon' | 'badge' | 'minimal' | 'panel' | 'wave' | 'frame' | 'duotone' | 'clean';
  backgroundPattern?: 'gradient' | 'wavy' | 'crystal' | 'mesh' | 'rings';
  bgFrom: string;
  bgTo: string;
  accent: string;
  text: 'light' | 'dark';
};

export type IdCardRecord = {
  id: string;
  name: string;
  role: string;
  schoolName?: string;
  admissionNo?: string | null;
  employeeNo?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  dob?: string | null;
  photoUrl?: string | null;
};
