// HAL Garage · acceso al sistema independiente de Comisionistas.
(() => {
  const install=()=>{
    if(window.__halCommissionersAdminInstalled||typeof window.morePage!=='function')return;
    window.__halCommissionersAdminInstalled=true;
    const originalMore=window.morePage;
    window.morePage=async function(){
      await originalMore.apply(this,arguments);
      const app=document.getElementById('app');
      if(!app||document.querySelector('[data-hal-commissioners-admin]'))return;
      const r=typeof role==='function'?role():null;
      if(!['admin','supervisor'].includes(r))return;
      const card=document.createElement('div');
      card.className='card';card.setAttribute('data-hal-commissioners-admin','1');
      card.innerHTML='<b>🤝 Comisionistas HAL Garage</b><div class="muted" style="margin-top:6px">Administración de comisionistas, referidos, comisiones y liquidaciones.</div><button class="btn" onclick="openCommissionersAdmin()">🤝 Abrir Comisionistas</button>';
      app.appendChild(card);
    };
    window.openCommissionersAdmin=()=>{
      const r=typeof role==='function'?role():null;
      if(!['admin','supervisor'].includes(r)){if(typeof toast==='function')toast('No tienes permiso para acceder.',true);return;}
      location.href='./comisionistas/admin.html';
    };
  };
  install();const timer=setInterval(()=>{install();if(window.__halCommissionersAdminInstalled)clearInterval(timer)},250);setTimeout(()=>clearInterval(timer),10000);
})();