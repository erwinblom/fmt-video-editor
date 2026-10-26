import {projectFetch as fetch,projectId} from './interviews.js';
import {reviewSnapshot} from './export-status.mjs';
import {resolveQuote} from './model.mjs';
import {resolveFraming,SHOT_LABELS,guestFrameChoices} from './framing.mjs';
import {cutLimits,cardCutLimits,transitionTarget} from './transitions.mjs';
export function initTransitionPanel({getState,getCatalog,save,saved,getReview,confirmReview}){
 const dialog=document.createElement('dialog');dialog.className='transitionDialog';
 dialog.innerHTML=`<form method="dialog"><header><h2>Beeldovergang</h2><button aria-label="Beeldovergang sluiten">×</button></header></form><p data-description>Laat het beeld eerder of later wisselen. De audio en ondertitels blijven op hun plek. Na de overgang lopen beeld en stem weer gelijk.</p><p data-summary></p><label>Beeld wisselen <select data-direction aria-label="Beeld wisselen"><option value="-1">Eerder</option><option value="0">Tegelijk met de audio</option><option value="1">Later</option></select></label><div class="transitionFrames"><label for="transitionFrames">Aantal frames</label><button type="button" data-less aria-label="Eén frame minder">− 1 frame</button><input id="transitionFrames" data-frames aria-label="Aantal frames" type="number" min="1" max="12" step="1" value="3"><button type="button" data-more aria-label="Eén frame meer">+ 1 frame</button></div><p data-timing class="muted"></p><label>Uitsnede volgende quote <select data-shot aria-label="Uitsnede volgende quote"></select></label><p class="muted" data-shot-note>Deze uitsnede geldt voor de volgende quote.</p><p class="muted" data-card-note hidden>De audio en totale duur blijven gelijk. Eerder: de kaart verschijnt onder de laatste stem, met de ondertitel nog zichtbaar. Later: het interviewbeeld loopt kort door in de kaarttijd; de kaart wordt korter.</p><button type="button" data-preview class="primary">▶ Bekijk overgang</button><div class="manualReviewActions"><button type="button" data-confirm-review>Overgang gecontroleerd</button><p class="muted" data-review-state role="status"></p></div><p data-status role="status"></p><video data-video controls preload="metadata" hidden></video>`;
 document.body.append(dialog);const $=s=>dialog.querySelector(s),direction=$('[data-direction]'),frames=$('[data-frames]'),shot=$('[data-shot]'),player=$('video'),status=$('[data-status]');
 let ref=null,queue=Promise.resolve(),busy=false,generation=0,pending=0,invalid=false;
 const invalidate=()=>{generation++;player.pause();player.removeAttribute('src');player.hidden=true;status.textContent='';};
 const timing=()=>{const n=direction.value==='0'?0:Number(frames.value);$('[data-timing]').textContent=n?`${n} frames = ${(n/25).toFixed(2)} seconde ${direction.value==='-1'?'eerder':'later'}.`:'Beeld en audio wisselen tegelijk.';frames.disabled=direction.value==='0';$('[data-less]').disabled=frames.disabled||Number(frames.value)<=1;$('[data-more]').disabled=frames.disabled||Number(frames.value)>=Math.min(12,direction.value==='-1'?-ref.min:ref.max);};
 function write(){
  if(!ref)return;invalid=false;$('[data-preview]').disabled=false;const n=direction.value==='0'?0:Number(frames.value)*Number(direction.value);
  if(!Number.isInteger(n)||n<ref.min||n>ref.max){invalid=true;$('[data-preview]').disabled=true;invalidate();refreshReview();status.textContent=`Kies maximaal ${direction.value==='-1'?-ref.min:ref.max} frames binnen de beschikbare opname.`;return;}
  invalidate();timing();const target={...ref},choice=target.kind==='topic'?undefined:shot.value;status.textContent='Bewaren…';
  pending++;refreshReview();queue=queue.catch(()=>{}).then(()=>save(target.id,target.blockId,target.nextId,n,choice)).then(()=>{if(!ref||ref.id!==target.id||ref.blockId!==target.blockId)return;status.textContent='✓ Lokaal bewaard. Bekijk de overgang.';}).catch(e=>{status.textContent=e.message;throw e;}).finally(()=>{pending--;refreshReview();});queue.catch(()=>{});
 }
 $('[data-less]').onclick=()=>{frames.stepDown();write();};$('[data-more]').onclick=()=>{frames.stepUp();write();};
 direction.onchange=write;frames.oninput=write;shot.onchange=write;
 $('[data-preview]').onclick=async()=>{
  if(busy)return;busy=true;const ticket=generation;$('[data-preview]').disabled=true;status.textContent='Overgang voorbereiden…';player.pause();
  try{await queue;await saved();const state=getState();const res=await fetch('/api/transition-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:ref.id,blockId:ref.blockId,mode:state.mode,revision:state.revision})});const data=await res.json();if(!res.ok)throw Error(data.error||'Preview mislukt');if(ticket!==generation||!dialog.open)return;player.src='/api/transition-preview/'+data.key+'?project='+encodeURIComponent(projectId);player.hidden=false;status.textContent='Kort voorbeeld van dezelfde beeldknip als in de export. Geluid zonder achtergrondmuziek.'+(data.captionDraft?' Ondertiteltiming is hier nog een concept.':'');await player.play();}catch(e){status.textContent=e.message;}finally{busy=false;$('[data-preview]').disabled=false;refreshReview();}
 };
 function refreshReview(){const check=ref&&getReview?.(ref.id,ref.blockId);$('[data-confirm-review]').disabled=!ref||busy||pending>0||invalid||!!check?.visual;$('[data-review-state]').textContent=check?.visual?(check.visualHuman?'Door jou gecontroleerd.':'Controle is geldig.'):'Bevestig na bekijken. Afspelen keurt de overgang niet automatisch goed.';}
 $('[data-confirm-review]').onclick=async()=>{if(busy||pending||invalid||!ref)return;const target={...ref},state=getState(),item=reviewSnapshot(state,getCatalog()).items.find(x=>x.id===target.id&&x.blockId===target.blockId),proof={mode:state.mode,signature:JSON.stringify(item?.visual)};busy=true;refreshReview();try{await queue;await saved();await confirmReview(target.id,target.blockId,proof);status.textContent='Overgang gecontroleerd. Lokaal bewaard.';}catch(e){status.textContent=e.message;}finally{busy=false;refreshReview();}};
 dialog.addEventListener('close' ,()=>{invalidate();ref=null;});
 return {refreshReview,open(id,blockId){
  const state=getState(),catalog=getCatalog(),m=state.modes[state.mode],ids=blockId==='teaser'?m.teaser:m.blocks.find(b=>b.id===blockId)?.clipIds;
  const target=transitionTarget(state,id,blockId);if(!target)return;
  const {nextId,kind}=target,a=resolveQuote(state,catalog,id,blockId),b=kind==='clip'?resolveQuote(state,catalog,nextId,blockId):null;
  const limits=(kind==='topic'?cardCutLimits:cutLimits)({frames:Math.round((a.end-a.start)*25),sourceStart:a.start},b?{frames:Math.round((b.end-b.start)*25),sourceStart:b.start}:{frames:75},catalog.duration);
  ref={id,blockId,nextId,kind,...limits};invalid=false;invalidate();const n=a.transition?.nextId===nextId?a.transition.frames:0;
  direction.value=String(Math.sign(n));frames.value=Math.abs(n)||3;timing();
  $('[data-summary]').textContent=kind==='topic'?`Quote ${ids.indexOf(id)+1} → hoofdstukkaart: ${target.title}`:`Quote ${ids.indexOf(id)+1} → quote ${ids.indexOf(id)+2}`;
  $('[data-description]').textContent=kind==='topic'?'Laat het interviewbeeld eerder of later stoppen vóór de hoofdstukkaart. Audio en totale duur blijven gelijk.':'Laat het beeld eerder of later wisselen. De audio en ondertitels blijven op hun plek. Na de overgang lopen beeld en stem weer gelijk.';
  shot.closest('label').hidden=kind==='topic';$('[data-shot-note]').hidden=kind==='topic';$('[data-card-note]').hidden=kind!=='topic';
  if(b){const f=resolveFraming(state,catalog,nextId,blockId),available=state.guestFrames?guestFrameChoices(state):Object.keys(SHOT_LABELS);
   shot.replaceChildren(...[['auto',`Automatisch (${f.suggested?SHOT_LABELS[f.suggested]:f.label})`],...Object.entries(SHOT_LABELS)].map(([value,label])=>{const o=new Option(label,value);o.disabled=value!=='auto'&&!available.includes(value);return o;}));shot.value=b.shot||'auto';}
  if(n<limits.min||n>limits.max)status.textContent='Na inkorten is minder beeldruimte beschikbaar. Kies de verschuiving opnieuw.';
  refreshReview();dialog.showModal();
 }};
}
