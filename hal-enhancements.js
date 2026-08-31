(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc2 = s => String(s ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));

  function modal(html){
    document.getElementById('halEnhModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="halEnhModal"><div class="modalbox">${html}</div></div>`);
  }
  window.closeHalEnhModal = () => document.getElementById('halEnhModal')?.remove();

  async function viewSaleEvidenceById(saleId){
    try{
      if(!saleId) throw new Error('Venta inválida.');
      const {data:sale,error:se}=await db.from('sales').select('id,sale_number,created_at').eq('id',saleId).single();
      if(se) throw se;
      if(!sale) throw new Error('No se encontró la venta.');
      const {data:rows,error}=await db.from('sale_evidence').select('evidence_type,storage_path,created_at').eq('sale_id',sale.id).order('created_at');
      if(error) throw error;
      const images=[];
      for(const r of (rows||[])){
        const {data:urlData,error:ue}=await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path,600);
        if(!ue && urlData?.signedUrl) images.push({type:r.evidence_type,url:urlData.signedUrl});
      }
      const label=t=>t==='plate'?'Placa':'Comprobante de pago';
      modal(`<div class="row"><b>📸 Evidencias · Venta #${esc2(sale.sale_number)}</b><button class="btn alt" style="width:auto;margin:0" onclick="closeHalEnhModal()">Cerrar</button></div>
        <div class="muted" style="margin:8px 0">Las imágenes son enlaces temporales de seguridad.</div>
        ${images.map(i=>`<div class="card"><b>${label(i.type)}</b><img src="${i.url}" class="photo-preview" style="max-height:360px"><a class="btn alt" style="display:block;text-align:center;text-decoration:none" href="${i.url}" target="_blank" rel="noopener">Abrir foto</a></div>`).join('') || '<div class="card muted">No hay fotos registradas para esta venta.</div>'}`);
    }catch(e){ toast(e.message || 'No se pudieron cargar las fotos.',true); }
  }
  window.viewSaleEvidenceById=viewSaleEvidenceById;
  window.viewSaleEvidenceByNumber=async function(){ return toast('Esta venta se identifica por su ID interno.',true); };

  function bindHistoryButton(card,saleId){
    if(!saleId) return;
    let b=[...card.querySelectorAll('button')].find(x=>/ver fotos/i.test(x.textContent||''));
    if(!b){
      b=document.createElement('button'); b.className='btn alt'; b.textContent='📸 Ver fotos';
      (card.querySelectorAll('button')[card.querySelectorAll('button').length-1]?.parentElement || card).appendChild(b);
    }
    b.removeAttribute('onclick'); b.onclick=()=>viewSaleEvidenceById(saleId); b.dataset.evidenceButton='1'; card.dataset.evidenceSaleId=saleId;
  }
  async function bindHistoryPhotosByClient(clientId){
    try{
      const {data:sales,error}=await db.from('sales').select('id,sale_number,created_at').eq('client_id',clientId).order('created_at',{ascending:false});
      if(error) throw error;
      const cards=[...document.querySelectorAll('#app .card')].filter(card=>/Venta\s*#/i.test(card.textContent||''));
      cards.forEach((card,index)=>bindHistoryButton(card,sales[index]?.id));
    }catch(e){ console.warn('No se pudieron asociar las fotos del historial:',e); }
  }
  function addHistoryPhotoButtons(){
    document.querySelectorAll('#app .card').forEach(card=>{
      if(card.dataset.evidenceSaleId) return;
      const text=card.textContent||''; if(!/Venta\s*#/i.test(text)) return;
      const existing=[...card.querySelectorAll('button')].find(b=>/ver fotos/i.test(b.textContent||''));
      if(existing && existing.dataset.evidenceButton==='1') return;
      if(existing){ existing.dataset.evidenceButton='1'; return; }
      const b=document.createElement('button'); b.className='btn alt'; b.textContent='📸 Ver fotos'; b.disabled=true; b.title='Cargando evidencia...';
      (card.querySelectorAll('button')[card.querySelectorAll('button').length-1]?.parentElement || card).appendChild(b);
    });
  }
  async function editProduct(productId){
    if(!(isAdmin()||role()==='supervisor')) return toast('Solo Administrador o Supervisor puede editar productos.',true);
    try{
      const {data:p,error}=await db.from('products').select('*').eq('id',productId).single(); if(error) throw error;
      const name=prompt('Nombre del producto',p.name); if(name===null)return; const unit=prompt('Unidad',p.unit_name||'unidad'); if(unit===null)return;
      const minimum=Number(prompt('Stock mínimo',String(p.minimum_stock??0))); if(!(minimum>=0))return toast('Stock mínimo inválido.',true);
      const {error:ue}=await db.from('products').update({name:name.trim(),unit_name:unit.trim()||'unidad',minimum_stock:minimum,updated_at:new Date().toISOString()}).eq('id',productId); if(ue) throw ue;
      const current=Number(p.stock||0); const change=prompt(`Stock actual: ${current}. Si necesitas cambiarlo, escribe la NUEVA cantidad. Deja vacío para conservar ${current}.`,'');
      if(change!==null && change.trim()!==''){
        const next=Number(change); if(!(next>=0)) throw new Error('Stock inválido.');
        if(next!==current){
          const qty=Math.abs(next-current); const {error:me}=await db.from('inventory_movements').insert({product_id:productId,movement_type:'adjustment',quantity:qty,reason:`Edición de inventario: ${current} → ${next}`,...createdBy()}); if(me) throw me;
          const {error:se}=await db.from('products').update({stock:next,updated_at:new Date().toISOString()}).eq('id',productId); if(se) throw se;
        }
      }
      toast('Producto actualizado correctamente'); await inventoryPage();
    }catch(e){toast(e.message || 'No se pudo editar el producto.',true)}
  }
  window.editProduct=editProduct;
  function addInventoryEditButtons(){
    document.querySelectorAll('#app button[onclick^="inventoryMove("]').forEach(move=>{
      if(move.dataset.editAdded==='1') return; const match=(move.getAttribute('onclick')||'').match(/inventoryMove\('([^']+)'\)/); if(!match) return;
      const edit=document.createElement('button'); edit.className='smallbtn'; edit.textContent='Editar'; edit.style.marginLeft='5px'; edit.dataset.editAdded='1'; edit.onclick=()=>editProduct(match[1]);
      move.parentElement.appendChild(edit); move.dataset.editAdded='1';
    });
  }
  function enhanceRegisterLabels(){
    document.querySelectorAll('#app button').forEach(b=>{
      if(b.textContent.includes('Nuevo cliente')) b.textContent=b.textContent.replace('Nuevo cliente','Registrar cliente');
      if(b.textContent.includes('CONFIRMAR VENTA')) b.textContent=b.textContent.replace('CONFIRMAR VENTA','REGISTRAR VENTA');
      if(b.textContent.includes('Ingresar producto al inventario')) b.textContent=b.textContent.replace('Ingresar producto al inventario','Registrar producto');
    });
  }
  const originalHistory=window.clientHistory;
  if(typeof originalHistory==='function'){ window.clientHistory=async function(clientId){ await originalHistory(clientId); await sleep(80); await bindHistoryPhotosByClient(clientId); }; }
  const originalInventory=window.inventoryPage;
  if(typeof originalInventory==='function'){ window.inventoryPage=async function(){ await originalInventory(); await sleep(40); addInventoryEditButtons(); }; }
  const observer=new MutationObserver(()=>{ addHistoryPhotoButtons(); addInventoryEditButtons(); enhanceRegisterLabels(); });
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(()=>{ addHistoryPhotoButtons(); addInventoryEditButtons(); enhanceRegisterLabels(); },250);

  // ===== Personal + Jornada + Excel =====
  const HAL_WORK_EVENTS=[{type:'open',label:'Entrada',icon:'🟢'},{type:'lunch',label:'Inicio de almuerzo',icon:'🍽️'},{type:'return',label:'Retorno',icon:'🔵'},{type:'close',label:'Salida',icon:'🔴'}];
  function workEventLabel(t){return HAL_WORK_EVENTS.find(x=>x.type===t)?.label||t;}
  function localDateInputValue(d=new Date()){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10);}
  function fmtTime(v){if(!v)return '—';return new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v));}
  function hoursBetween(a,b){if(!a||!b)return 0;return Math.max(0,(new Date(b)-new Date(a))/3600000);}
  function calcWorkedHours(events){const e=Object.fromEntries((events||[]).map(x=>[x.event_type,x.occurred_at]));let h=hoursBetween(e.open,e.close);if(e.lunch&&e.return)h-=hoursBetween(e.lunch,e.return);return Math.max(0,h);}
  function fmtHours(h){const total=Math.max(0,Math.round(Number(h||0)*60));return `${Math.floor(total/60)} h ${String(total%60).padStart(2,'0')} min`;}
  async function getProfiles(){return await q('profiles',db.from('profiles').select('id,full_name,role,active').order('full_name'));}
  async function uploadWorkPhoto(workdayId,eventType,file){
    if(!file)throw new Error(`Selecciona la foto de ${workEventLabel(eventType)}.`);if(!String(file.type||'').startsWith('image/'))throw new Error('La evidencia debe ser una imagen.');
    const ext=(file.name?.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg',path=`workdays/${workdayId}/${eventType}-${Date.now()}.${ext}`;
    const {error}=await db.storage.from(EVIDENCE_BUCKET).upload(path,file,{upsert:false,contentType:file.type||'image/jpeg'});if(error)throw error;return path;
  }
  async function listWorkdayEvents(workdayId){return await q('workday_events',db.from('workday_events').select('id,event_type,occurred_at,photo_path,reason,notes').eq('workday_id',workdayId).order('occurred_at'));}
  async function signWorkPhoto(path){if(!path)return null;const {data,error}=await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(path,900);if(error)return null;return data?.signedUrl||null;}
  async function renderWorkdayDetail(workdayId){
    const events=await listWorkdayEvents(workdayId),cards=[];
    for(const ev of HAL_WORK_EVENTS){const row=events.find(x=>x.event_type===ev.type),url=row?await signWorkPhoto(row.photo_path):null;
      cards.push(`<div class="card" style="margin-top:8px"><div class="row"><b>${ev.icon} ${ev.label}</b><span class="badge ${row?'ok':'warn'}">${row?'Registrado':'Pendiente'}</span></div>${row?`<div class="muted" style="margin:6px 0">${fmtTime(row.occurred_at)}</div>${url?`<img src="${url}" class="photo-preview" style="max-height:260px"><a class="btn alt" style="display:block;text-align:center;text-decoration:none" href="${url}" target="_blank" rel="noopener">Abrir foto</a>`:'<div class="danger small">No se pudo generar la vista temporal de la foto.</div>'}`:'<div class="muted" style="margin-top:7px">Aún no registrada.</div>'}</div>`);
    }
    return {events,html:`<div class="grid"><div class="card"><div class="muted">Horas trabajadas</div><div class="metric green">${fmtHours(calcWorkedHours(events))}</div></div><div class="card"><div class="muted">Evidencias</div><div class="metric">${events.length}/4</div></div></div>${cards.join('')}`};
  }
  async function jornadaPage(){
    if(!canOperate())return toast('No tienes permiso para gestionar jornadas.',true);
    try{
      const profiles=await getProfiles(),defaultId=HAL_USER?.id||profiles.find(p=>p.active)?.id||'';
      setHTML(`<div class="title">Jornada y personal</div><div class="date">Registro de entrada, almuerzo, retorno y salida con evidencia fotográfica.</div>
        <div class="card"><b>👤 Personal</b><label>Trabajador</label><select id="workPerson">${profiles.filter(p=>p.active).map(p=>`<option value="${p.id}" ${p.id===defaultId?'selected':''}>${esc(p.full_name)} · ${roleLabel(p.role==='operator'?'operator':p.role)}</option>`).join('')}</select>
        <label>Fecha de jornada</label><input id="workDate" type="date" value="${localDateInputValue()}"><label>Nota</label><input id="workNote" placeholder="Opcional"><button class="btn" onclick="loadSelectedWorkday()">🔎 Buscar jornada</button></div>
        <div id="workdayArea"><div class="card muted">Selecciona el personal y la fecha para continuar.</div></div>
        <div class="card"><b>📊 Reporte de horas</b><div class="muted" style="margin:6px 0 10px">Descarga las horas trabajadas en un archivo compatible con Excel.</div>
        <div class="grid"><div><label>Desde</label><input id="reportFrom" type="date" value="${localDateInputValue()}"></div><div><label>Hasta</label><input id="reportTo" type="date" value="${localDateInputValue()}"></div></div>
        <label>Personal</label><select id="reportPerson"><option value="">Todo el personal</option>${profiles.map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select><button class="btn green" onclick="downloadWorkHoursExcel()">⬇️ DESCARGAR EXCEL DE HORAS</button></div>
        <div class="card"><button class="btn alt" onclick="personalPage()">👥 Ver / registrar personal</button></div>`);await loadSelectedWorkday();
    }catch(e){setHTML(`<div class="title">Jornada</div><div class="card danger">${esc(e.message)}</div>`)}
  }
  async function loadSelectedWorkday(){
    const area=document.getElementById('workdayArea');if(!area)return;const operatorId=document.getElementById('workPerson')?.value,date=document.getElementById('workDate')?.value;
    if(!operatorId||!date){area.innerHTML='<div class="card danger">Selecciona personal y fecha.</div>';return;}area.innerHTML='<div class="card muted">Cargando jornada…</div>';
    try{
      const {data,error}=await db.from('workdays').select('id,operator_id,work_date,status,notes,created_at,closed_at').eq('operator_id',operatorId).eq('work_date',date).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;
      if(!data){area.innerHTML=`<div class="card"><b>Jornada no iniciada</b><div class="muted" style="margin:6px 0 10px">Para iniciar la jornada registra la foto obligatoria de entrada.</div><label>Foto de entrada</label><input id="newOpenPhoto" type="file" accept="image/*" capture="environment"><button class="btn green" onclick="startWorkday()">▶️ INICIAR JORNADA</button></div>`;return;}
      const detail=await renderWorkdayDetail(data.id),events=detail.events,profiles=await getProfiles(),next=HAL_WORK_EVENTS.find(x=>!events.some(e=>e.event_type===x.type));
      area.innerHTML=`<div class="card"><div class="row"><b>Jornada ${esc(date)}</b><span class="badge ${data.status==='closed'?'ok':'warn'}">${data.status==='closed'?'Cerrada':'Abierta'}</span></div><div class="muted" style="margin-top:6px">Personal: ${esc(profiles.find(p=>p.id===operatorId)?.full_name||'—')}</div>${detail.html}</div>
      ${data.status==='open'&&next?`<div class="card"><b>${next.icon} Registrar ${next.label.toLowerCase()}</b><label>Foto obligatoria</label><input id="nextWorkPhoto" type="file" accept="image/*" capture="environment"><button class="btn ${next.type==='close'?'green':''}" onclick="registerNextWorkEvent('${data.id}','${next.type}')">${next.type==='close'?'🔴 REGISTRAR SALIDA':'📸 REGISTRAR '+next.label.toUpperCase()}</button></div>`:''}`;
    }catch(e){area.innerHTML=`<div class="card danger">${esc(e.message)}</div>`}
  }
  async function startWorkday(){
    try{
      const operatorId=document.getElementById('workPerson')?.value,date=document.getElementById('workDate')?.value,file=document.getElementById('newOpenPhoto')?.files?.[0];if(!operatorId||!date)throw new Error('Selecciona personal y fecha.');if(!file)throw new Error('La foto de entrada es obligatoria.');
      const {data:existing,error:ee}=await db.from('workdays').select('id,status').eq('operator_id',operatorId).eq('work_date',date).maybeSingle();if(ee)throw ee;if(existing)throw new Error('Ya existe una jornada para ese personal y fecha.');
      const {data:wd,error}=await db.from('workdays').insert({operator_id:operatorId,work_date:date,status:'open',notes:document.getElementById('workNote')?.value||null}).select().single();if(error)throw error;
      try{const path=await uploadWorkPhoto(wd.id,'open',file);const {error:evErr}=await db.from('workday_events').insert({workday_id:wd.id,event_type:'open',occurred_at:new Date().toISOString(),photo_path:path,notes:document.getElementById('workNote')?.value||null,...createdBy()});if(evErr)throw evErr;}catch(e){await db.from('workdays').delete().eq('id',wd.id);throw e;}
      toast('Jornada iniciada correctamente');await loadSelectedWorkday();
    }catch(e){toast(e.message||'No se pudo iniciar la jornada.',true)}
  }
  async function registerNextWorkEvent(workdayId,eventType){
    try{
      const file=document.getElementById('nextWorkPhoto')?.files?.[0];if(!file)throw new Error(`La foto de ${workEventLabel(eventType)} es obligatoria.`);const events=await listWorkdayEvents(workdayId),expected=HAL_WORK_EVENTS.find(x=>!events.some(e=>e.event_type===x.type));if(!expected||expected.type!==eventType)throw new Error(`El siguiente evento debe ser: ${workEventLabel(expected?.type||'open')}.`);
      const path=await uploadWorkPhoto(workdayId,eventType,file),{error}=await db.from('workday_events').insert({workday_id:workdayId,event_type:eventType,occurred_at:new Date().toISOString(),photo_path:path,...createdBy()});if(error)throw error;
      if(eventType==='close'){const {error:ce}=await db.from('workdays').update({status:'closed',closed_at:new Date().toISOString()}).eq('id',workdayId);if(ce)throw ce;}
      toast(`${workEventLabel(eventType)} registrada`);await loadSelectedWorkday();
    }catch(e){toast(e.message||'No se pudo registrar el evento.',true)}
  }
  async function personalPage(){
    if(!isAdmin())return toast('Solo el Administrador puede registrar personal.',true);
    try{
      const profiles=await getProfiles();setHTML(`<div class="title">Personal</div><div class="date">Personal autorizado para registrar jornadas.</div>
        <div class="card"><b>➕ Registrar personal</b><label>Nombre completo</label><input id="staffName" placeholder="Nombre del trabajador"><label>Perfil</label><select id="staffRole"><option value="operator">Operario</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option></select><button class="btn green" onclick="createStaff()">REGISTRAR PERSONAL</button></div>
        <div class="card"><b>Personal registrado</b>${profiles.map(p=>`<div class="result"><div class="row"><b>${esc(p.full_name)}</b><span class="badge ${p.active?'ok':'bad'}">${p.active?'Activo':'Inactivo'}</span></div><div class="muted" style="margin-top:4px">${roleLabel(p.role==='operator'?'operator':p.role)}</div></div>`).join('')||'<div class="muted">No hay personal.</div>'}</div><button class="btn alt" onclick="jornadaPage()">← Volver a Jornada</button>`);
    }catch(e){toast(e.message||'No se pudo cargar el personal.',true)}
  }
  async function createStaff(){
    try{
      const name=document.getElementById('staffName')?.value?.trim(),r=document.getElementById('staffRole')?.value;if(!name)throw new Error('Escribe el nombre completo.');if(!['operator','supervisor','admin'].includes(r))throw new Error('Perfil inválido.');
      const {data:existing}=await db.from('profiles').select('id').ilike('full_name',name).limit(1);if(existing?.length)throw new Error('Ese personal ya está registrado.');
      const {error}=await db.from('profiles').insert({id:crypto.randomUUID(),full_name:name,role:r,active:true});if(error)throw error;toast('Personal registrado');await personalPage();
    }catch(e){toast(e.message||'No se pudo registrar el personal.',true)}
  }
  function excelCell(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  async function downloadWorkHoursExcel(){
    try{
      const from=document.getElementById('reportFrom')?.value,to=document.getElementById('reportTo')?.value,person=document.getElementById('reportPerson')?.value||'';if(!from||!to||from>to)throw new Error('Rango de fechas inválido.');
      let query=db.from('workdays').select('id,operator_id,work_date,status,notes,closed_at').gte('work_date',from).lte('work_date',to).order('work_date',{ascending:true});if(person)query=query.eq('operator_id',person);
      const workdays=await q('workdays',query),profiles=await getProfiles(),names=Object.fromEntries(profiles.map(p=>[p.id,p.full_name])),rows=[];
      for(const wd of workdays){const events=await listWorkdayEvents(wd.id),e=Object.fromEntries(events.map(x=>[x.event_type,x.occurred_at]));rows.push({date:wd.work_date,name:names[wd.operator_id]||'—',open:fmtTime(e.open),lunch:fmtTime(e.lunch),ret:fmtTime(e.return),close:fmtTime(e.close),hours:fmtHours(calcWorkedHours(events)),status:wd.status==='closed'?'Cerrada':'Abierta'});}
      const body=rows.map(r=>`<tr><td>${excelCell(r.date)}</td><td>${excelCell(r.name)}</td><td>${excelCell(r.open)}</td><td>${excelCell(r.lunch)}</td><td>${excelCell(r.ret)}</td><td>${excelCell(r.close)}</td><td>${excelCell(r.hours)}</td><td>${excelCell(r.status)}</td></tr>`).join('');
      const html=`<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Fecha</th><th>Personal</th><th>Entrada</th><th>Inicio almuerzo</th><th>Retorno</th><th>Salida</th><th>Horas trabajadas</th><th>Estado</th></tr>${body||'<tr><td colspan="8">Sin jornadas en el rango.</td></tr>'}</table></body></html>`;
      const blob=new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HAL_Garage_Horas_${from}_${to}.xls`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast(`Excel generado: ${rows.length} jornada(s)`);
    }catch(e){toast(e.message||'No se pudo generar el Excel.',true)}
  }
  window.jornadaPage=jornadaPage;window.loadSelectedWorkday=loadSelectedWorkday;window.startWorkday=startWorkday;window.registerNextWorkEvent=registerNextWorkEvent;window.personalPage=personalPage;window.createStaff=createStaff;window.downloadWorkHoursExcel=downloadWorkHoursExcel;
  function addJornadaButtons(){
    const text=document.getElementById('app')?.textContent||'';if(!/Más|Inventario|Reportes/i.test(text))return;if(document.querySelector('#app button[data-hal-jornada]'))return;
    const buttons=[...document.querySelectorAll('#app button')],anchor=buttons.find(b=>/jornada|reportes/i.test(b.textContent||'')),b=document.createElement('button');b.className='btn alt';b.textContent='🕘 Jornada y personal';b.dataset.halJornada='1';b.onclick=jornadaPage;(anchor?.parentElement||document.getElementById('app')).appendChild(b);
  }
  const observer2=new MutationObserver(()=>addJornadaButtons());observer2.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});setTimeout(addJornadaButtons,300);
})();
