import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const RUN_ID = __ENV.ACADEMIFY_RUN_ID || `auth-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const SUMMARY_DIR = __ENV.ACADEMIFY_SUMMARY_DIR || 'load-tests/k6/results';

const rawBaseUrl = __ENV.ACADEMIFY_BASE_URL || __ENV.BASE_URL || '';
const apiPrefix = normalizePath(__ENV.ACADEMIFY_API_PREFIX || '/api/v1');
const baseUrl = stripTrailingSlash(rawBaseUrl);
const rootBaseUrl = baseUrl.endsWith(apiPrefix)
  ? stripTrailingSlash(baseUrl.slice(0, -apiPrefix.length) || baseUrl)
  : baseUrl;
const apiBaseUrl = baseUrl.endsWith(apiPrefix) ? baseUrl : `${baseUrl}${apiPrefix}`;

const requestTimeout = __ENV.ACADEMIFY_REQUEST_TIMEOUT || '30s';
const profile = (__ENV.ACADEMIFY_AUTH_PROFILE || __ENV.ACADEMIFY_TEST_PROFILE || 'realistic').toLowerCase();
const minThinkSeconds = numberEnv('ACADEMIFY_MIN_THINK_SECONDS', numberEnv('ACADEMIFY_MIN_SLEEP_SECONDS', 1));
const maxThinkSeconds = numberEnv('ACADEMIFY_MAX_THINK_SECONDS', numberEnv('ACADEMIFY_MAX_SLEEP_SECONDS', 5));
const gracefulRampDown = __ENV.ACADEMIFY_GRACEFUL_RAMP_DOWN || '60s';
const loadTestKey = __ENV.ACADEMIFY_LOAD_TEST_KEY || '';
const logUnexpectedResponses = boolEnv('ACADEMIFY_LOG_UNEXPECTED_RESPONSES', false);
const enableReloginWeight = boolEnv('ACADEMIFY_ENABLE_RELOGIN_WEIGHT', false);
const discoverAttendanceFixture = boolEnv('ACADEMIFY_ATTENDANCE_DISCOVER_FIXTURE', false);
const attendanceSubmitEnabled = boolEnv('ACADEMIFY_ATTENDANCE_SUBMIT_ENABLED', true);
const attendanceSubmitLock = boolEnv('ACADEMIFY_ATTENDANCE_SUBMIT_LOCK', true);
const attendanceRecordLimit = numberEnv('ACADEMIFY_ATTENDANCE_RECORD_LIMIT', 10);
const studentListLimit = numberEnv('ACADEMIFY_STUDENT_LIST_LIMIT', 20);
const teacherListLimit = numberEnv('ACADEMIFY_TEACHER_LIST_LIMIT', 20);

const credentialPool = loadCredentialPool();
const explicitAttendanceFixture = loadExplicitAttendanceFixture();
const attendanceDates = loadAttendanceDates();
const attendanceStatus = __ENV.ACADEMIFY_ATTENDANCE_STATUS || 'PRESENT';
const attendanceRemarks = __ENV.ACADEMIFY_ATTENDANCE_REMARKS || '';

const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const serverErrors = new Counter('server_errors');
const memoryErrors = new Counter('memory_related_errors');
const timeoutErrors = new Counter('timeout_errors');
const networkErrors = new Counter('network_errors');
const attendanceSubmitSkipped = new Counter('attendance_submit_skipped');
const tokenRefreshFailures = new Counter('token_refresh_failures');

const loginSuccessRate = new Rate('login_success_rate');
const tokenRefreshFailureRate = new Rate('token_refresh_failure_rate');
const attendanceSubmitSuccessRate = new Rate('attendance_submit_success_rate');
const serverErrorRate = new Rate('server_error_rate');
const unexpectedStatusRate = new Rate('unexpected_status_rate');
const timeoutErrorRate = new Rate('timeout_error_rate');
const networkErrorRate = new Rate('network_error_rate');
const memoryErrorRate = new Rate('memory_error_rate');

const status0 = new Counter('http_status_0');
const status200 = new Counter('http_status_200');
const status201 = new Counter('http_status_201');
const status204 = new Counter('http_status_204');
const status304 = new Counter('http_status_304');
const status400 = new Counter('http_status_400');
const status401 = new Counter('http_status_401');
const status403 = new Counter('http_status_403');
const status404 = new Counter('http_status_404');
const status409 = new Counter('http_status_409');
const status422 = new Counter('http_status_422');
const status429 = new Counter('http_status_429');
const status500 = new Counter('http_status_500');
const status502 = new Counter('http_status_502');
const status503 = new Counter('http_status_503');
const status504 = new Counter('http_status_504');
const statusOther = new Counter('http_status_other');
const status2xx = new Counter('http_status_class_2xx');
const status3xx = new Counter('http_status_class_3xx');
const status4xx = new Counter('http_status_class_4xx');
const status5xx = new Counter('http_status_class_5xx');

const endpointLoginDuration = new Trend('endpoint_post_auth_login_duration', true);
const endpointRefreshDuration = new Trend('endpoint_post_auth_refresh_duration', true);
const endpointUsersMeDuration = new Trend('endpoint_get_users_me_duration', true);
const endpointDashboardDuration = new Trend('endpoint_get_dashboard_duration', true);
const endpointStudentsDuration = new Trend('endpoint_get_students_students_duration', true);
const endpointTeachersDuration = new Trend('endpoint_get_teachers_duration', true);
const endpointAttendanceSummaryDuration = new Trend('endpoint_get_attendance_summary_duration', true);
const endpointAttendanceSessionCreateDuration = new Trend('endpoint_post_attendance_sessions_duration', true);
const endpointAttendanceSubmitDuration = new Trend('endpoint_patch_attendance_sessions_duration', true);
const endpointHealthDuration = new Trend('endpoint_get_health_duration', true);

const statusCounters = {
  0: status0,
  200: status200,
  201: status201,
  204: status204,
  304: status304,
  400: status400,
  401: status401,
  403: status403,
  404: status404,
  409: status409,
  422: status422,
  429: status429,
  500: status500,
  502: status502,
  503: status503,
  504: status504,
};

let vuSession = null;

if (!baseUrl) {
  throw new Error('Set ACADEMIFY_BASE_URL, for example https://api.example.com or https://api.example.com/api/v1');
}

export const options = buildOptions();

export function setup() {
  validateCredentialPool();

  const health = http.get(urlFor('/health'), {
    timeout: requestTimeout,
    headers: baseHeaders(),
    tags: { name: 'GET /health', endpoint: 'GET /health', type: 'health' },
  });
  const healthOk = recordResponse({
    endpoint: 'GET /health',
    response: health,
    acceptedStatuses: [200],
    durationMetric: endpointHealthDuration,
  });
  if (!healthOk) {
    fail(`Health check failed before authenticated load test. Status: ${health.status}. URL: ${urlFor('/health')}`);
  }

  let discoveredFixture = null;
  if (!explicitAttendanceFixture && discoverAttendanceFixture) {
    discoveredFixture = discoverFixtureWithFirstCredential();
  }

  return {
    runId: RUN_ID,
    target: apiBaseUrl,
    rootTarget: rootBaseUrl,
    profile,
    loginStrategy: enableReloginWeight ? 'per-vu plus weighted re-login' : 'once per VU with token refresh',
    credentialCount: credentialPool.length,
    attendanceSubmitEnabled,
    attendanceFixtureSource: explicitAttendanceFixture ? 'explicit env' : discoveredFixture ? 'discovered from students list' : 'not configured',
    discoveredFixture,
    attendanceDates,
    stages: stagesFor(profile),
    thresholds: options.thresholds,
  };
}

export default function (data) {
  if (!ensureVuSession()) {
    sleep(randomBetween(minThinkSeconds, maxThinkSeconds));
    return;
  }

  const action = chooseAction();
  if (action === 'login') {
    runWeightedLogin();
  } else if (action === 'users_me') {
    getUsersMe();
  } else if (action === 'dashboard') {
    getDashboard();
  } else if (action === 'students') {
    getStudents();
  } else if (action === 'teachers') {
    getTeachers();
  } else if (action === 'attendance_summary') {
    getAttendanceSummary();
  } else if (action === 'attendance_submit') {
    submitAttendance(data);
  }

  sleep(randomBetween(minThinkSeconds, maxThinkSeconds));
}

export function handleSummary(data) {
  const summaryPath = `${SUMMARY_DIR}/summary-authenticated-${profile}-${RUN_ID}.json`;
  const logPath = `${SUMMARY_DIR}/k6-authenticated-${profile}-${RUN_ID}.log`;
  const manifestPath = `${SUMMARY_DIR}/manifest-authenticated-${profile}-${RUN_ID}.json`;

  const textSummary = buildTextSummary(data, summaryPath);
  const manifest = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    script: 'schoolapp-authenticated-load-test.js',
    target: apiBaseUrl,
    profile,
    loginStrategy: enableReloginWeight ? 'per-vu plus weighted re-login' : 'once per VU with token refresh',
    credentialCount: credentialPool.length,
    loadTestKeyHeaderEnabled: Boolean(loadTestKey),
    attendanceSubmitEnabled,
    attendanceFixtureConfigured: Boolean(explicitAttendanceFixture) || discoverAttendanceFixture,
    artifacts: {
      summary: summaryPath,
      log: logPath,
      manifest: manifestPath,
    },
  };

  return {
    stdout: textSummary,
    [summaryPath]: JSON.stringify(data, null, 2),
    [logPath]: textSummary,
    [manifestPath]: JSON.stringify(manifest, null, 2),
  };
}

function ensureVuSession() {
  if (vuSession?.accessToken) return true;
  vuSession = authenticate(credentialForVu(), { failOnError: false });
  return Boolean(vuSession?.accessToken);
}

function authenticate(credential, options = {}) {
  const payload = {
    ...(credential.email ? { email: credential.email } : {}),
    ...(credential.username ? { username: credential.username } : {}),
    password: credential.password,
    ...(credential.schoolCode ? { schoolCode: credential.schoolCode } : {}),
    ...(credential.schoolId ? { schoolId: credential.schoolId } : {}),
    ...(credential.loginType ? { loginType: credential.loginType } : {}),
    rememberMe: true,
  };

  const response = http.post(urlFor('/auth/login'), JSON.stringify(payload), {
    timeout: requestTimeout,
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/json',
      'x-client-platform': 'school-mobile',
    },
    tags: { name: 'POST /auth/login', endpoint: 'POST /auth/login', type: 'auth' },
  });

  const accepted = recordResponse({
    endpoint: 'POST /auth/login',
    response,
    acceptedStatuses: [200],
    durationMetric: endpointLoginDuration,
  });
  const body = parseJson(response);
  const loginOk = accepted && !body?.mfaRequired && Boolean(body?.accessToken);
  loginSuccessRate.add(loginOk);

  check(
    response,
    {
      'login returned access token': () => Boolean(body?.accessToken),
      'login did not require MFA': () => !body?.mfaRequired,
    },
    { endpoint: 'POST /auth/login' },
  );

  if (!loginOk) {
    const reason = body?.mfaRequired
      ? 'MFA is enabled for this account'
      : `status ${response.status}, body ${truncate(response.body, 500)}`;
    if (options.failOnError) {
      fail(`Login failed for load-test account: ${reason}`);
    }
    if (logUnexpectedResponses) {
      console.error(`Login failed for VU ${__VU}: ${reason}`);
    }
    return null;
  }

  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken || '',
    user: body.user || null,
  };
}

function runWeightedLogin() {
  const nextSession = authenticate(credentialForVu(), { failOnError: false });
  if (nextSession?.accessToken) {
    vuSession = nextSession;
  }
}

function refreshVuSession() {
  if (!vuSession?.refreshToken) {
    tokenRefreshFailures.add(1);
    tokenRefreshFailureRate.add(true);
    return false;
  }

  const response = http.post(
    urlFor('/auth/refresh'),
    JSON.stringify({ refreshToken: vuSession.refreshToken }),
    {
      timeout: requestTimeout,
      headers: {
        ...baseHeaders(),
        'Content-Type': 'application/json',
        'x-client-platform': 'school-mobile',
      },
      tags: { name: 'POST /auth/refresh', endpoint: 'POST /auth/refresh', type: 'auth' },
    },
  );

  const accepted = recordResponse({
    endpoint: 'POST /auth/refresh',
    response,
    acceptedStatuses: [200],
    durationMetric: endpointRefreshDuration,
  });
  const body = parseJson(response);
  const failed = !accepted || !body?.accessToken;
  tokenRefreshFailureRate.add(failed);
  if (failed) {
    tokenRefreshFailures.add(1);
    vuSession = null;
    return false;
  }

  vuSession.accessToken = body.accessToken;
  vuSession.refreshToken = body.refreshToken || vuSession.refreshToken;
  return true;
}

function getUsersMe() {
  authedGet('/users/me', {
    endpoint: 'GET /users/me',
    durationMetric: endpointUsersMeDuration,
  });
}

function getDashboard() {
  authedGet('/dashboard', {
    endpoint: 'GET /dashboard',
    durationMetric: endpointDashboardDuration,
  });
}

function getStudents() {
  authedGet(`/students/students?page=1&limit=${studentListLimit}`, {
    endpoint: 'GET /students/students',
    durationMetric: endpointStudentsDuration,
  });
}

function getTeachers() {
  authedGet(`/teachers?page=1&limit=${teacherListLimit}`, {
    endpoint: 'GET /teachers',
    durationMetric: endpointTeachersDuration,
  });
}

function getAttendanceSummary() {
  authedGet('/attendance-summary', {
    endpoint: 'GET /attendance-summary',
    durationMetric: endpointAttendanceSummaryDuration,
  });
}

function submitAttendance(data) {
  const fixture = explicitAttendanceFixture || data?.discoveredFixture;
  if (!attendanceSubmitEnabled || !fixture) {
    attendanceSubmitSkipped.add(1);
    attendanceSubmitSuccessRate.add(false);
    return;
  }

  const attendanceDate = attendanceDates[(__VU + __ITER) % attendanceDates.length];
  const createBody = {
    classId: fixture.classId,
    ...(fixture.sectionId ? { sectionId: fixture.sectionId } : {}),
    ...(fixture.schoolId ? { schoolId: fixture.schoolId } : {}),
    date: attendanceDate,
  };

  const createResponse = authedJson('POST', '/attendance/sessions', createBody, {
    endpoint: 'POST /attendance/sessions',
    acceptedStatuses: [201],
    durationMetric: endpointAttendanceSessionCreateDuration,
  });

  const sessionBody = parseJson(createResponse);
  const sessionId = sessionBody?.id;
  if (!sessionId) {
    attendanceSubmitSuccessRate.add(false);
    return;
  }

  const records = fixture.studentIds.slice(0, attendanceRecordLimit).map((studentId) => ({
    studentId,
    status: attendanceStatus,
    ...(attendanceRemarks ? { remarks: attendanceRemarks } : {}),
  }));

  const updateBody = {
    ...(fixture.schoolId ? { schoolId: fixture.schoolId } : {}),
    records,
    submit: attendanceSubmitLock,
  };

  const updateResponse = authedJson('PATCH', `/attendance/sessions/${sessionId}`, updateBody, {
    endpoint: 'PATCH /attendance/sessions/:id',
    acceptedStatuses: [200],
    durationMetric: endpointAttendanceSubmitDuration,
  });

  attendanceSubmitSuccessRate.add(updateResponse.status === 200);
}

function authedGet(path, requestOptions) {
  return authedRequest('GET', path, null, {
    acceptedStatuses: [200],
    ...requestOptions,
  });
}

function authedJson(method, path, body, requestOptions) {
  return authedRequest(method, path, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...requestOptions,
  });
}

function authedRequest(method, path, body, requestOptions) {
  const response = http.request(method, urlFor(path), body, {
    timeout: requestTimeout,
    headers: {
      ...baseHeaders(),
      Authorization: `Bearer ${vuSession.accessToken}`,
      ...(requestOptions.headers || {}),
    },
    tags: {
      name: requestOptions.endpoint,
      endpoint: requestOptions.endpoint,
      type: requestOptions.type || 'app',
    },
  });

  const accepted = recordResponse({
    endpoint: requestOptions.endpoint,
    response,
    acceptedStatuses: requestOptions.acceptedStatuses,
    durationMetric: requestOptions.durationMetric,
  });

  if (response.status === 401 && refreshVuSession()) {
    const retry = http.request(method, urlFor(path), body, {
      timeout: requestTimeout,
      headers: {
        ...baseHeaders(),
        Authorization: `Bearer ${vuSession.accessToken}`,
        ...(requestOptions.headers || {}),
      },
      tags: {
        name: `${requestOptions.endpoint} retry`,
        endpoint: requestOptions.endpoint,
        type: requestOptions.type || 'app',
      },
    });
    recordResponse({
      endpoint: requestOptions.endpoint,
      response: retry,
      acceptedStatuses: requestOptions.acceptedStatuses,
      durationMetric: requestOptions.durationMetric,
    });
    return retry;
  }

  if (!accepted && logUnexpectedResponses) {
    console.error(`${requestOptions.endpoint} returned ${response.status}. Body: ${truncate(response.body, 400)}`);
  }

  return response;
}

function discoverFixtureWithFirstCredential() {
  const previousSession = vuSession;
  vuSession = authenticate(credentialPool[0], { failOnError: true });
  const response = authedGet(`/students/students?page=1&limit=${Math.max(20, attendanceRecordLimit)}`, {
    endpoint: 'GET /students/students',
    durationMetric: endpointStudentsDuration,
  });
  const students = parseJson(response);
  vuSession = previousSession;

  if (!Array.isArray(students) || students.length === 0) {
    fail('ACADEMIFY_ATTENDANCE_DISCOVER_FIXTURE=true but no students were returned.');
  }

  const first = students.find((student) => student?.id && student?.classId) || students[0];
  if (!first?.id || !first?.classId) {
    fail('Could not discover attendance fixture. Provide ACADEMIFY_ATTENDANCE_CLASS_ID and ACADEMIFY_ATTENDANCE_STUDENT_IDS.');
  }

  const sameScope = students.filter((student) => {
    if (!student?.id || student.classId !== first.classId) return false;
    if (first.sectionId && student.sectionId !== first.sectionId) return false;
    return true;
  });

  return {
    classId: first.classId,
    sectionId: first.sectionId || undefined,
    studentIds: sameScope.slice(0, attendanceRecordLimit).map((student) => student.id),
  };
}

function chooseAction() {
  const weighted = enableReloginWeight
    ? [
        ['login', 10],
        ['users_me', 25],
        ['dashboard', 20],
        ['students', 20],
        ['teachers', 10],
        ['attendance_summary', 10],
      ]
    : [
        ['users_me', 25],
        ['dashboard', 20],
        ['students', 20],
        ['teachers', 10],
        ['attendance_summary', 10],
      ];
  if (attendanceSubmitEnabled) {
    weighted.push(['attendance_submit', 5]);
  }

  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (const [name, weight] of weighted) {
    cursor -= weight;
    if (cursor <= 0) return name;
  }
  return weighted[weighted.length - 1][0];
}

function buildOptions() {
  const thresholds = {
    checks: ['rate>0.95'],
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: profile === 'stress', delayAbortEval: '2m' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: profile === 'stress', delayAbortEval: '2m' }],
    server_error_rate: ['rate<0.05'],
    login_success_rate: ['rate>0.95'],
    token_refresh_failure_rate: ['rate<0.01'],
  };
  if (attendanceSubmitEnabled) {
    thresholds.attendance_submit_success_rate = ['rate>0.90'];
  }

  return {
    thresholds,
    scenarios: {
      authenticated_user_journey: {
        executor: 'ramping-vus',
        stages: stagesFor(profile),
        gracefulRampDown,
      },
    },
  };
}

function stagesFor(selectedProfile) {
  if (__ENV.ACADEMIFY_STAGES) {
    const parsed = JSON.parse(__ENV.ACADEMIFY_STAGES);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('ACADEMIFY_STAGES must be a JSON array like [{"duration":"1m","target":10}]');
    }
    return parsed;
  }

  const profiles = {
    smoke: [
      { duration: '10s', target: 1 },
      { duration: '50s', target: 1 },
      { duration: '10s', target: 0 },
    ],
    stage1: [
      { duration: '30s', target: 10 },
      { duration: '5m', target: 10 },
      { duration: '30s', target: 0 },
    ],
    stage2: [
      { duration: '30s', target: 25 },
      { duration: '5m', target: 25 },
      { duration: '30s', target: 0 },
    ],
    stage3: [
      { duration: '1m', target: 50 },
      { duration: '10m', target: 50 },
      { duration: '1m', target: 0 },
    ],
    stage4: [
      { duration: '1m', target: 100 },
      { duration: '10m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    realistic: [
      { duration: '30s', target: 10 },
      { duration: '5m', target: 10 },
      { duration: '30s', target: 25 },
      { duration: '5m', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '10m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '10m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    stress: [
      { duration: '30s', target: 10 },
      { duration: '5m', target: 10 },
      { duration: '30s', target: 25 },
      { duration: '5m', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '10m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '10m', target: 100 },
      { duration: '2m', target: 125 },
      { duration: '5m', target: 125 },
      { duration: '2m', target: 150 },
      { duration: '5m', target: 150 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],
  };

  if (!profiles[selectedProfile]) {
    throw new Error('Unknown ACADEMIFY_AUTH_PROFILE. Use smoke, stage1, stage2, stage3, stage4, realistic, or stress.');
  }
  return profiles[selectedProfile];
}

function recordResponse({ endpoint, response, acceptedStatuses, durationMetric }) {
  const status = response.status || 0;
  const accepted = acceptedStatuses.includes(status);
  const serverError = status >= 500 || status === 0;
  const timeout = isTimeout(response);
  const network = status === 0;
  const memory = isMemoryError(response);

  if (durationMetric && response.timings?.duration !== undefined) {
    durationMetric.add(response.timings.duration);
  }

  recordStatus(status);
  if (accepted) successfulRequests.add(1);
  else failedRequests.add(1);
  if (serverError) serverErrors.add(1);
  if (timeout) timeoutErrors.add(1);
  if (network) networkErrors.add(1);
  if (memory) memoryErrors.add(1);

  serverErrorRate.add(serverError, { endpoint });
  unexpectedStatusRate.add(!accepted, { endpoint });
  timeoutErrorRate.add(timeout, { endpoint });
  networkErrorRate.add(network, { endpoint });
  memoryErrorRate.add(memory, { endpoint });

  return check(
    response,
    {
      [`${endpoint} status accepted`]: () => accepted,
      [`${endpoint} no server/network error`]: () => !serverError,
    },
    { endpoint },
  );
}

function recordStatus(status) {
  const counter = statusCounters[status] || statusOther;
  counter.add(1);
  if (status >= 200 && status < 300) status2xx.add(1);
  else if (status >= 300 && status < 400) status3xx.add(1);
  else if (status >= 400 && status < 500) status4xx.add(1);
  else if (status >= 500) status5xx.add(1);
}

function urlFor(endpoint) {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  const path = normalizePath(endpoint);
  if (path === '/health' || path === '/metrics' || path === '/docs') return `${rootBaseUrl}${path}`;
  if (path.startsWith(apiPrefix)) return `${rootBaseUrl}${path}`;
  return `${apiBaseUrl}${path}`;
}

function baseHeaders() {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'academifyy-authenticated-k6-load-test',
  };
  if (loadTestKey) headers['x-load-test-key'] = loadTestKey;
  return headers;
}

function credentialForVu() {
  return credentialPool[(__VU - 1) % credentialPool.length];
}

function loadCredentialPool() {
  if (__ENV.ACADEMIFY_TEST_USERS_JSON) {
    const parsed = JSON.parse(__ENV.ACADEMIFY_TEST_USERS_JSON);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('ACADEMIFY_TEST_USERS_JSON must be a non-empty JSON array.');
    }
    return parsed.map((user) => ({
      email: user.email || '',
      username: user.username || '',
      password: user.password || '',
      schoolCode: user.schoolCode || __ENV.ACADEMIFY_SCHOOL_CODE || '',
      schoolId: user.schoolId || __ENV.ACADEMIFY_SCHOOL_ID || '',
      loginType: user.loginType || __ENV.ACADEMIFY_LOGIN_TYPE || 'admin',
    }));
  }

  const email = __ENV.ACADEMIFY_ADMIN_EMAIL || __ENV.ACADEMIFY_SCHOOL_ADMIN_EMAIL || __ENV.ACADEMIFY_EMAIL || __ENV.EMAIL || '';
  const username = __ENV.ACADEMIFY_USERNAME || __ENV.USERNAME || '';
  const password = __ENV.ACADEMIFY_ADMIN_PASSWORD || __ENV.ACADEMIFY_SCHOOL_ADMIN_PASSWORD || __ENV.ACADEMIFY_PASSWORD || __ENV.PASSWORD || '';
  return [
    {
      email,
      username,
      password,
      schoolCode: __ENV.ACADEMIFY_SCHOOL_CODE || '',
      schoolId: __ENV.ACADEMIFY_SCHOOL_ID || '',
      loginType: __ENV.ACADEMIFY_LOGIN_TYPE || 'admin',
    },
  ];
}

function validateCredentialPool() {
  for (const [index, credential] of credentialPool.entries()) {
    if ((!credential.email && !credential.username) || !credential.password) {
      fail(
        `Credential ${index + 1} is incomplete. Set ACADEMIFY_ADMIN_EMAIL or ACADEMIFY_USERNAME plus ` +
          'ACADEMIFY_ADMIN_PASSWORD, or provide ACADEMIFY_TEST_USERS_JSON.',
      );
    }
  }
}

function loadExplicitAttendanceFixture() {
  const classId = __ENV.ACADEMIFY_ATTENDANCE_CLASS_ID || '';
  const studentIds = parseCsv(__ENV.ACADEMIFY_ATTENDANCE_STUDENT_IDS || '');
  if (!classId || studentIds.length === 0) return null;
  return {
    classId,
    sectionId: __ENV.ACADEMIFY_ATTENDANCE_SECTION_ID || '',
    schoolId: __ENV.ACADEMIFY_ATTENDANCE_SCHOOL_ID || __ENV.ACADEMIFY_SCHOOL_ID || '',
    studentIds,
  };
}

function loadAttendanceDates() {
  const configured = parseCsv(__ENV.ACADEMIFY_ATTENDANCE_DATES || __ENV.ACADEMIFY_ATTENDANCE_DATE || '');
  return configured.length > 0 ? configured : [new Date().toISOString().slice(0, 10)];
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function isTimeout(response) {
  const text = `${response.error || ''} ${response.error_code || ''}`.toLowerCase();
  return text.includes('timeout') || text.includes('deadline');
}

function isMemoryError(response) {
  const text = `${response.error || ''} ${response.body || ''}`.toLowerCase();
  return text.includes('out of memory') || text.includes('heap') || text.includes('enomem');
}

function buildTextSummary(data, summaryPath) {
  const lines = [
    '',
    'Academifyy authenticated k6 load-test summary',
    `Run: ${RUN_ID}`,
    `Profile: ${profile}`,
    `Target: ${apiBaseUrl}`,
    `Login strategy: ${enableReloginWeight ? 'per-VU plus weighted re-login' : 'once per VU with token refresh'}`,
    `Attendance fixture: ${explicitAttendanceFixture ? 'configured' : discoverAttendanceFixture ? 'discovered' : 'not configured'}`,
    '',
    `Total requests: ${metricValue(data, 'http_reqs', 'count')}`,
    `Request rate: ${metricValue(data, 'http_reqs', 'rate', ' req/s')}`,
    `Successful requests: ${metricValue(data, 'successful_requests', 'count')}`,
    `Failed requests: ${metricValue(data, 'failed_requests', 'count')}`,
    `HTTP failure rate: ${metricPercent(data, 'http_req_failed', 'rate')}`,
    `Server error rate: ${metricPercent(data, 'server_error_rate', 'rate')}`,
    `Login success rate: ${metricPercent(data, 'login_success_rate', 'rate')}`,
    `Token refresh failure rate: ${metricPercent(data, 'token_refresh_failure_rate', 'rate')}`,
    `Attendance submit success rate: ${metricPercent(data, 'attendance_submit_success_rate', 'rate')}`,
    `p50 latency: ${metricValue(data, 'http_req_duration', 'med', ' ms')}`,
    `p90 latency: ${metricValue(data, 'http_req_duration', 'p(90)', ' ms')}`,
    `p95 latency: ${metricValue(data, 'http_req_duration', 'p(95)', ' ms')}`,
    `p99 latency: ${metricValue(data, 'http_req_duration', 'p(99)', ' ms')}`,
    `Data received: ${metricBytes(data, 'data_received')}`,
    `Data sent: ${metricBytes(data, 'data_sent')}`,
    '',
    `JSON summary: ${summaryPath}`,
    `Generate report: node load-tests/k6/generate-performance-report.mjs --summary ${summaryPath}`,
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

function metricBytes(data, metricName) {
  const metric = data.metrics[metricName];
  const count = metric?.values?.count;
  if (count === undefined || count === null) return 'n/a';
  return formatBytes(Number(count));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
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
