/* Controls panel — trigger checks, manage users */
const Controls = (() => {

  async function triggerCheck() {
    const btn = document.getElementById('btn-trigger');
    const status = document.getElementById('trigger-status');

    if (!GitHubAPI.hasToken()) {
      status.className = 'status-msg error';
      status.textContent = 'No PAT configured. Go to Settings first.';
      return;
    }

    btn.disabled = true;
    status.className = 'status-msg info';
    status.textContent = 'Triggering workflow...';

    try {
      await GitHubAPI.triggerWorkflow();
      status.className = 'status-msg success';
      status.textContent = 'Workflow triggered! It will run in ~10 seconds.';
      // Poll for completion
      setTimeout(() => pollLatestRun(status), 10000);
    } catch (e) {
      status.className = 'status-msg error';
      status.textContent = `Failed: ${e.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  async function pollLatestRun(statusEl) {
    try {
      const data = await GitHubAPI.listRuns(1);
      const run = data.workflow_runs[0];
      if (run && run.status === 'completed') {
        statusEl.className = `status-msg ${run.conclusion === 'success' ? 'success' : 'error'}`;
        statusEl.textContent = `Run completed: ${run.conclusion}`;
      } else if (run && run.status !== 'completed') {
        statusEl.className = 'status-msg info';
        statusEl.textContent = `Run status: ${run.status}...`;
        setTimeout(() => pollLatestRun(statusEl), 5000);
      }
    } catch {
      // silently stop polling
    }
  }

  function loadCurrentUsers() {
    const textarea = document.getElementById('users-input');
    const status = document.getElementById('users-status');

    // Load from the dashboard status.json (masked emails, but shows structure)
    fetch(`data/status.json?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        const lines = Object.entries(data.users || {})
          .map(([uid, u]) => `${uid}:${u.email}`)
          .join('\n');
        textarea.value = lines || '(no users found in status)';
        status.className = 'status-msg info';
        status.textContent = 'Loaded from status.json (emails are masked). Enter full values before saving.';
      })
      .catch(() => {
        status.className = 'status-msg error';
        status.textContent = 'Failed to load status.json';
      });
  }

  async function saveUsers() {
    const textarea = document.getElementById('users-input');
    const status = document.getElementById('users-status');
    const raw = textarea.value.trim();

    if (!raw) {
      status.className = 'status-msg error';
      status.textContent = 'Enter at least one user (uuid:email format).';
      return;
    }

    if (!GitHubAPI.hasToken()) {
      status.className = 'status-msg error';
      status.textContent = 'No PAT configured. Go to Settings first.';
      return;
    }

    // Convert newline-separated to pipe-separated
    const usersValue = raw.split('\n')
      .map(l => l.trim())
      .filter(l => l && l.includes(':'))
      .join('|');

    if (!usersValue) {
      status.className = 'status-msg error';
      status.textContent = 'Invalid format. Use uuid:email, one per line.';
      return;
    }

    status.className = 'status-msg info';
    status.textContent = 'Encrypting and saving...';

    try {
      const keyData = await GitHubAPI.getPublicKey();
      const encrypted = await encryptSecret(usersValue, keyData.key);
      await GitHubAPI.updateSecret('USERS', encrypted, keyData.key_id);
      status.className = 'status-msg success';
      status.textContent = `USERS secret updated (${usersValue.split('|').length} user(s)). Takes effect on next run.`;
    } catch (e) {
      status.className = 'status-msg error';
      status.textContent = `Failed: ${e.message}`;
    }
  }

  // Encrypt a secret value using libsodium sealed box (via Web Crypto + tweetnacl)
  async function encryptSecret(secretValue, base64PublicKey) {
    // Decode the public key
    const publicKey = Uint8Array.from(atob(base64PublicKey), c => c.charCodeAt(0));
    const messageBytes = new TextEncoder().encode(secretValue);

    // Use tweetnacl-sealedbox if available, otherwise fall back to a simpler approach
    if (typeof nacl !== 'undefined' && nacl.sealedBox) {
      const encrypted = nacl.sealedBox.seal(messageBytes, publicKey);
      return btoa(String.fromCharCode(...encrypted));
    }

    // Fallback: use the SubtleCrypto API approach
    // Import the public key for X25519
    throw new Error(
      'Encryption library not loaded. Please add tweetnacl to enable secret updates, ' +
      'or update USERS directly in GitHub Settings: ' +
      `https://github.com/${GitHubAPI.OWNER}/${GitHubAPI.REPO}/settings/secrets/actions/USERS`
    );
  }

  return { triggerCheck, loadCurrentUsers, saveUsers };
})();
