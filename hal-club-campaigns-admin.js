// HAL Garage · integración del administrador de campañas con la sesión interna.
(() => {
  const install = () => {
    if (window.__halClubCampaignsInstalled) return;
    if (typeof window.morePage !== 'function') return;
    window.__halClubCampaignsInstalled = true;

    const originalMore = window.morePage;
    window.morePage = async function () {
      await originalMore.apply(this, arguments);
      const app = document.getElementById('app');
      if (!app || document.querySelector('[data-hal-club-campaigns]')) return;
      if (typeof role !== 'function' || typeof isAdmin !== 'function') return;

      const r = role();
      if (!['admin','supervisor'].includes(r)) return;

      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-hal-club-campaigns', '1');
      card.innerHTML = `<b>⭐ Club HAL Garage</b>
        <div class="muted" style="margin-top:6px">Administración del programa de puntos</div>
        <button class="btn" onclick="openClubCampaignsAdmin()">⭐ Campañas de puntos</button>`;
      app.appendChild(card);
    };

    window.openClubCampaignsAdmin = () => {
      if (typeof role !== 'function' || !['admin','supervisor'].includes(role())) {
        if (typeof toast === 'function') toast('No tienes permiso para acceder.', true);
        return;
      }
      window.open('./club-hal-garage/admin-campanas.html', '_blank', 'noopener');
    };
  };

  install();
  const timer = setInterval(() => {
    install();
    if (window.__halClubCampaignsInstalled) clearInterval(timer);
  }, 250);
  setTimeout(() => clearInterval(timer), 10000);
})();
