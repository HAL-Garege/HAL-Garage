// Botón de gasto en Inicio para todos los perfiles operativos.
// No modifica precios, ventas ni permisos de corrección.
(() => {
  const originalDashboard = window.dashboard;
  if (typeof originalDashboard !== 'function') return;

  async function injectExpenseButton() {
    const app = document.getElementById('app');
    if (!app || document.querySelector('[data-hal-inicio-gasto]')) return;
    if (typeof newExpense !== 'function') return;

    const title = Array.from(app.querySelectorAll('.title')).find(e => e.textContent.trim() === 'Inicio');
    if (!title) return;

    const box = document.createElement('div');
    box.setAttribute('data-hal-inicio-gasto','1');
    box.className = 'card';
    box.innerHTML = `<b>Gastos</b><div class="muted" style="margin-top:5px">Registra un gasto de caja directamente desde Inicio.</div><button class="btn red" id="halInicioGastoBtn">＋ AÑADIR GASTO</button>`;
    title.insertAdjacentElement('afterend', box);
    box.querySelector('#halInicioGastoBtn').onclick = () => newExpense();
  }

  window.dashboard = async function() {
    await originalDashboard();
    await injectExpenseButton();
  };
})();
