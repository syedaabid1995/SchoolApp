import { metricsRegistry } from './metrics.service';

const resolveDomain = (keyOrDomain?: string) => {
  if (!keyOrDomain) return 'unknown';
  const parts = keyOrDomain.split(':');
  return parts.length > 1 ? parts[1] || 'unknown' : keyOrDomain;
};

export const RedisMetricsService = {
  recordCacheHit(keyOrDomain?: string) {
    metricsRegistry.increment('redis_cache_hits_total', 'Total Redis cache hits.', {
      domain: resolveDomain(keyOrDomain),
    });
  },

  recordCacheMiss(keyOrDomain?: string) {
    metricsRegistry.increment('redis_cache_misses_total', 'Total Redis cache misses.', {
      domain: resolveDomain(keyOrDomain),
    });
  },

  recordCacheSet(keyOrDomain?: string) {
    metricsRegistry.increment('redis_cache_sets_total', 'Total Redis cache set operations.', {
      domain: resolveDomain(keyOrDomain),
    });
  },

  recordRedisError(operation: string) {
    metricsRegistry.increment('redis_errors_total', 'Total Redis operation errors.', {
      operation,
    });
  },

  recordAuthorizationCacheHit(scope: string) {
    metricsRegistry.increment('authorization_cache_hits_total', 'Total authorization cache hits.', {
      scope,
    });
  },

  recordAuthorizationCacheMiss(scope: string) {
    metricsRegistry.increment('authorization_cache_misses_total', 'Total authorization cache misses.', {
      scope,
    });
  },

  recordAuthorizationCacheRebuild(scope: string) {
    metricsRegistry.increment('authorization_cache_rebuilds_total', 'Total authorization cache rebuilds.', {
      scope,
    });
  },

  recordAuthorizationCacheError(scope: string) {
    metricsRegistry.increment('authorization_cache_errors_total', 'Total authorization cache errors.', {
      scope,
    });
  },
};
