/* Logs panel — list workflow runs */
const Logs = (() => {

  function timeAgo(isoStr) {
    if (!isoStr) return '?';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function formatDuration(startStr, endStr) {
    if (!startStr || !endStr) return '...';
    const ms = new Date(endStr) - new Date(startStr);
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  function badgeClass(status, conclusion) {
    if (status !== 'completed') return 'in_progress';
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure') return 'failure';
    return 'cancelled';
  }

  async function refresh() {
    const body = document.getElementById('runs-body');
    const empty = document.getElementById('logs-empty');

    if (!GitHubAPI.hasToken()) {
      body.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    try {
      const data = await GitHubAPI.listRuns(30);
      const runs = data.workflow_runs || [];

      if (runs.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">No runs found</td></tr>';
        return;
      }

      body.innerHTML = runs.map(run => `
        <tr>
          <td>#${run.run_number}</td>
          <td>
            <span class="run-badge ${badgeClass(run.status, run.conclusion)}">
              ${run.status === 'completed' ? run.conclusion : run.status}
            </span>
          </td>
          <td>${timeAgo(run.created_at)}</td>
          <td>${formatDuration(run.run_started_at, run.updated_at)}</td>
          <td>
            <a href="${run.html_url}" target="_blank" class="btn btn-sm">View</a>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      body.innerHTML = `<tr><td colspan="5" style="color:var(--red)">${e.message}</td></tr>`;
    }
  }

  return { refresh };
})();
