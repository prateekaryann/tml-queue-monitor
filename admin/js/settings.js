/* Settings panel — PAT management, secret status */
const Settings = (() => {

  function savePat() {
    const input = document.getElementById('pat-input');
    const status = document.getElementById('pat-status');
    const val = input.value.trim();

    if (!val) {
      status.className = 'status-msg error';
      status.textContent = 'Enter a token first.';
      return;
    }

    GitHubAPI.setToken(val);
    input.value = '';
    status.className = 'status-msg success';
    status.textContent = 'PAT saved to browser. Use "Test" to verify.';
  }

  async function testPat() {
    const status = document.getElementById('pat-status');

    if (!GitHubAPI.hasToken()) {
      status.className = 'status-msg error';
      status.textContent = 'No PAT saved. Enter one first.';
      return;
    }

    status.className = 'status-msg info';
    status.textContent = 'Testing connection...';

    try {
      const info = await GitHubAPI.testConnection();
      status.className = 'status-msg success';
      status.textContent = `Connected to ${info.name} (${info.private ? 'private' : 'public'})`;
      // Refresh dependent panels
      loadSecrets();
    } catch (e) {
      status.className = 'status-msg error';
      status.textContent = `Failed: ${e.message}`;
    }
  }

  function clearPat() {
    GitHubAPI.setToken(null);
    document.getElementById('pat-input').value = '';
    const status = document.getElementById('pat-status');
    status.className = 'status-msg info';
    status.textContent = 'PAT cleared from browser.';
    document.getElementById('secrets-list').innerHTML = '';
    document.getElementById('secrets-empty').style.display = 'block';
  }

  const EXPECTED_SECRETS = ['USERS', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID', 'SMTP_EMAIL', 'SMTP_PASSWORD'];

  async function loadSecrets() {
    const container = document.getElementById('secrets-list');
    const empty = document.getElementById('secrets-empty');

    if (!GitHubAPI.hasToken()) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    try {
      const data = await GitHubAPI.listSecrets();
      const secretNames = (data.secrets || []).map(s => s.name);
      const secretMap = {};
      (data.secrets || []).forEach(s => { secretMap[s.name] = s; });

      const editBase = `https://github.com/${GitHubAPI.OWNER}/${GitHubAPI.REPO}/settings/secrets/actions`;

      container.innerHTML = EXPECTED_SECRETS.map(name => {
        const exists = secretNames.includes(name);
        const secret = secretMap[name];
        const updated = secret ? new Date(secret.updated_at).toLocaleDateString() : '';
        return `
          <div class="secret-item">
            <div>
              <a href="${editBase}/${name}" target="_blank" class="secret-name">${name}</a>
              ${updated ? `<span class="secret-meta"> &middot; updated ${updated}</span>` : ''}
            </div>
            <span class="secret-badge ${exists ? 'set' : 'missing'}">
              ${exists ? 'Set' : 'Not set'}
            </span>
          </div>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML = `<div class="empty-state" style="padding:12px;color:var(--red)">${e.message}</div>`;
    }
  }

  function init() {
    if (GitHubAPI.hasToken()) {
      loadSecrets();
    }
  }

  return { savePat, testPat, clearPat, loadSecrets, init };
})();
