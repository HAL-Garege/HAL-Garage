// HAL Garage Club: simplifica administración y permite asignar premios/productos a categorías.
(() => {
  const path = location.pathname;
  const isAdmin = /\/club-hal-garage\/admin\.html$/.test(path);
  const isModules = /\/club-hal-garage\/admin-modulos\.html$/.test(path);

  function removeCategoryModule() {
    document.querySelectorAll('#modules .card, #tabs .tab').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text.includes('Categorías')) el.remove();
    });
    if (isModules && new URLSearchParams(location.search).get('module') === 'categories') {
      location.replace('./admin-modulos.html?module=rewards');
    }
  }

  function categorySelect(id, label, value='') {
    return `<div><label>${label}</label><select id="${id}"><option value="">Todas las categorías</option><option value="BRONCE" ${value==='BRONCE'?'selected':''}>BRONCE</option><option value="PLATA" ${value==='PLATA'?'selected':''}>PLATA</option><option value="ORO" ${value==='ORO'?'selected':''}>ORO</option><option value="VIP" ${value==='VIP'?'selected':''}>VIP</option></select></div>`;
  }

  function addRewardControls() {
    if (!isModules || new URLSearchParams(location.search).get('module') !== 'rewards') return;
    const title = [...document.querySelectorAll('#content h3')].find(x => x.textContent.includes('Premio del Club'));
    if (title && !document.getElementById('rcat')) {
      const grid = title.closest('.card')?.querySelector('.grid2');
      if (grid) grid.insertAdjacentHTML('beforeend', categorySelect('rcat','Categoría que puede canjearlo'));
    }
    const productTitle = [...document.querySelectorAll('#content h3')].find(x => x.textContent.includes('Producto del catálogo'));
    if (productTitle && !document.getElementById('pcat')) {
      const grid = productTitle.closest('.card')?.querySelector('.grid2');
      if (grid) grid.insertAdjacentHTML('beforeend', categorySelect('pcat','Categoría que puede canjearlo'));
    }
  }

  function patchRewardSave() {
    if (!isModules || new URLSearchParams(location.search).get('module') !== 'rewards') return;
    if (window.__halRewardPatched) return;
    if (typeof window.saveReward !== 'function' || typeof window.saveProduct !== 'function') return;
    window.__halRewardPatched = true;
    window.saveReward = async function() {
      const id=document.getElementById('rid')?.value;
      const p={title:document.getElementById('rtitle')?.value.trim(),description:document.getElementById('rdesc')?.value.trim(),reward_type:document.getElementById('rtype')?.value,stock:document.getElementById('rstock')?.value===''?null:Number(document.getElementById('rstock')?.value),starts_at:document.getElementById('rstart')?.value||null,expires_at:document.getElementById('rexp')?.value||null,active:!!document.getElementById('ractive')?.checked,category:document.getElementById('rcat')?.value||null};
      if(!p.title)return window.msg?.('Ingresa un título.',true);
      const r=id?await window.db.from('club_rewards').update(p).eq('id',id):await window.db.from('club_rewards').insert(p);
      if(r.error)return window.msg?.(r.error.message,true); window.msg?.(id?'Premio actualizado.':'Premio creado.'); window.renderRewards?.();
    };
    window.saveProduct = async function() {
      const id=document.getElementById('pid')?.value;
      const p={name:document.getElementById('pname')?.value.trim(),description:document.getElementById('pdesc')?.value.trim(),points_cost:Math.max(0,Number(document.getElementById('pcost')?.value||0)),stock:document.getElementById('pstock')?.value===''?null:Number(document.getElementById('pstock')?.value),image_path:document.getElementById('pimage')?.value.trim()||null,active:!!document.getElementById('pactive')?.checked,category:document.getElementById('pcat')?.value||null,updated_at:new Date().toISOString()};
      if(!p.name)return window.msg?.('Ingresa un nombre.',true);
      const r=id?await window.db.from('club_catalog_products').update(p).eq('id',id):await window.db.from('club_catalog_products').insert(p);
      if(r.error)return window.msg?.(r.error.message,true); window.msg?.(id?'Producto actualizado.':'Producto creado.'); window.renderRewards?.();
    };
  }

  function patchCards() {
    if (!isModules || new URLSearchParams(location.search).get('module') !== 'rewards') return;
    document.querySelectorAll('#content .item').forEach(item => {
      if (item.dataset.halCategoryDone) return;
      const text=item.textContent||'';
      const idMatch=text.match(/Categoria:\s*([^\n]+)/i);
      if(idMatch) item.dataset.halCategoryDone='1';
    });
  }

  const observer = new MutationObserver(() => {
    removeCategoryModule();
    addRewardControls();
    patchRewardSave();
    patchCards();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  removeCategoryModule();
  addRewardControls();
  patchRewardSave();
})();
