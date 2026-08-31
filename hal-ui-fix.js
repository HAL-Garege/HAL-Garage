(() => {
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));

  // Remove the Jornada shortcut from Más without using a global MutationObserver.
  const originalMore = window.morePage;
  if (typeof originalMore === 'function') {
    window.morePage = async function () {
      await originalMore();
      document.querySelectorAll('#app button').forEach(b => {
        if (/jornada y almuerzo/i.test(b.textContent || '') || /jornada y personal/i.test(b.textContent || '')) b.remove();
      });
    };
  }

  // Keep a single Jornada screen. If an older route calls workdayPage, use the current Jornada screen.
  const originalJornada = window.jornadaPage;
  if (typeof originalJornada === 'function') {
    const tidy = () => {
      const history = [...document.querySelectorAll('#app .card')].find(c => /Historia de jornada/i.test(c.textContent || ''));
      if (!history) return;
      history.querySelectorAll('.result').forEach(result => {
        const top = result.querySelector('.row');
        if (!top || top.dataset.halActions === '1') return;
        const buttons = [...result.querySelectorAll('button')];
        const photo = buttons.find(b => /ver fotos/i.test(b.textContent || ''));
        const edit = buttons.find(b => /editar/i.test(b.textContent || ''));
        const del = buttons.find(b => /borrar|eliminar/i.test(b.textContent || ''));
        if (!photo && !edit && !del) return;
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;align-items:center';
        [photo, edit, del].filter(Boolean).forEach(b => {
          b.style.width = 'auto'; b.style.margin = '0'; b.style.padding = '7px 9px'; b.style.fontSize = '11px';
          actions.appendChild(b);
        });
        top.appendChild(actions);
        top.style.flexWrap = 'wrap';
        top.style.alignItems = 'center';
        top.dataset.halActions = '1';
      });
    };
    window.jornadaPage = async function () { await originalJornada(); tidy(); };
    window.workdayPage = window.jornadaPage;
  }
})();
