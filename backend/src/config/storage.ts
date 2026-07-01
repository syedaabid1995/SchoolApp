export type StorageDriver = 'local' | 's3';

export type StorageSafetyConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  storageDriver: StorageDriver;
  allowLocalStorageInProduction: boolean;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
};

export const assertSafeStorageConfig = (config: StorageSafetyConfig) => {
  if (
    config.nodeEnv === 'production' &&
    config.storageDriver === 'local' &&
    !config.allowLocalStorageInProduction
  ) {
    throw new Error(
      'Production local storage is disabled. Set STORAGE_DRIVER=s3, or explicitly set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true only for a reviewed temporary maintenance window.',
    );
  }

  if (config.storageDriver === 's3') {
    const missing = [
      ['S3_BUCKET', config.s3Bucket],
      ['S3_REGION', config.s3Region],
      ['S3_ACCESS_KEY_ID', config.s3AccessKeyId],
      ['S3_SECRET_ACCESS_KEY', config.s3SecretAccessKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length) {
      throw new Error(`S3 storage is configured but required settings are missing: ${missing.join(', ')}`);
    }
  }
};
