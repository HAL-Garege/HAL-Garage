// HAL Garage · acceso al centro de administración del Club.
(() => {
  const install = () => {
    if (window.__halClubAdminInstalled) return;
    if (typeof window.morePage !== 'function') return;
    window.__halClubAdminInstalled = true;
    const originalMore = window.morePage;
    window.morePage = async function () {
      await originalMore.apply(this, arguments);
      const app = document.getElementById('app');
      if (!app || document.querySelector('[data-hal-club-admin]')) return;
      if (typeof role !== 'function') return;
      const r = role();
      if (!['admin','supervisor'].includes(r)) return;

      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-hal-club-admin', '1');
      card.innerHTML = `<b>⭐ Club HAL Garage</b><div class="muted" style="margin-top:6px">Centro de administración del programa de fidelización</div><button class="btn" onclick="openClubAdmin()">⭐ Abrir Club</button>`;
      app.appendChild(card);
    };

    window.openClubAdmin = () => {
      if (typeof role !== 'function' || !['admin','supervisor'].includes(role())) {
        if (typeof toast === 'function') toast('No tienes permiso para acceder.', true);
        return;
      }
      window.open('./club-hal-garage/admin.html?role='+encodeURIComponent(role()), '_blank', 'noopener');
    };
  };
  install();
  const timer = setInterval(() => { install(); if (window.__halClubAdminInstalled) clearInterval(timer); }, 250);
  setTimeout(() => clearInterval(timer), 10000);
})();
