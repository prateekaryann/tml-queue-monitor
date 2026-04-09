/* GitHub API wrapper — all API calls go through here */
const GitHubAPI = (() => {
  const OWNER = 'prateekaryann';
  const REPO = 'tml-queue-monitor';

  function getToken() {
    return localStorage.getItem('tml_gh_pat') || '';
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('tml_gh_pat', token.trim());
    } else {
      localStorage.removeItem('tml_gh_pat');
    }
    updateConnectionBadge();
  }

  function hasToken() {
    return !!getToken();
  }

  function updateConnectionBadge() {
    const el = document.getElementById('connection-status');
    if (!el) return;
    if (hasToken()) {
      el.textContent = 'Connected';
      el.className = 'conn-badge connected';
    } else {
      el.textContent = 'No PAT';
      el.className = 'conn-badge disconnected';
    }
  }

  async function request(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error('No PAT configured. Go to Settings to add one.');

    const url = `https://api.github.com${path}`
      .replace('{owner}', OWNER)
      .replace('{repo}', REPO);

    const resp = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });

    if (resp.status === 401) {
      setToken(null);
      throw new Error('PAT is invalid or expired. Update it in Settings.');
    }
    if (!resp.ok) {
      const body = await resp.text();
      const safeBody = body.slice(0, 200).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
      throw new Error(`GitHub API ${resp.status}: ${safeBody}`);
    }

    if (resp.status === 204) return null;
    return resp.json();
  }

  // Test the PAT by fetching repo info
  async function testConnection() {
    const data = await request('/repos/{owner}/{repo}');
    return { name: data.full_name, private: data.private };
  }

  // Trigger workflow_dispatch
  async function triggerWorkflow(workflowFile = 'monitor.yml') {
    await request(`/repos/{owner}/{repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    });
  }

  // List recent workflow runs
  async function listRuns(perPage = 20) {
    return request(`/repos/{owner}/{repo}/actions/runs?per_page=${perPage}`);
  }

  // List repository secrets (names only)
  async function listSecrets() {
    return request('/repos/{owner}/{repo}/actions/secrets');
  }

  // Get repo public key (for encrypting secrets)
  async function getPublicKey() {
    return request('/repos/{owner}/{repo}/actions/secrets/public-key');
  }

  // Update a secret (value must be encrypted)
  async function updateSecret(name, encryptedValue, keyId) {
    await request(`/repos/{owner}/{repo}/actions/secrets/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId }),
    });
  }

  return {
    OWNER, REPO,
    getToken, setToken, hasToken, updateConnectionBadge,
    request, testConnection,
    triggerWorkflow, listRuns, listSecrets,
    getPublicKey, updateSecret,
  };
})();
