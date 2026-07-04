import http from 'k6/http';
import { check, fail, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const RUN_ID = __ENV.ACADEMIFY_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const SUMMARY_DIR = __ENV.ACADEMIFY_SUMMARY_DIR || 'load-tests/k6/results';

const rawBaseUrl = __ENV.ACADEMIFY_BASE_URL || __ENV.BASE_URL || '';
const apiPrefix = normalizePath(__ENV.ACADEMIFY_API_PREFIX || '/api/v1');
const baseUrl = stripTrailingSlash(rawBaseUrl);
const rootBaseUrl = baseUrl.endsWith(apiPrefix)
  ? stripTrailingSlash(baseUrl.slice(0, -apiPrefix.length) || baseUrl)
  : baseUrl;
const apiBaseUrl = baseUrl.endsWith(apiPrefix) ? baseUrl : `${baseUrl}${apiPrefix}`;

const testProfile = (__ENV.ACADEMIFY_TEST_PROFILE || 'smoke').toLowerCase();
const testMode = (__ENV.ACADEMIFY_TEST_MODE || 'vus').toLowerCase();
const requestTimeout = __ENV.ACADEMIFY_REQUEST_TIMEOUT || '30s';
const minSleepSeconds = numberEnv('ACADEMIFY_MIN_SLEEP_SECONDS', 0.5);
const maxSleepSeconds = numberEnv('ACADEMIFY_MAX_SLEEP_SECONDS', 2);
const skipAuth = boolEnv('ACADEMIFY_SKIP_AUTH', false);
const requireHealth = boolEnv('ACADEMIFY_REQUIRE_HEALTH', true);
const hitHealthEachIteration = boolEnv('ACADEMIFY_HEALTH_EACH_ITERATION', false);
const logUnexpectedResponses = boolEnv('ACADEMIFY_LOG_UNEXPECTED_RESPONSES', false);
const loadTestKey = __ENV.ACADEMIFY_LOAD_TEST_KEY || '';

const acceptedStatuses = parseStatusSet(__ENV.ACADEMIFY_ACCEPTED_STATUSES || '200,204,304');
const readEndpoints = parseCsv(
  __ENV.ACADEMIFY_READ_ENDPOINTS || '/users/me,/notifications/summary',
);

const serverErrorRate = new Rate('server_error_rate');
const unexpectedStatusRate = new Rate('unexpected_status_rate');
const totalReadRequests = new Counter('schoolapp_read_requests');

if (!baseUrl) {
  throw new Error('Set ACADEMIFY_BASE_URL, for example https://api.example.com or https://api.example.com/api/v1');
}

export const options = buildOptions();

export function setup() {
  const health = http.get(urlFor('/health'), {
    timeout: requestTimeout,
    tags: { name: 'GET /health', type: 'health' },
  });
  const healthOk = recordResponse('/health', health);
  if (!healthOk && requireHealth) {
    fail(`Health check failed before load test. Status: ${health.status}. URL: ${urlFor('/health')}`);
  }

  if (skipAuth) {
    return { headers: baseHeaders(), user: null };
  }

  const email = __ENV.ACADEMIFY_SCHOOL_ADMIN_EMAIL || __ENV.ACADEMIFY_EMAIL || __ENV.EMAIL;
  const username = __ENV.ACADEMIFY_USERNAME || __ENV.USERNAME;
  const password = __ENV.ACADEMIFY_SCHOOL_ADMIN_PASSWORD || __ENV.ACADEMIFY_PASSWORD || __ENV.PASSWORD;
  const schoolCode = __ENV.ACADEMIFY_SCHOOL_CODE;
  const schoolId = __ENV.ACADEMIFY_SCHOOL_ID;
  const loginType = __ENV.ACADEMIFY_LOGIN_TYPE || 'admin';

  if ((!email && !username) || !password) {
    fail(
      'Set ACADEMIFY_SCHOOL_ADMIN_EMAIL or ACADEMIFY_USERNAME, plus ACADEMIFY_SCHOOL_ADMIN_PASSWORD. ' +
        'For public-only tests, set ACADEMIFY_SKIP_AUTH=true and ACADEMIFY_READ_ENDPOINTS=/health.',
    );
  }

  const payload = {
    ...(email ? { email } : {}),
    ...(username ? { username } : {}),
    password,
    ...(schoolCode ? { schoolCode } : {}),
    ...(schoolId ? { schoolId } : {}),
    ...(loginType ? { loginType } : {}),
    rememberMe: true,
  };

  const login = http.post(urlFor('/auth/login'), JSON.stringify(payload), {
    timeout: requestTimeout,
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/json',
      'x-client-platform': 'school-mobile',
    },
    tags: { name: 'POST /auth/login', type: 'auth' },
  });

  const loginOk = check(login, {
    'login returned 200': (res) => res.status === 200,
    'login returned JSON': (res) => Boolean(parseJson(res)),
  });
  recordResponse('/auth/login', login);

  if (!loginOk) {
    fail(`Login failed before load test. Status: ${login.status}. Body: ${truncate(login.body, 500)}`);
  }

  const body = parseJson(login);
  if (body?.mfaRequired) {
    fail('Login requires MFA. Use a dedicated non-MFA load-test account or run a public-only test.');
  }
  if (!body?.accessToken) {
    fail('Login succeeded but no accessToken was returned. The k6 script expects mobile-style token response.');
  }

  return {
    headers: {
      ...baseHeaders(),
      Authorization: `Bearer ${body.accessToken}`,
    },
    user: body.user || null,
  };
}

export default function (data) {
  if (hitHealthEachIteration) {
    const health = http.get(urlFor('/health'), {
      timeout: requestTimeout,
      tags: { name: 'GET /health', type: 'health' },
    });
    recordResponse('/health', health);
  }

  if (readEndpoints.length > 0) {
    group('read endpoint batch', () => {
      const responses = http.batch(
        readEndpoints.map((endpoint) => [
          'GET',
          urlFor(endpoint),
          null,
          {
            timeout: requestTimeout,
            headers: data.headers,
            tags: {
              name: endpointName(endpoint),
              endpoint: endpointName(endpoint),
              type: endpoint === '/health' ? 'health' : 'read',
            },
          },
        ]),
      );

      for (let i = 0; i < responses.length; i += 1) {
        totalReadRequests.add(1);
        recordResponse(readEndpoints[i], responses[i]);
      }
    });
  }

  sleep(randomBetween(minSleepSeconds, maxSleepSeconds));
}

export function handleSummary(data) {
  const profileLabel = `${testMode}-${testProfile}`;
  return {
    stdout: buildTextSummary(data),
    [`${SUMMARY_DIR}/summary-${profileLabel}-${RUN_ID}.json`]: JSON.stringify(data, null, 2),
  };
}

function buildOptions() {
  const thresholds = thresholdsFor(testProfile);
  if (testMode === 'rps') {
    const rate = numberEnv('ACADEMIFY_RPS', 20);
    const duration = __ENV.ACADEMIFY_DURATION || '5m';
    const preAllocatedVUs = numberEnv('ACADEMIFY_PRE_ALLOCATED_VUS', Math.max(10, Math.ceil(rate / 2)));
    const maxVUs = numberEnv('ACADEMIFY_MAX_VUS', Math.max(preAllocatedVUs * 2, rate * 2));

    return {
      thresholds,
      scenarios: {
        api_rps: {
          executor: 'constant-arrival-rate',
          rate,
          timeUnit: '1s',
          duration,
          preAllocatedVUs,
          maxVUs,
        },
      },
    };
  }

  return {
    thresholds,
    scenarios: {
      user_journey: {
        executor: 'ramping-vus',
        stages: stagesFor(testProfile),
        gracefulRampDown: __ENV.ACADEMIFY_GRACEFUL_RAMP_DOWN || '30s',
      },
    },
  };
}

function stagesFor(profile) {
  if (__ENV.ACADEMIFY_STAGES) {
    const parsed = JSON.parse(__ENV.ACADEMIFY_STAGES);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('ACADEMIFY_STAGES must be a JSON array like [{"duration":"1m","target":10}]');
    }
    return parsed;
  }

  const profiles = {
    smoke: [
      { duration: '20s', target: 1 },
      { duration: '40s', target: 1 },
      { duration: '10s', target: 0 },
    ],
    baseline: [
      { duration: '1m', target: 5 },
      { duration: '3m', target: 10 },
      { duration: '1m', target: 0 },
    ],
    load: [
      { duration: '2m', target: 10 },
      { duration: '3m', target: 25 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 0 },
    ],
    stress: [
      { duration: '2m', target: 25 },
      { duration: '4m', target: 50 },
      { duration: '4m', target: 100 },
      { duration: '4m', target: 150 },
      { duration: '3m', target: 200 },
      { duration: '2m', target: 0 },
    ],
    spike: [
      { duration: '30s', target: 10 },
      { duration: '30s', target: 150 },
      { duration: '2m', target: 150 },
      { duration: '30s', target: 10 },
      { duration: '30s', target: 0 },
    ],
    soak: [
      { duration: '2m', target: 25 },
      { duration: '30m', target: 25 },
      { duration: '2m', target: 0 },
    ],
  };

  if (!profiles[profile]) {
    throw new Error(`Unknown ACADEMIFY_TEST_PROFILE "${profile}". Use smoke, baseline, load, stress, spike, or soak.`);
  }
  return profiles[profile];
}

function thresholdsFor(profile) {
  const relaxed = profile === 'stress' || profile === 'spike';
  return {
    checks: [relaxed ? 'rate>0.95' : 'rate>0.98'],
    http_req_failed: [relaxed ? 'rate<0.05' : 'rate<0.02'],
    http_req_duration: [
      relaxed ? 'p(95)<1500' : 'p(95)<800',
      relaxed ? 'p(99)<3500' : 'p(99)<2000',
    ],
    server_error_rate: [relaxed ? 'rate<0.03' : 'rate<0.01'],
    unexpected_status_rate: [relaxed ? 'rate<0.05' : 'rate<0.02'],
  };
}

function recordResponse(endpoint, response) {
  const accepted = acceptedStatuses.has(response.status);
  const serverError = response.status === 0 || response.status >= 500;
  const endpointTag = endpointName(endpoint);

  serverErrorRate.add(serverError, { endpoint: endpointTag });
  unexpectedStatusRate.add(!accepted, { endpoint: endpointTag });

  const ok = check(
    response,
    {
      'status is accepted': () => accepted,
      'no server/network error': () => !serverError,
    },
    { endpoint: endpointTag },
  );

  if (!accepted && logUnexpectedResponses) {
    console.error(
      `${endpointTag} returned ${response.status}. Body: ${truncate(response.body, 400)}`,
    );
  }

  return ok;
}

function urlFor(endpoint) {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  const path = normalizePath(endpoint);
  if (path === '/health' || path === '/metrics' || path === '/docs') return `${rootBaseUrl}${path}`;
  if (path.startsWith(apiPrefix)) return `${rootBaseUrl}${path}`;
  return `${apiBaseUrl}${path}`;
}

function endpointName(endpoint) {
  if (/^https?:\/\//.test(endpoint)) return `GET ${endpoint.split('?')[0]}`;
  return `GET ${normalizePath(endpoint).split('?')[0]}`;
}

function baseHeaders() {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'schoolapp-k6-load-test',
  };
  if (loadTestKey) headers['x-load-test-key'] = loadTestKey;
  return headers;
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function buildTextSummary(data) {
  const lines = [
    '',
    'SchoolApp k6 load-test summary',
    `Run: ${RUN_ID}`,
    `Mode/Profile: ${testMode}/${testProfile}`,
    `Target: ${apiBaseUrl}`,
    `Read endpoints: ${readEndpoints.join(', ') || '(none)'}`,
    '',
    `Checks pass rate: ${metricPercent(data, 'checks', 'rate')}`,
    `HTTP failure rate: ${metricPercent(data, 'http_req_failed', 'rate')}`,
    `Server error rate: ${metricPercent(data, 'server_error_rate', 'rate')}`,
    `Unexpected status rate: ${metricPercent(data, 'unexpected_status_rate', 'rate')}`,
    `HTTP req duration p95: ${metricValue(data, 'http_req_duration', 'p(95)', 'ms')}`,
    `HTTP req duration p99: ${metricValue(data, 'http_req_duration', 'p(99)', 'ms')}`,
    `Requests: ${metricValue(data, 'http_reqs', 'count')}`,
    `Read requests: ${metricValue(data, 'schoolapp_read_requests', 'count')}`,
    '',
    `JSON summary: ${SUMMARY_DIR}/summary-${testMode}-${testProfile}-${RUN_ID}.json`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function metricValue(data, metricName, valueName, suffix = '') {
  const metric = data.metrics[metricName];
  const value = metric?.values?.[valueName];
  if (value === undefined || value === null) return 'n/a';
  return `${Number(value).toFixed(valueName === 'count' ? 0 : 2)}${suffix}`;
}

function metricPercent(data, metricName, valueName) {
  const metric = data.metrics[metricName];
  const value = metric?.values?.[valueName];
  if (value === undefined || value === null) return 'n/a';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function normalizePath(value) {
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStatusSet(value) {
  return new Set(
    parseCsv(value)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item)),
  );
}

function boolEnv(name, fallback) {
  const value = __ENV[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberEnv(name, fallback) {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function randomBetween(min, max) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
