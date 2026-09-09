// HAL Garage Club: ajustes aislados para administración de premios, canjes y puntos.
// No toca tablas de gestión ni la relación de historial; usa únicamente tablas club_*.
(() => {
  const isModules=/\/club-hal-garage\/admin-modulos\.html$/.test(location.pathname);
  if(!isModules)return;
  const sb=window.supabase;
  if(!sb?.createClient)return;
  const db=sb.createClient('https://maqnglazkhwtzskfddgc.supabase.co','sb_publishable_gIB6HrGHT3X7CwIjAHGO8Q_7hYro-I_',{auth:{autoRefreshToken:true,persistSession:false,detectSessionInUrl:false}});
  const moduleName=new URLSearchParams(location.search).get('module');
  const cats=['','BRONCE','PLATA','ORO','VIP'];
  const catLabel=c=>c||'Todos';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  let patched=false;

  function audienceControl(id){
    return `<div><label>¿Para quién es este premio?</label><select id="${id}">${cats.map(c=>`<option value="${c}">${catLabel(c)}</option>`).join('')}</select></div>`;
  }

  function patchRewardForm(){
    if(moduleName!=='rewards')return;
    const title=[...document.querySelectorAll('#content h3')].find(x=>x.textContent.includes('Premio del Club'));
    const card=title?.closest('.card');
    const old=document.getElementById('rcat');
    if(card && old){
      const wrap=old.closest('div');
      if(wrap)wrap.outerHTML=audienceControl('rcat');
    }
    if(card && !document.getElementById('rcat')){
      const grid=card.querySelector('.grid2');
      if(grid)grid.insertAdjacentHTML('beforeend',audienceControl('rcat'));
    }
    const pt=[...document.querySelectorAll('#content h3')].find(x=>x.textContent.includes('Producto del catálogo'));
    const pcard=pt?.closest('.card');
    const oldp=document.getElementById('pcat');
    if(pcard && oldp){
      const wrap=oldp.closest('div'); if(wrap)wrap.outerHTML=audienceControl('pcat');
    }
    if(pcard && !document.getElementById('pcat')){
      const grid=pcard.querySelector('.grid2');
      if(grid)grid.insertAdjacentHTML('beforeend',audienceControl('pcat'));
    }
    if(!patched && typeof window.saveReward==='function' && typeof window.saveProduct==='function'){
      const oldSR=window.saveReward, oldSP=window.saveProduct;
      window.saveReward=async()=>{
        const id=document.getElementById('rid')?.value;
        const p={title:document.getElementById('rtitle')?.value.trim(),description:document.getElementById('rdesc')?.value.trim(),reward_type:document.getElementById('rtype')?.value,stock:document.getElementById('rstock')?.value===''?null:Number(document.getElementById('rstock')?.value),starts_at:document.getElementById('rstart')?.value||null,expires_at:document.getElementById('rexp')?.value||null,active:!!document.getElementById('ractive')?.checked,category:document.getElementById('rcat')?.value||null};
        if(!p.title)return window.msg?.('Ingresa un título.',true);
        const r=id?await db.from('club_rewards').update(p).eq('id',id):await db.from('club_rewards').insert(p);
        if(r.error)return window.msg?.(r.error.message,true); window.msg?.(id?'Premio actualizado.':'Premio creado.'); setTimeout(()=>location.reload(),250);
      };
      window.saveProduct=async()=>{
        const id=document.getElementById('pid')?.value;
        const p={name:document.getElementById('pname')?.value.trim(),description:document.getElementById('pdesc')?.value.trim(),points_cost:Math.max(0,Number(document.getElementById('pcost')?.value||0)),stock:document.getElementById('pstock')?.value===''?null:Number(document.getElementById('pstock')?.value),image_path:document.getElementById('pimage')?.value.trim()||null,active:!!document.getElementById('pactive')?.checked,category:document.getElementById('pcat')?.value||null,updated_at:new Date().toISOString()};
        if(!p.name)return window.msg?.('Ingresa un nombre.',true);
        const r=id?await db.from('club_catalog_products').update(p).eq('id',id):await db.from('club_catalog_products').insert(p);
        if(r.error)return window.msg?.(r.error.message,true); window.msg?.(id?'Producto actualizado.':'Producto creado.'); setTimeout(()=>location.reload(),250);
      };
      patched=true;
    }
  }

  async function patchPoints(){
    if(moduleName!=='points')return;
    const members=(await db.from('club_members').select('id,category,points_balance,customer_id,club_customers(full_name,phone)').order('created_at',{ascending:false})).data||[];
    document.querySelectorAll('select').forEach(sel=>{
      if(sel.id==='pmember' || sel.id.includes('member')){
        [...sel.options].forEach(o=>{const m=members.find(x=>x.id===o.value);if(m)o.textContent=`${m.club_customers?.full_name||'Cliente'} · ${m.points_balance} pts · ${m.category}`;});
      }
    });
    document.querySelectorAll('#content .item').forEach(item=>{
      if(item.dataset.clubNameDone)return;
      const text=item.textContent||'';
      const m=members.find(x=>text.includes(x.id));
      if(m){item.innerHTML=item.innerHTML.replaceAll(m.id,esc(m.club_customers?.full_name||'Cliente'));item.dataset.clubNameDone='1';}
    });
  }

  async function patchRedemptions(){
    if(moduleName!=='redemptions')return;
    const members=(await db.from('club_members').select('id,category,points_balance,customer_id,club_customers(full_name,phone)')).data||[];
    document.querySelectorAll('#content .item').forEach(item=>{
      if(item.dataset.clubRedemptionDone)return;
      const html=item.innerHTML;
      let changed=false;
      members.forEach(m=>{const name=m.club_customers?.full_name||'Cliente';if(html.includes(m.id)){item.innerHTML=item.innerHTML.replaceAll(m.id,esc(name));changed=true;}});
      if(changed)item.dataset.clubRedemptionDone='1';
    });
  }

  function patch(){patchRewardForm();patchPoints();patchRedemptions();}
  const obs=new MutationObserver(()=>setTimeout(patch,80));obs.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(patch,150);setTimeout(patch,700);
})();
