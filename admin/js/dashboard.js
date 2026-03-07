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
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    container.innerHTML = Object.entries(users).map(([uid, u]) => `
      <div class="user-card">
        <div class="card-email">${u.email}</div>
        <div class="card-status ${statusClass(u.status)}">${u.status}</div>
        <div class="card-meta">
          ID: ${uid} &middot; Checked: ${timeAgo(u.last_checked)}
        </div>
      </div>
    `).join('');
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
      document.getElementById('user-cards').innerHTML = '';
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
