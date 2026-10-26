export function initAudioAudit({fetch,projectId,prepare,adopt,onReady,onStatus}){
 const panel=document.querySelector('#audioAudit'),message=document.querySelector('#auditMessage'),items=document.querySelector('#auditItems'),button=document.querySelector('#auditStart');let busy=false,job=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
 async function request(route,body){const r=await fetch(route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),j=await r.json();if(!r.ok)throw Error(j.error||'Audiocontrole niet bereikbaar.');return j;}
 function show(j){job=j;onStatus?.(j);panel.hidden=false;message.textContent=j.message||'De audio wordt onafhankelijk gecontroleerd.';button.disabled=busy;button.textContent=j.status==='review'?'Controle loopt: zie twijfelgevallen':j.status==='ready'?'Controle afgerond':'Controleer audio';button.hidden=j.status==='review';items.replaceChildren();
  if(j.status!=='review')return;
  const pending=j.issues.filter(x=>!x.resolved);message.textContent=`Nog ${pending.length} twijfelgeval${pending.length===1?'':'len'}. Beluister en corrigeer alleen deze ondertitels.`;
  for(const x of pending){const card=document.createElement('article');card.className='auditIssue';card.innerHTML=`<strong>${esc(x.word||'Onzekere passage')} · ${time(x.start)}</strong><p>${esc(x.reason)}</p><audio controls preload="none" src="/bron.mp4?project=${encodeURIComponent(projectId)}#t=${Math.max(0,x.start-.5)},${x.end+.5}"></audio><label>Ondertitel bij dit luisterfragment<textarea maxlength="250">${esc(x.text)}</textarea></label><button class="primary">Bewaar en akkoord</button>`;
   const player=card.querySelector('audio'),begin=Math.max(0,x.start-.5),end=x.end+.5;player.addEventListener('play',()=>{if(player.currentTime<begin||player.currentTime>=end)player.currentTime=begin;});player.addEventListener('timeupdate',()=>{if(player.currentTime>=end&&!player.paused)player.pause();});
   card.querySelector('button').onclick=async()=>{const b=card.querySelector('button');b.disabled=true;try{const revision=await prepare();const r=await request('/api/audio-audit/resolve',{id:j.id,issueId:x.id,revision,text:card.querySelector('textarea').value});await adopt(r.state);show(r);if(r.status==='ready')await onReady();}catch(e){message.textContent=e.message;b.disabled=false;}};
   items.append(card);
  }
 }
 async function check(){if(busy)return false;busy=true;panel.hidden=false;button.disabled=true;try{
  const revision=await prepare();let j=await request('/api/audio-audit',{revision});show(j);
  while(j.status==='running'){await new Promise(r=>setTimeout(r,1500));j=await request('/api/audio-audit');show(j);}
  if(['review','ready'].includes(j.status)){await adopt(await request('/api/state'));show(j);if(j.status==='review')panel.scrollIntoView({behavior:'smooth',block:'start'});return j.status==='ready';}
  throw Error(j.message||'Audiocontrole niet afgerond.');
 }catch(e){message.textContent=e.message;return false;}finally{busy=false;button.disabled=false;}}
 button.onclick=async()=>{if(await check())await onReady();};
 request('/api/audio-audit').then(j=>{if(j.status!=='none')show(j);else onStatus?.(j);if(j.status==='running')check();}).catch(e=>{panel.hidden=false;message.textContent=e.message;});
 return {check};
}
