export type SignedUploadAssetType =
  | 'student-document'
  | 'student-photo'
  | 'staff-document'
  | 'attendance-evidence';

export type SignedUploadAssetRef = {
  type: SignedUploadAssetType;
  id?: string | null;
};

export type StudentPhotoCarrier = {
  id: string;
  photoUrl?: string | null;
  photos?: Array<{ id: string; url?: string | null }>;
};

const apiRootForUploads = (apiBaseUrl: string) => apiBaseUrl.replace(/\/api\/v1\/?$/, '');

const isObjectStorageUrl = (value: string) => {
  try {
    return new URL(value).protocol === 's3:';
  } catch {
    return false;
  }
};

const isUploadStorageUrl = (value: string) => {
  if (isObjectStorageUrl(value)) return true;
  if (value.startsWith('/uploads/')) return true;
  try {
    return new URL(value).pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
};

export const signedUploadUrl = (asset?: SignedUploadAssetRef | null) => {
  if (!asset?.id) return null;
  const params = new URLSearchParams({ type: asset.type, id: asset.id });
  return `/api/proxy/uploads/signed?${params.toString()}`;
};

export const resolveUploadUrl = (
  value?: string | null,
  asset?: SignedUploadAssetRef | null,
  apiBaseUrl = '',
) => {
  if (!value) return null;

  const signed = signedUploadUrl(asset);
  if (signed && isUploadStorageUrl(value)) return signed;

  if (isObjectStorageUrl(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const base = apiRootForUploads(apiBaseUrl);
  return value.startsWith('/') ? `${base}${value}` : `${base}/${value}`;
};

export const getStudentPhotoAsset = (student?: StudentPhotoCarrier | null) => {
  const value = student?.photoUrl ?? student?.photos?.[0]?.url ?? null;
  if (!student || !value) return { value: null, asset: null };

  const photoRecord = student.photos?.find((photo) => photo.url === value) ?? student.photos?.[0] ?? null;
  return {
    value,
    asset: { type: 'student-photo', id: photoRecord?.id ?? student.id } satisfies SignedUploadAssetRef,
  };
};

export const resolveStudentPhotoUrl = (
  student?: StudentPhotoCarrier | null,
  apiBaseUrl = '',
) => {
  const { value, asset } = getStudentPhotoAsset(student);
  return resolveUploadUrl(value, asset, apiBaseUrl);
};
