(() => {
  const loginView = document.getElementById('login-view');
  const panelView = document.getElementById('panel-view');
  const account = document.getElementById('account');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const resetRequestForm = document.getElementById('reset-request-form');
  const resetCompleteForm = document.getElementById('reset-complete-form');
  const resetEmail = document.getElementById('reset-email');
  const resetRequestMessage = document.getElementById('reset-request-message');
  const resetCompleteMessage = document.getElementById('reset-complete-message');
  const passwordDialog = document.getElementById('password-dialog');
  const notice = document.getElementById('notice');
  let csrf = '';
  let focusSessionId = '';
  let focusAccessId = '';
  const linkToken = window.location.hash.slice(1);
  const alertToken = window.location.pathname === '/sessions' ? linkToken : '';
  const accessToken = window.location.pathname === '/access' ? linkToken : '';
  if (linkToken) window.history.replaceState(null, '', window.location.pathname);

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const setNotice = (message, error = false) => {
    notice.textContent = message;
    notice.classList.toggle('error', error);
  };
  const api = async (path, options = {}) => {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (csrf && options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showLogin();
      throw new Error(data.message || 'Sign in to continue.');
    }
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  };
  const showLogin = () => {
    panelView.hidden = true;
    loginView.hidden = false;
    account.hidden = true;
    csrf = '';
    showAuthForm('login');
  };
  const showAuthForm = (name) => {
    loginForm.hidden = name !== 'login';
    resetRequestForm.hidden = name !== 'request';
    resetCompleteForm.hidden = name !== 'complete';
  };
  const showPanel = (username, token) => {
    csrf = token;
    loginView.hidden = true;
    panelView.hidden = false;
    account.hidden = false;
    document.getElementById('operator-name').textContent = username;
    loadActiveTab();
    if (alertToken) resolveAlertToken();
    if (accessToken) resolveAccessToken();
  };
  const fmt = (time) => new Date(Number(time)).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  async function loadSessions() {
    const data = await api('/api/sessions');
    const body = document.getElementById('sessions-body');
    body.replaceChildren();
    document.getElementById('session-count').textContent = String(data.sessions.length);
    document.getElementById('sessions-empty').hidden = data.sessions.length !== 0;
    for (const item of data.sessions) {
      const row = document.createElement('tr');
      row.dataset.sessionId = item.id;
      row.innerHTML = `<td>${escape(item.username)}</td><td class="ip-cell">${escape(item.ip)}</td><td>${escape(item.sourcePort)}</td><td>${escape(item.authMethod)}</td><td class="time-cell">${escape(fmt(item.startedAt))}</td><td></td>`;
      const actionCell = row.lastElementChild;
      if (item.controllable) {
        const revoke = document.createElement('button');
        revoke.className = 'button button-danger button-small';
        revoke.type = 'button';
        revoke.textContent = 'Revoke session';
        revoke.addEventListener('click', () => revokeSession(item, revoke));
        actionCell.append(revoke);
      } else {
        const label = document.createElement('span');
        label.className = 'no-control';
        label.textContent = 'Not safely controllable';
        actionCell.append(label);
      }
      if (item.id === focusSessionId) row.classList.add('session-focus');
      body.append(row);
    }
    document.getElementById('sessions-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }

  async function revokeSession(item, button) {
    if (!window.confirm(`Revoke the SSH session for ${item.username} from ${item.ip}:${item.sourcePort}? Only this exact connection will be closed.`)) return;
    button.disabled = true;
    try {
      const result = await api(`/api/sessions/${encodeURIComponent(item.id)}/revoke`, { method: 'POST' });
      setNotice(result.message);
      await loadSessions();
      await loadAudit();
    } catch (error) {
      setNotice(error.message, true);
      button.disabled = false;
    }
  }

  async function loadBlocks() {
    const data = await api('/api/blocks');
    const body = document.getElementById('blocks-body');
    body.replaceChildren();
    document.getElementById('block-count').textContent = String(data.blocks.filter((block) => block.enabled).length);
    document.getElementById('blocks-empty').hidden = data.blocks.length !== 0;
    for (const block of data.blocks) {
      const row = document.createElement('tr');
      row.innerHTML = `<td class="ip-cell">${escape(block.ip)}</td><td><span class="status ${block.enabled ? 'status-active' : 'status-disabled'}">${block.enabled ? 'Blocked' : 'Disabled'}</span></td><td class="time-cell">${escape(fmt(block.updated_at))}</td><td></td>`;
      const toggle = document.createElement('button');
      toggle.className = 'button button-secondary button-small';
      toggle.type = 'button';
      toggle.textContent = block.enabled ? 'Unblock' : 'Enable block';
      toggle.addEventListener('click', async () => {
        const action = block.enabled ? 'unblock' : 'enable';
        const prompt = block.enabled
          ? `Allow new SSH connections from ${block.ip}?`
          : `Block new SSH connections from ${block.ip} again?`;
        if (!window.confirm(prompt)) return;
        toggle.disabled = true;
        try {
          const result = await api(`/api/blocks/${encodeURIComponent(block.ip)}/${action}`, { method: 'POST' });
          setNotice(result.message);
          await loadBlocks();
          await loadAudit();
        } catch (error) { setNotice(error.message, true); toggle.disabled = false; }
      });
      row.lastElementChild.append(toggle);
      body.append(row);
    }
  }

  async function loadAccessRequests() {
    const data = await api('/api/access-requests');
    const body = document.getElementById('access-body');
    body.replaceChildren();
    document.getElementById('access-count').textContent = String(data.requests.length);
    document.getElementById('access-empty').hidden = data.requests.length !== 0;
    for (const item of data.requests) {
      const row = document.createElement('tr');
      row.dataset.accessId = item.id;
      row.innerHTML = `<td>${escape(item.username)}</td><td class="ip-cell">${escape(item.source_ip)}</td><td class="time-cell">${escape(fmt(item.issued_at))}</td><td class="time-cell">${escape(fmt(item.expires_at))}</td><td></td>`;
      if (item.id === focusAccessId) row.classList.add('session-focus');
      const approve = document.createElement('button');
      approve.className = 'button button-primary button-small';
      approve.type = 'button';
      approve.textContent = 'Approve 15 min';
      approve.addEventListener('click', async () => {
        if (!window.confirm(`Approve ${item.username} from ${item.source_ip} for a 15-minute SSH retry window? Valid SSH credentials are still required.`)) return;
        approve.disabled = true;
        try {
          const result = await api(`/api/access/${encodeURIComponent(item.id)}/approve`, { method: 'POST' });
          setNotice(result.message);
          await loadAccessRequests();
          await loadAudit();
        } catch (error) { setNotice(error.message, true); approve.disabled = false; }
      });
      row.lastElementChild.append(approve);
      body.append(row);
    }
  }

  async function loadAudit() {
    const data = await api('/api/audit');
    const integrity = document.getElementById('audit-integrity');
    integrity.textContent = data.chainValid ? 'Audit chain verified' : 'Audit integrity check failed';
    integrity.className = `status ${data.chainValid ? 'status-active' : 'status-disabled'}`;
    const body = document.getElementById('audit-body');
    body.replaceChildren();
    document.getElementById('audit-empty').hidden = data.events.length !== 0;
    for (const item of data.events) {
      const row = document.createElement('tr');
      row.innerHTML = `<td class="time-cell">${escape(fmt(item.created_at))}</td><td>${escape(item.actor)}</td><td>${escape(item.action)}</td><td class="ip-cell">${escape(item.target)}</td><td class="ip-cell">${escape(item.source_ip)}</td><td>${escape(item.result)}</td><td>${escape(item.details)}</td>`;
      body.append(row);
    }
  }

  async function loadActiveTab() {
    const active = document.querySelector('.tab.active')?.dataset.tab || 'sessions';
    try {
      if (active === 'sessions') await loadSessions();
      if (active === 'access') await loadAccessRequests();
      if (active === 'blocks') await loadBlocks();
      if (active === 'audit') await loadAudit();
    } catch (error) { setNotice(error.message, true); }
  }

  async function resolveAlertToken() {
    try {
      const result = await api('/api/alerts/resolve', { method: 'POST', body: JSON.stringify({ token: alertToken }) });
      focusSessionId = result.sessionId || '';
      if (result.expiresAt <= Date.now()) throw new Error('This review link has expired. The active session list is still available.');
      document.querySelector('[data-tab="sessions"]').click();
      await loadSessions();
      if (focusSessionId) document.querySelector(`[data-session-id="${CSS.escape(focusSessionId)}"]`)?.scrollIntoView({ block: 'center' });
      else setNotice('The alert link is valid, but that particular connection is no longer active.');
    } catch (error) { setNotice(error.message, true); }
  }

  async function resolveAccessToken() {
    try {
      const result = await api('/api/access/resolve', { method: 'POST', body: JSON.stringify({ token: accessToken }) });
      focusAccessId = result.request.id;
      document.querySelector('[data-tab="access"]').click();
      await loadAccessRequests();
      document.querySelector(`[data-access-id="${CSS.escape(focusAccessId)}"]`)?.scrollIntoView({ block: 'center' });
    } catch (error) { setNotice(error.message, true); }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';
    loginError.classList.remove('success-message');
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(loginForm));
      const result = await api('/api/login', { method: 'POST', body: JSON.stringify(data) });
      loginForm.reset();
      showPanel(result.username, result.csrf);
    } catch (error) { loginError.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  document.getElementById('forgot-password').addEventListener('click', () => {
    resetEmail.value = document.getElementById('username').value;
    resetRequestMessage.textContent = '';
    showAuthForm('request');
  });
  document.getElementById('back-to-login').addEventListener('click', () => showAuthForm('login'));
  resetRequestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = resetRequestForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    resetRequestMessage.textContent = '';
    try {
      const result = await api('/api/password-reset/request', {
        method: 'POST', body: JSON.stringify({ email: resetEmail.value.trim() }),
      });
      resetCompleteMessage.textContent = result.message;
      document.getElementById('reset-code').value = '';
      showAuthForm('complete');
    } catch (error) { resetRequestMessage.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  document.getElementById('request-another-code').addEventListener('click', () => {
    resetRequestMessage.textContent = '';
    showAuthForm('request');
  });
  resetCompleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetCompleteMessage.textContent = '';
    const password = resetCompleteForm.elements.password.value;
    if (password !== resetCompleteForm.elements.confirmPassword.value) {
      resetCompleteMessage.textContent = 'The new passwords do not match.';
      return;
    }
    const submit = resetCompleteForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api('/api/password-reset/complete', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail.value.trim(), code: resetCompleteForm.elements.code.value.trim(), password }),
      });
      document.getElementById('username').value = resetEmail.value.trim();
      loginError.textContent = result.message;
      loginError.classList.add('success-message');
      resetCompleteForm.reset();
      showAuthForm('login');
    } catch (error) { resetCompleteMessage.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  document.getElementById('change-password').addEventListener('click', () => {
    document.getElementById('password-change-form').reset();
    document.getElementById('password-change-message').textContent = '';
    passwordDialog.showModal();
  });
  document.getElementById('cancel-password-change').addEventListener('click', () => passwordDialog.close());
  passwordDialog.addEventListener('click', (event) => {
    if (event.target === passwordDialog) passwordDialog.close();
  });
  document.getElementById('password-change-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById('password-change-message');
    const newPassword = form.elements.newPassword.value;
    if (newPassword !== form.elements.confirmPassword.value) {
      message.textContent = 'The new passwords do not match.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = '';
    try {
      const result = await api('/api/account/password', {
        method: 'POST', body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword }),
      });
      message.textContent = result.message;
      await loadAudit();
      window.setTimeout(() => passwordDialog.close(), 1200);
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  document.getElementById('logout').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    showLogin();
  });
  document.getElementById('refresh').addEventListener('click', loadActiveTab);
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => { item.classList.toggle('active', item === tab); item.removeAttribute('aria-current'); });
    tab.setAttribute('aria-current', 'page');
    document.querySelectorAll('.panel-section').forEach((panel) => { panel.hidden = panel.id !== `${tab.dataset.tab}-panel`; });
    loadActiveTab();
  }));
  document.getElementById('block-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const ip = new FormData(form).get('ip').trim();
    if (!window.confirm(`Block ${ip} from making new SSH connections to this server? Existing sessions from this IP remain open. If this is your current management IP, you may lose SSH access.`)) return;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const reason = new FormData(form).get('reason').trim();
      const result = await api('/api/blocks', { method: 'POST', body: JSON.stringify({ ip, reason }) });
      form.reset();
      setNotice(result.message);
      await loadBlocks();
      await loadAudit();
    } catch (error) { setNotice(error.message, true); }
    finally { button.disabled = false; }
  });

  api('/api/me').then((data) => showPanel(data.username, data.csrf)).catch(showLogin);
})();
