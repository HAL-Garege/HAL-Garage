(() => {
  const EVENTS = [
    {type:'open', label:'Ingreso', icon:'🟢'},
    {type:'lunch', label:'Salida de almuerzo', icon:'🍽️'},
    {type:'return', label:'Regreso', icon:'🔵'},
    {type:'close', label:'Salida de jornada', icon:'🔴'}
  ];
  const escJ = s => String(s ?? '').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const dateToday = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
  const fmt = v => v ? new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v)) : '—';
  const hours = (events) => { const e=Object.fromEntries((events||[]).map(x=>[x.event_type,x.occurred_at])); let h=e.open&&e.close?(new Date(e.close)-new Date(e.open))/3600000:0; if(e.lunch&&e.return) h-=(new Date(e.return)-new Date(e.lunch))/3600000; return Math.max(0,h); };
  const htext = h => { const m=Math.max(0,Math.round(h*60)); return `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} min`; };
  const label = t => EVENTS.find(e=>e.type===t)?.label || t;
  const toastJ = (m,e=false) => window.toast ? toast(m,e) : alert(m);
  async function qJ(query){ const {data,error}=await query; if(error) throw error; return data||[]; }
  async function eventsJ(id){ return qJ(db.from('workday_events').select('id,event_type,occurred_at,photo_path,reason,notes').eq('workday_id',id).order('occurred_at')); }
  async function signed(path){ if(!path)return null; const {data,error}=await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(path,900); return error?null:data?.signedUrl||null; }
  async function photosModal(workdayId,date,name){
    try{
      const ev=await eventsJ(workdayId); const items=[];
      for(const x of EVENTS){ const r=ev.find(e=>e.event_type===x.type); if(r) items.push({label:x.label,time:fmt(r.occurred_at),url:await signed(r.photo_path)}); }
      const body=items.map(i=>`<div class="card"><b>${i.label}</b><div class="muted">${i.time}</div>${i.url?`<img src="${i.url}" class="photo-preview" style="max-height:300px"><a class="btn alt" href="${i.url}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">Abrir foto</a>`:'<div class="danger small">Foto no disponible.</div>'}</div>`).join('');
      document.getElementById('halEnhModal')?.remove();
      document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="halEnhModal"><div class="modalbox"><div class="row"><b>📸 Fotos de jornada</b><button class="btn alt" style="width:auto;margin:0" onclick="document.getElementById('halEnhModal')?.remove()">Cerrar</button></div><div class="muted" style="margin:6px 0 12px">${escJ(name)} · ${escJ(date)}</div>${body||'<div class="card muted">No hay fotos registradas.</div>'}</div></div>`);
    }catch(e){toastJ(e.message||'No se pudieron cargar las fotos.',true)}
  }
  async function editJornada(id){
    if(!['admin','supervisor'].includes(HAL_USER?.role)) return toastJ('Solo Supervisor o Administrador puede editar jornadas.',true);
    try{
      const wd=await qJ(db.from('workdays').select('id,operator_id,work_date,status,notes').eq('id',id).single());
      const ev=await eventsJ(id);
      const opts=EVENTS.map(x=>{const r=ev.find(e=>e.event_type===x.type);return `${x.label}: ${r?fmt(r.occurred_at):'sin registro'}`}).join('\n');
      const note=prompt(`Editar jornada ${wd.work_date}.\n\n${opts}\n\nEscribe una observación de la corrección (obligatorio):`,wd.notes||'');
      if(note===null)return; if(!note.trim())return toastJ('La observación de corrección es obligatoria.',true);
      const target=prompt('¿Qué quieres corregir? Escribe: ingreso, almuerzo, regreso o salida', '');
      if(target===null)return;
      const map={ingreso:'open',almuerzo:'lunch',regreso:'return',salida:'close'}; const type=map[target.trim().toLowerCase()]; if(!type)return toastJ('Evento no válido.',true);
      const old=ev.find(e=>e.event_type===type); if(!old)return toastJ('Ese evento todavía no está registrado.',true);
      const val=prompt(`Nueva hora para ${label(type)} (HH:MM)`,fmt(old.occurred_at).slice(0,5)); if(val===null)return;
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(val))return toastJ('Hora inválida. Usa HH:MM.',true);
      const stamp=new Date(`${wd.work_date}T${val}:00`).toISOString();
      const {error}=await db.from('workday_events').update({occurred_at:stamp,notes:`Corrección: ${note.trim()}`}).eq('id',old.id); if(error)throw error;
      await db.from('workdays').update({notes:note.trim()}).eq('id',id);
      await db.from('audit_log').insert({actor_id:HAL_USER?.id||null,action:'correct_workday_event',entity_type:'workday_events',entity_id:old.id,old_data:{occurred_at:old.occurred_at},new_data:{occurred_at:stamp,reason:note.trim()}});
      toastJ('Jornada corregida.'); await jornadaPageJ();
    }catch(e){toastJ(e.message||'No se pudo editar la jornada.',true)}
  }
  async function deleteJornada(id){
    if(HAL_USER?.role!=='admin')return toastJ('Solo el Administrador puede borrar jornadas.',true);
    try{
      const yes=confirm('¿Borrar esta jornada y sus 4 registros fotográficos? Esta acción no se puede deshacer.'); if(!yes)return;
      const ev=await eventsJ(id);
      const {error}=await db.from('workdays').delete().eq('id',id); if(error)throw error;
      toastJ('Jornada borrada.'); await jornadaPageJ();
    }catch(e){toastJ(e.message||'No se pudo borrar la jornada.',true)}
  }
  async function startJornada(){
    try{
      const file=document.getElementById('hjOpen')?.files?.[0]; if(!file)throw new Error('La foto de ingreso es obligatoria.');
      if(!HAL_USER?.id)throw new Error('No se pudo identificar al usuario.'); const date=dateToday();
      const exists=await qJ(db.from('workdays').select('id').eq('operator_id',HAL_USER.id).eq('work_date',date).maybeSingle()); if(exists)throw new Error('Ya existe una jornada para hoy.');
      const {data:wd,error}=await db.from('workdays').insert({operator_id:HAL_USER.id,work_date:date,status:'open'}).select().single(); if(error)throw error;
      const ext=(file.name?.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'')||'jpg',path=`workdays/${wd.id}/open-${Date.now()}.${ext}`;
      const up=await db.storage.from(EVIDENCE_BUCKET).upload(path,file,{upsert:false,contentType:file.type||'image/jpeg'}); if(up.error){await db.from('workdays').delete().eq('id',wd.id);throw up.error;}
      const ins=await db.from('workday_events').insert({workday_id:wd.id,event_type:'open',occurred_at:new Date().toISOString(),photo_path:path,...createdBy()}); if(ins.error){await db.from('workdays').delete().eq('id',wd.id);throw ins.error;}
      toastJ('Ingreso registrado.'); await jornadaPageJ();
    }catch(e){toastJ(e.message||'No se pudo registrar el ingreso.',true)}
  }
  async function nextJornada(id,type){
    try{
      const file=document.getElementById('hjNext')?.files?.[0]; if(!file)throw new Error(`La foto de ${label(type)} es obligatoria.`);
      const ev=await eventsJ(id); const expected=EVENTS.find(x=>!ev.some(e=>e.event_type===x.type)); if(!expected||expected.type!==type)throw new Error(`El siguiente registro es ${label(expected?.type||'open')}.`);
      const ext=(file.name?.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'')||'jpg',path=`workdays/${id}/${type}-${Date.now()}.${ext}`;
      const up=await db.storage.from(EVIDENCE_BUCKET).upload(path,file,{upsert:false,contentType:file.type||'image/jpeg'}); if(up.error)throw up.error;
      const ins=await db.from('workday_events').insert({workday_id:id,event_type:type,occurred_at:new Date().toISOString(),photo_path:path,...createdBy()}); if(ins.error)throw ins.error;
      if(type==='close'){const ce=await db.from('workdays').update({status:'closed',closed_at:new Date().toISOString()}).eq('id',id);if(ce.error)throw ce.error;}
      toastJ(`${label(type)} registrada.`); await jornadaPageJ();
    }catch(e){toastJ(e.message||'No se pudo registrar.',true)}
  }
  async function jornadaPageJ(){
    if(!HAL_USER)return;
    try{
      const isOp=HAL_USER.role==='operator';
      let profiles=[]; if(!isOp)profiles=await qJ(db.from('profiles').select('id,full_name').eq('active',true).order('full_name'));
      const date=dateToday();
      let query=db.from('workdays').select('id,operator_id,work_date,status,notes,created_at,closed_at').order('work_date',{ascending:false}).order('created_at',{ascending:false});
      if(isOp)query=query.eq('operator_id',HAL_USER.id); const workdays=await qJ(query.limit(60));
      const names=Object.fromEntries(profiles.map(p=>[p.id,p.full_name])); names[HAL_USER.id]=HAL_USER.name;
      const today=workdays.find(w=>w.work_date===date);
      let current='';
      if(!today && isOp){current=`<div class="card"><b>Jornada de hoy</b><div class="muted" style="margin:6px 0 10px">Registro fotográfico obligatorio.</div><label>Foto de ingreso</label><input id="hjOpen" type="file" accept="image/*" capture="environment"><button class="btn green" onclick="startJornadaJ()">🟢 MARCAR INGRESO</button></div>`;}
      else if(today){
        const ev=await eventsJ(today.id),next=EVENTS.find(x=>!ev.some(e=>e.event_type===x.type));
        current=`<div class="card"><div class="row"><b>Jornada · ${date}</b><span class="badge ${today.status==='closed'?'ok':'warn'}">${today.status==='closed'?'Cerrada':'Abierta'}</span></div><div class="muted" style="margin:6px 0">${escJ(names[today.operator_id]||'Personal')}</div><div class="grid"><div class="card"><div class="muted">Ingreso</div><b>${fmt(ev.find(x=>x.event_type==='open')?.occurred_at)}</b></div><div class="card"><div class="muted">Almuerzo</div><b>${fmt(ev.find(x=>x.event_type==='lunch')?.occurred_at)}</b></div><div class="card"><div class="muted">Regreso</div><b>${fmt(ev.find(x=>x.event_type==='return')?.occurred_at)}</b></div><div class="card"><div class="muted">Salida</div><b>${fmt(ev.find(x=>x.event_type==='close')?.occurred_at)}</b></div></div><div class="card"><div class="muted">Horas trabajadas</div><div class="metric green">${htext(hours(ev))}</div></div>
        ${today.status==='open'&&next?`<label>Foto de ${next.label.toLowerCase()}</label><input id="hjNext" type="file" accept="image/*" capture="environment"><button class="btn ${next.type==='close'?'green':''}" onclick="nextJornadaJ('${today.id}','${next.type}')">${next.type==='close'?'🔴 MARCAR SALIDA DE JORNADA':'📸 MARCAR '+next.label.toUpperCase()}</button>`:''}
        <button class="btn alt" onclick="photosJ('${today.id}','${date}','${escJ(names[today.operator_id]||'Personal')}')">📸 VER FOTOS</button>${HAL_USER.role==='admin'||HAL_USER.role==='supervisor'?`<button class="btn alt" onclick="editJornadaJ('${today.id}')">✏️ EDITAR</button>`:''}${HAL_USER.role==='admin'?`<button class="btn red" onclick="deleteJornadaJ('${today.id}')">🗑️ BORRAR</button>`:''}</div>`;
      }
      const history=[]; for(const wd of workdays){const ev=await eventsJ(wd.id),name=names[wd.operator_id]||'Personal'; history.push(`<div class="result"><div class="row"><b>${escJ(wd.work_date)}</b><span class="badge ${wd.status==='closed'?'ok':'warn'}">${wd.status==='closed'?'Cerrada':'Abierta'}</span></div><div class="muted" style="margin-top:5px">${escJ(name)}</div><table class="table"><tr><th>Ingreso</th><th>Almuerzo</th><th>Regreso</th><th>Salida</th></tr><tr><td>${fmt(ev.find(x=>x.event_type==='open')?.occurred_at)}</td><td>${fmt(ev.find(x=>x.event_type==='lunch')?.occurred_at)}</td><td>${fmt(ev.find(x=>x.event_type==='return')?.occurred_at)}</td><td>${fmt(ev.find(x=>x.event_type==='close')?.occurred_at)}</td></tr></table><div class="row" style="margin-top:7px"><span class="muted">${htext(hours(ev))}</span><button class="smallbtn" onclick="photosJ('${wd.id}','${escJ(wd.work_date)}','${escJ(name)}')">📸 Ver fotos</button></div>${HAL_USER.role==='admin'||HAL_USER.role==='supervisor'?`<button class="btn alt" onclick="editJornadaJ('${wd.id}')">✏️ Editar</button>`:''}${HAL_USER.role==='admin'?`<button class="btn red" onclick="deleteJornadaJ('${wd.id}')">🗑️ Borrar</button>`:''}</div>`)}
      const excel=isOp?'':`<div class="card"><b>📊 Excel de horas</b><label>Desde</label><input id="hjFrom" type="date" value="${date}"><label>Hasta</label><input id="hjTo" type="date" value="${date}"><button class="btn green" onclick="excelJ()">⬇️ DESCARGAR EXCEL</button></div>`;
      setHTML(`<div class="title">Jornada y almuerzo</div><div class="date">Ingreso · almuerzo · regreso · salida</div>${current}<div class="card"><b>📅 Historia de jornada</b>${history.join('')||'<div class="muted" style="margin-top:8px">No hay jornadas registradas.</div>'}</div>${excel}`);
    }catch(e){setHTML(`<div class="title">Jornada y almuerzo</div><div class="card danger">${escJ(e.message)}</div>`)}
  }
  async function excelJ(){
    try{
      const from=document.getElementById('hjFrom')?.value,to=document.getElementById('hjTo')?.value;if(!from||!to||from>to)throw new Error('Rango de fechas inválido.');
      const w=await qJ(db.from('workdays').select('id,operator_id,work_date,status').gte('work_date',from).lte('work_date',to).order('work_date'));const p=await qJ(db.from('profiles').select('id,full_name'));const names=Object.fromEntries(p.map(x=>[x.id,x.full_name]));
      const lines=[['Fecha','Personal','Ingreso','Salida de almuerzo','Regreso','Salida de jornada','Horas trabajadas','Estado']];
      for(const x of w){const ev=await eventsJ(x.id),get=t=>ev.find(e=>e.event_type===t)?.occurred_at;lines.push([x.work_date,names[x.operator_id]||'Personal',fmt(get('open')),fmt(get('lunch')),fmt(get('return')),fmt(get('close')),htext(hours(ev)),x.status==='closed'?'Cerrada':'Abierta']);}
      const csv='\uFEFF'+lines.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HAL_Garage_Horas_${from}_${to}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toastJ('Archivo de Excel generado correctamente.');
    }catch(e){toastJ(e.message||'No se pudo generar el Excel.',true)}
  }
  window.photosJ=photosModal; window.editJornadaJ=editJornada; window.deleteJornadaJ=deleteJornada; window.startJornadaJ=startJornada; window.nextJornadaJ=nextJornada; window.jornadaPage=jornadaPageJ; window.excelJ=excelJ;

  function cleanNav(){
    document.querySelectorAll('#app button[data-hal-jornada]').forEach(b=>b.remove());
    document.querySelectorAll('#app button').forEach(b=>{if(/Jornada y personal/i.test(b.textContent||''))b.remove();});
    if(document.querySelector('#app button[data-hal-simple-jornada]'))return;
    const b=document.createElement('button');b.className='btn alt';b.dataset.halSimpleJornada='1';b.textContent='🕘 Jornada y almuerzo';b.onclick=jornadaPageJ;
    const app=document.getElementById('app'); if(app)app.appendChild(b);
  }
  const obs=new MutationObserver(()=>cleanNav());obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(cleanNav,600);
})();
