// HAL Garage — botón Editar directo en Historial
// No depende de clientHistory ni de detectar el ID desde texto.
(() => {
  function addButtons(){
    const app=document.getElementById('app');
    if(!app)return;
    app.querySelectorAll('.card').forEach(card=>{
      if(card.dataset.halHistoryEdit==='1')return;
      const text=card.textContent||'';
      const m=text.match(/Venta\s*#\s*(\d+)/i);
      if(!m)return;
      if(card.querySelector('[data-hal-history-edit]')){card.dataset.halHistoryEdit='1';return;}
      const number=m[1];
      const button=document.createElement('button');
      button.type='button';
      button.className='btn alt';
      button.dataset.halHistoryEdit='1';
      button.textContent='✏️ Editar';
      button.style.cssText='width:auto;margin:8px 0 0';
      button.addEventListener('click',async()=>{
        if(typeof window.editSaleByNumber==='function'){
          await window.editSaleByNumber(number);
        }else{
          toast('El módulo de edición todavía está cargando. Vuelve a intentarlo.',true);
        }
      });
      card.appendChild(button);
      card.dataset.halHistoryEdit='1';
    });
  }
  const start=()=>{
    addButtons();
    const app=document.getElementById('app');
    if(app&&!window.__halHistoryEditObserver){
      window.__halHistoryEditObserver=new MutationObserver(addButtons);
      window.__halHistoryEditObserver.observe(app,{childList:true,subtree:true});
    }
    if(!window.__halHistoryEditInterval)window.__halHistoryEditInterval=setInterval(addButtons,1000);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,300));else setTimeout(start,300);
})();
