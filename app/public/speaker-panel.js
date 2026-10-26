import {projectFetch} from '/interviews.js';
import {SPEAKER_ROLES} from '/speakers.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=n=>`${Math.floor(n/60)}:${(n%60).toFixed(2).padStart(5,'0')}`;
export function initSpeakerPanel({getCatalog,onChange,beforeOpen}){
 const $=id=>document.getElementById(id),dialog=$('speakerDialog'),audio=$('speakerAudio');let data,poll=null,end=null,dirty=false;
 $('openSpeakers').hidden=false;
 async function request(input){const r=await projectFetch('/api/speakers',input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:undefined),d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 const message=s=>$('speakerSaveMessage').textContent=s;
 const voiceOptions=id=>data.voices.map(v=>`<option value="${esc(v.id)}" ${id===v.id?'selected':''}>${esc(v.name||v.label)}</option>`).join('');
 function draw(){
  onChange(data);
  $('speakerMessage').textContent=data.message||'Laat de editor stemmen in de audio onderscheiden. Je opname blijft op deze Mac.';
  $('speakerStart').hidden=false;$('recognizeSpeakers').textContent=data.status==='complete'?'Opnieuw herkennen':'Herken stemmen';$('recognizeSpeakers').disabled=data.status==='running';$('speakerForm').hidden=data.status!=='complete';
  if(data.status==='complete'){
   $('speakerVoices').innerHTML=data.voices.map(v=>`<section class="speakerCard" data-voice="${esc(v.id)}"><h3>${esc(v.label)}</h3><button type="button" data-sample="${esc(v.id)}">▶ Luistervoorbeeld</button><label>Naam <input data-name maxlength="120" value="${esc(v.name)}" placeholder="Wie hoor je?"></label><label>Rol <select data-role>${Object.entries(SPEAKER_ROLES).map(([id,label])=>`<option value="${id}" ${v.role===id?'selected':''}>${label}</option>`).join('')}</select></label></section>`).join('');
   $('speakerTurns').innerHTML=data.turns.map(t=>{const text=(getCatalog().words||[]).filter(w=>w.start<t.end&&w.end>t.start).map(w=>w.text).join('').trim();return `<div class="speakerTurn" data-turn="${esc(t.id)}"><button type="button" data-turn-play="${esc(t.id)}">▶ ${time(t.start)}–${time(t.end)}</button><select aria-label="Stem bij ${time(t.start)}">${voiceOptions(t.speakerId)}</select><span>${esc(text||'Geen transcript op dit tijdstip')}</span></div>`;}).join('');
  }
  if(data.status==='running'&&dialog.open){clearTimeout(poll);poll=setTimeout(async()=>{try{data=await request();draw();}catch(e){message(e.message);}},2000);}
 }
 $('openSpeakers').onclick=async()=>{if(!await beforeOpen())return;dialog.showModal();message('');try{data=await request();draw();}catch(e){message(e.message);}};
 $('recognizeSpeakers').onclick=async()=>{if(dirty){message('Bewaar eerst je sprekerwijzigingen.');return;}message('');try{data=await request({count:0});draw();}catch(e){message(e.message);}};
 $('closeSpeakers').onclick=()=>{if(dirty){message('Je hebt wijzigingen. Klik eerst Bewaar sprekers.');return;}dialog.close();};
 dialog.addEventListener('cancel',e=>{if(dirty){e.preventDefault();message('Bewaar eerst je sprekerwijzigingen.');}});
 dialog.addEventListener('close',()=>{clearTimeout(poll);audio.pause();end=null;});
 $('speakerForm').addEventListener('input',()=>{dirty=true;message('Sprekerwijzigingen nog niet bewaard.');});
 $('speakerForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const voices=[...$('speakerVoices').querySelectorAll('[data-voice]')].map(row=>({id:row.dataset.voice,name:row.querySelector('[data-name]').value,role:row.querySelector('[data-role]').value})),corrections=Object.fromEntries([...$('speakerTurns').querySelectorAll('[data-turn]')].map(row=>[row.dataset.turn,row.querySelector('select').value]));data=await request({action:'save',revision:data.revision,voices,corrections});dirty=false;draw();message('✓ Sprekers lokaal bewaard. Je bestaande montage is behouden; een nieuw voorstel gebruikt deze rollen.');}catch(e){message(e.message);}finally{button.disabled=false;}};
 dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-sample],[data-turn-play]');if(!b)return;const t=b.dataset.sample?data.voices.find(v=>v.id===b.dataset.sample)?.sample:data.turns.find(t=>t.id===b.dataset.turnPlay);if(!t)return;if(!audio.src){audio.src=new URL('/bron.mp4?project='+encodeURIComponent(new URLSearchParams(location.search).get('project')),location.href);audio.load();}audio.hidden=false;end=t.end;audio.currentTime=t.start;try{await audio.play();}catch{message('Druk op afspelen in de luisterspeler.');}});
 audio.addEventListener('timeupdate',()=>{if(end!==null&&audio.currentTime>=end){audio.pause();end=null;}});
}
