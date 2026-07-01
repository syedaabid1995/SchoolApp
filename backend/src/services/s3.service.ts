import {
  getRuntimeObject,
  getSignedDownloadUrl,
  getSignedDownloadUrlForStoredRef,
  localVirtualUrlForKey,
  publicCompatibleUrlForKey,
  putRuntimeObject,
  storageKeyFromRef,
  verifyLocalSignedStorageUrl,
} from './runtimeStorage.service';
import { env } from '../config/env';

export const getBucketName = () => env.S3_BUCKET ?? 'local';

export { verifyLocalSignedStorageUrl };

export const uploadBuffer = async (params: {
  key: string;
  body: Buffer;
  contentType: string;
}) => {
  const result = await putRuntimeObject({
    key: params.key,
    body: params.body,
    contentType: params.contentType,
  });

  return {
    bucket: result.bucket,
    key: result.key,
    url: publicCompatibleUrlForKey(result.key),
  };
};

export const getSignedUrlForKey = async (params: { key: string; expiresInSeconds?: number }) =>
  getSignedDownloadUrl({ key: params.key, expiresInSeconds: params.expiresInSeconds });

export const storageKeyFromUrl = (value: string) => storageKeyFromRef(value);

export const getSignedUrlForStoredUrl = async (params: { url: string; expiresInSeconds?: number }) =>
  getSignedDownloadUrlForStoredRef({ storageRef: params.url, expiresInSeconds: params.expiresInSeconds });

export const getObjectForKey = async (params: { key: string }) => getRuntimeObject({ key: params.key });

export const localPublicUrlForKey = (key: string) => localVirtualUrlForKey(key);
