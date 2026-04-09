/* Dashboard panel — fetches status.json and renders cards */
const Dashboard = (() => {
  let refreshTimer = null;

  async function fetchStatus() {
    const resp = await fetch(`data/status.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`Failed to fetch status: ${resp.status}`);
    return resp.json();
  }

  function timeAgo(isoStr) {
    if (!isoStr) return 'never';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function renderHealth(healthy) {
    const el = document.getElementById('system-health');
    el.className = `health-bar ${healthy ? 'healthy' : 'degraded'}`;
    el.textContent = healthy
      ? 'System Healthy — Queue API is responding'
      : 'System Degraded — Queue API may be down';
  }

  function statusClass(status) {
    if (status === 'in_queue') return 'in_queue';
    if (status === 'error' || status === 'unknown') return 'error';
    return 'ready';
  }

  function renderUsers(users) {
    const container = document.getElementById('user-cards');
    const empty = document.getElementById('dashboard-empty');

    if (!users || Object.keys(users).length === 0) {
      container.replaceChildren();
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    container.innerHTML = '';
    Object.entries(users).forEach(([uid, u]) => {
      const card = document.createElement('div');
      card.className = 'user-card';

      const email = document.createElement('div');
      email.className = 'card-email';
      email.textContent = u.email;

      const status = document.createElement('div');
      status.className = `card-status ${statusClass(u.status)}`;
      status.textContent = u.status;

      const meta = document.createElement('div');
      meta.className = 'card-meta';
      meta.textContent = `ID: ${uid} \u00B7 Checked: ${timeAgo(u.last_checked)}`;

      card.append(email, status, meta);
      container.appendChild(card);
    });
  }

  async function refresh() {
    const updateEl = document.getElementById('last-update');
    try {
      const data = await fetchStatus();
      renderHealth(data.system_healthy);
      renderUsers(data.users);
      updateEl.textContent = `Updated: ${timeAgo(data.generated_at)}`;
    } catch (e) {
      updateEl.textContent = 'Failed to load status';
      document.getElementById('dashboard-empty').style.display = 'block';
      document.getElementById('user-cards').replaceChildren();
    }
  }

  function startAutoRefresh(intervalMs = 30000) {
    stopAutoRefresh();
    refresh();
    refreshTimer = setInterval(refresh, intervalMs);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return { refresh, startAutoRefresh, stopAutoRefresh };
})();
