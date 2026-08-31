// Botón de gastos para Caja. No altera el diseño ni la lógica existente.
(() => {
  const originalCashPage = window.cashPage;
  if (typeof originalCashPage !== 'function') return;

  async function injectExpenseButton() {
    const app = document.getElementById('app');
    if (!app || document.querySelector('[data-hal-caja-gasto]')) return;

    // Solo Administrador y Supervisor pueden registrar gastos.
    if (!(typeof isAdmin === 'function' && (isAdmin() || role() === 'supervisor'))) return;
    if (typeof newExpense !== 'function') return;

    const title = Array.from(app.querySelectorAll('.title')).find(e => e.textContent.trim() === 'Caja');
    if (!title) return;

    const box = document.createElement('div');
    box.setAttribute('data-hal-caja-gasto','1');
    box.className = 'card';
    box.innerHTML = `<b>Gastos</b><div class="muted" style="margin-top:5px">Registra un gasto de caja para que quede incluido en el reporte mensual.</div><button class="btn red" id="halCajaGastoBtn">＋ AÑADIR GASTO</button>`;
    title.insertAdjacentElement('afterend', box);
    box.querySelector('#halCajaGastoBtn').onclick = () => newExpense();
  }

  window.cashPage = async function() {
    await originalCashPage();
    await injectExpenseButton();
  };
})();
