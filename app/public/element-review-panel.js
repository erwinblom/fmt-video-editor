import {projectFetch,projectId} from './interviews.js';
import {ELEMENT_TYPES} from './elements.mjs';

const isOpen=item=>['pending','draft'].includes(item.status);
const title=item=>item.element.type==='number'?item.element.value+' '+item.element.label:item.element.text;
const node=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};

export function initElementReviewPanel({getState,panel,prepare,open,close}){
 const button=node('button','Beeldvoorstellen');button.id='elementReviewOpen';document.querySelector('#workspaceReview h2').before(button);
 const dialog=document.createElement('dialog');dialog.id='elementReviewDialog';dialog.className='cutBatchDialog';dialog.setAttribute('aria-labelledby','elementReviewTitle');
 dialog.innerHTML=`<header class="panelHead"><div><span class="taskEyebrow">AI maakt het voorbeeld · jij beslist</span><h2 id="elementReviewTitle">Beeldvoorstellen</h2></div><button data-close>Sluiten</button></header><section class="elementReviewOverview"><p data-summary></p><progress data-progress aria-label="Beoordeelde beeldvoorstellen"></progress><button data-resume class="primary">Verdergaan</button><p class="muted">Bekijk en pas ieder voorstel aan in de video. Alleen goedkeuren verandert je montage.</p><div data-items></div><details data-history><summary>Afgehandeld</summary><div data-history-items></div></details><p data-error role="status"></p></section>`;
 document.body.append(dialog);const $=s=>dialog.querySelector(s);
 const source=document.querySelector('#sourcePanel'),bar=document.createElement('section');bar.id='elementReviewBar';bar.hidden=true;bar.setAttribute('aria-label','Beeldvoorstel beoordelen');
 bar.innerHTML=`<div class="elementReviewHeading"><div><span data-position class="taskEyebrow"></span><h2 data-title tabindex="-1"></h2><p data-place></p></div><button data-list>Terug naar lijst</button></div><p data-reason></p><details><summary>Waarom dit voorstel · bronpassage</summary><p data-basis></p></details><div class="elementReviewDecisions"><button data-approve class="primary">Goedkeuren en volgende</button><button data-reject>Afkeuren en volgende</button><button data-later>Later bekijken</button></div><p data-message role="status"></p>`;
 source.prepend(bar);const b=s=>bar.querySelector(s);
 let view=null,active=null,busy=false,signature='',request=0,locked=[];
 async function read(){const mode=getState().mode,ticket=++request,r=await projectFetch('/api/element-review-queue?'+new URLSearchParams({mode})),data=await r.json();if(!r.ok)throw Error(data.error||'Beeldvoorstellen laden mislukt');if(ticket!==request||mode!==getState().mode)return null;view=data;render();return data;}
 async function progress(action,token,currentToken){const r=await projectFetch('/api/element-review-queue/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:view.mode,action,token,...(currentToken!==undefined?{currentToken}:{})})}),data=await r.json();if(!r.ok)throw Error(data.error||'Voortgang bewaren mislukt');request++;view=data;render();}
 function render(){
  if(!view)return;button.textContent=`Beeldvoorstellen · ${view.counts.open}`;
  const c=view.counts;$('[data-summary]').textContent=c.total?`${c.approved+c.rejected} van ${c.total} beoordeeld · ${c.open} open${c.deferred?' · '+c.deferred+' voor later':''}`:'Nog geen gemaakte beeldvoorstellen. Open een fragment en kies Doe voorstellen.';
  $('[data-progress]').max=Math.max(1,c.total);$('[data-progress]').value=c.approved+c.rejected;
  const resume=view.items.find(i=>i.token===view.progress.currentToken&&isOpen(i))||view.items.find(isOpen);$('[data-resume]').hidden=!resume;$('[data-resume]').textContent=view.progress.currentToken&&resume?.token===view.progress.currentToken?'Verdergaan waar je was':c.approved+c.rejected+c.deferred?'Verder met open voorstellen':'Begin met beoordelen';$('[data-resume]').onclick=()=>run(()=>review(resume));
  $('[data-items]').replaceChildren();$('[data-history-items]').replaceChildren();$('[data-history]').hidden=!(c.approved+c.rejected);$('[data-history] summary').textContent=`Afgehandeld · ${c.approved+c.rejected}`;
  for(const item of view.items){
   const card=node('article','', 'elementReviewItem');const info=node('div','');info.append(node('small',`${item.title} · fragment ${item.quoteIndex}`),node('strong',title(item)),node('span',ELEMENT_TYPES[item.element.type]||'Beeldvoorstel'));
   const status=isOpen(item)?view.progress.deferred.includes(item.token)?'Voor later':item.status==='draft'?'Aanpassing bewaard':'Nog te beoordelen':item.status==='approved'?'Goedgekeurd':'Afgekeurd';info.append(node('small',status));card.append(info);
   if(isOpen(item)){const go=node('button','Bekijken');go.onclick=()=>run(()=>review(item));card.append(go);}
   else{const details=node('details','');details.append(node('summary','Voorstel teruglezen'),node('p',item.reason||''),node('p',item.basis||''));if(item.element.artworkId){const image=document.createElement('img');image.src='/api/element-assets/'+item.element.artworkId+'?'+new URLSearchParams({project:projectId});image.alt=title(item);image.loading='lazy';details.append(image);}card.append(details);}
   $(isOpen(item)?'[data-items]':'[data-history-items]').append(card);
  }
 }
 function setReview(enabled){
  bar.hidden=!enabled;source.classList.toggle('reviewingElements',enabled);
  if(enabled&&!locked.length)for(const el of document.querySelectorAll('.chapterNav,#montageTools,#deliveryTools,body>header')){locked.push([el,el.inert]);el.inert=true;}
  if(!enabled){for(const [el,inert] of locked)el.inert=inert;locked=[];}
 }
 async function review(item){
  if(!item||!await prepare())return;
  await read();item=view.items.find(i=>i.token===item.token&&isOpen(i));if(!item)throw Error('Dit voorstel is gewijzigd of afgehandeld. Kies opnieuw uit de lijst.');
  await progress('visit',item.token);
  active=null;setReview(false);
  if(!open(item))throw Error('Bewaar eerst je huidige wijziging.');
  if(!await panel.review(item))throw Error('Het voorstel kon niet worden geopend.');
  active=item;setReview(true);dialog.close();
  const order=[...view.items].sort((a,z)=>a.quoteIndex-z.quoteIndex||String(a.proposalId).localeCompare(String(z.proposalId)));
  b('[data-position]').textContent=`Voorstel ${order.findIndex(i=>i.token===item.token)+1} van ${view.counts.total} · ${view.counts.open} nog te beoordelen`;
  b('[data-title]').textContent=title(item);b('[data-place]').textContent=item.title+' · fragment '+item.quoteIndex+' · '+ELEMENT_TYPES[item.element.type];b('[data-reason]').textContent=item.reason||'';b('[data-basis]').textContent=item.basis||'Geen extra bronpassage opgeslagen.';b('[data-message]').textContent='';
  document.querySelector('.sourceBody').scrollTop=0;b('[data-title]').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
 }
 async function overview(){
  if(!await prepare())return;
  if(active){panel.endReview();active=null;setReview(false);close();}
  if(!dialog.open)dialog.showModal();await read();$('[data-error]').textContent='';
 }
 async function decide(action){
  if(!active)return;if(panel.reviewToken()!==active.token)throw Error('Het geopende voorstel is gewijzigd. Ga terug naar de lijst.');if(!await (action==='reject'?panel.settleReview():panel.flush())){b('[data-message]').textContent='Controleer de velden rechts en probeer opnieuw zodra je aanpassing is bewaard.';return;}
  if(panel.reviewToken()!==active.token)throw Error('Het voorstel is gewijzigd tijdens het bewaren. Ga terug naar de lijst.');
  const token=active.token;
  if(action==='later')await progress('later',token,null);
  else if(!await panel.performAction(action==='approve'?'save':'reject'))return;
  await read();
  const next=view.items.find(i=>isOpen(i)&&i.token!==token&&!view.progress.deferred.includes(i.token))||(action!=='later'&&view.items.find(i=>isOpen(i)&&i.token!==token));
  if(next)await review(next);else await overview();
 }
 async function run(fn){
  if(busy)return;busy=true;const body=document.querySelector('.sourceBody');body.inert=true;bar.setAttribute('aria-busy','true');for(const el of bar.querySelectorAll('button'))el.disabled=true;
  try{await fn();}catch(error){b('[data-message]').textContent=error.message;$('[data-error]').textContent=error.message;if(!active){panel.endReview();setReview(false);close();if(!dialog.open)dialog.showModal();}}
  finally{busy=false;body.inert=false;bar.removeAttribute('aria-busy');for(const el of bar.querySelectorAll('button'))el.disabled=false;}
 }
 button.onclick=()=>run(overview);$('[data-close]').onclick=()=>dialog.close();b('[data-list]').onclick=()=>run(overview);
 for(const action of ['approve','reject','later'])b('[data-'+action+']').onclick=()=>run(()=>decide(action));
 document.addEventListener('click',event=>{if(active&&event.target.closest('#closeSource')){event.preventDefault();event.stopImmediatePropagation();void run(overview);}},true);
 document.addEventListener('keydown',event=>{if(!active||event.target.closest('input,textarea,select,[contenteditable=true]'))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();void run(overview);}else if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();}},true);
 async function watch(force=false){const next=getState().mode+':'+getState().revision;if(!force&&signature===next)return;signature=next;try{await read();}catch(error){signature='';button.textContent='Beeldvoorstellen · opnieuw laden';button.title=error.message;}}
 window.addEventListener('focus',()=>watch(true));window.addEventListener('fmt:element-proposals-changed',()=>watch(true));void watch();
 return {watch};
}
