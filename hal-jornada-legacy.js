// Jornada: mantener la pantalla original y rápida.
// El formulario original ya vive en index.html como workdayPage().
// Este archivo no reemplaza ni modifica esa implementación.
(() => {
  if (typeof window.workdayPage === 'function') {
    window.jornadaPage = window.workdayPage;
  }
})();
