/* Main app — routing, init */
(function () {
  // Panel navigation
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.panel');

  function showPanel(name) {
    panels.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const panel = document.getElementById(`panel-${name}`);
    const nav = document.querySelector(`[data-panel="${name}"]`);
    if (panel) panel.classList.add('active');
    if (nav) nav.classList.add('active');

    // Refresh data when switching panels
    if (name === 'dashboard') Dashboard.refresh();
    if (name === 'logs') Logs.refresh();
    if (name === 'settings') Settings.init();
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const panel = item.dataset.panel;
      if (panel) {
        showPanel(panel);
        history.replaceState(null, '', `#${panel}`);
      }
    });
  });

  // Toast utility
  window.showToast = function (msg, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  };

  // Init
  GitHubAPI.updateConnectionBadge();
  Dashboard.startAutoRefresh(30000);

  // Handle hash navigation
  const hash = location.hash.replace('#', '') || 'dashboard';
  showPanel(hash);
})();
