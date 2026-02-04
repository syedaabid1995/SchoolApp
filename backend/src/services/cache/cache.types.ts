export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export type CacheResult<T> = {
  value: T;
  status: CacheStatus;
};

