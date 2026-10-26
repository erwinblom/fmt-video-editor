import {ELEMENT_TYPES,elementLayout,resolveElement,elementActive,imageElement,validateElement} from './elements.mjs';
import {artwork as drawArtwork} from './element-artwork.js';
import {projectFetch,projectId} from './interviews.js';
const imageURL=id=>'/api/element-assets/'+id+'?project='+encodeURIComponent(projectId);
export const artwork=e=>drawArtwork(e,{assetURL:imageURL});
const rectFields=(prefix,title)=>`<fieldset class="elementRect"><legend>${title} · percentages van het bronbeeld</legend>${[['x','Links'],['y','Boven'],['width','Breedte'],['height','Hoogte']].map(([n,label])=>`<label>${label}<input name="${prefix}-${n}" type="number" min="0" max="100" step="0.1"></label>`).join('')}</fieldset>`;
export function initElementPanel({context,write,prepare,prepareSuggestions=prepare,onToggle,applied=()=>{}}){
 if(!document.querySelector('[data-element-styles]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/element-panel.css';style.dataset.elementStyles='';document.head.append(style);}
 const panel=document.createElement('details');panel.id='elementPanel';panel.innerHTML=`<summary>Element toevoegen</summary><p class="muted">Eén rustig element bij deze fragmentplek. De spreker blijft in beeld, de ondertitelbalk blijft vrij.</p><button type="button" data-suggest>Doe voorstellen</button><p class="muted">AI maakt passende voorbeelden, inclusief beeld en vormgeving. Jij bekijkt, past aan en beslist.</p><div data-suggestions role="status"></div><p data-proposal-note class="elementProposalNote" hidden></p><label>Soort<select name="type">${Object.entries(ELEMENT_TYPES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label data-field="text">Tekst<textarea name="text" maxlength="120" rows="3"></textarea></label><label data-field="value">Cijfer<input name="value" maxlength="16" placeholder="Bijvoorbeeld: 100+"></label><label data-field="label">Toelichting<input name="label" maxlength="80"></label><div data-field="comparison"><div class="elementPair"><label>Linker kolom<input name="leftTitle" maxlength="50"></label><label>Rechter kolom<input name="rightTitle" maxlength="50"></label></div>${[0,1,2].map(i=>`<div class="elementPair"><label>Links · regel ${i+1}<textarea name="left-${i}" maxlength="100" rows="2"></textarea></label><label>Rechts · regel ${i+1}<textarea name="right-${i}" maxlength="100" rows="2"></textarea></label></div>`).join('')}<p class="muted">Eén tot drie vergelijkingsregels. Laat ongebruikte regels leeg.</p></div><div data-field="diagram">${[0,1,2,3].map(i=>`<label>Stap ${i+1}${i>1?' · optioneel':''}<input name="step-${i}" maxlength="70"></label>`).join('')}<label>Terugkoppeling · optioneel<input name="feedback" maxlength="80"></label></div><label data-field="annotation">Annotatie<textarea name="annotation-text" maxlength="100" rows="2"></textarea></label><details data-field="image-controls"><summary>Beeld en markering aanpassen</summary><label data-field="image">Afbeelding vervangen<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><div data-field="crop">${rectFields('crop','Uitsnede')}${rectFields('annotation','Rood kader')}</div><p class="muted">De uitsnede en het rode kader gebruiken dezelfde bronafbeelding. Het rode kader moet binnen de uitsnede blijven.</p></details><label>Bron of toeschrijving<input name="source" maxlength="180" placeholder="Bijvoorbeeld: volgens de geïnterviewde"></label><label data-field="sourceUrl">Bronlink<input name="sourceUrl" type="url" maxlength="2000" placeholder="https://…"></label><div class="elementTimes"><label>Vanaf seconde<input name="start" type="number" min="0" step="0.04"></label><label>Tot seconde<input name="end" type="number" min="0.04" step="0.04"></label></div><label>Spreker in beeld<select name="layout"><option value="side">Groot naast het element</option><option value="inset">Klein bij het element</option></select></label><p class="muted">Tijden vanaf het begin van dit fragment. Na inkorten past de weergave binnen de nieuwe knip.</p><div class="elementButtons"><button type="button" data-element="preview">Bekijk element</button><button type="button" data-element="save" class="primary">Bewaar element</button><button type="button" data-element="draft" hidden>Bewaar voorstel</button><button type="button" data-element="reject" hidden>Afkeuren</button><button type="button" data-element="remove">Element weglaten</button><button type="button" data-element="cancel">Sluiten</button></div><p class="elementMessage" role="status"></p>`;
 document.querySelector('.sourceBody').prepend(panel);
 const overlay=document.createElement('img');overlay.id='elementArtwork';overlay.alt='';overlay.hidden=true;document.querySelector('#framePreview').append(overlay);
 const field=n=>panel.querySelector(`[name="${n}"]`),message=t=>panel.querySelector('.elementMessage').textContent=t;
 let saved=null,key=null,asset=null,draft=null,preview=null,generation=0,busy=false,dirty=false,previewTimer=null,previewInvalid=false,draftTimer=null,autosaving=null;
 let request=0,suggestionKey=null,proposalSet=null,activeProposal=null;
 const identity=()=>context()?.key;
 const suggestions=panel.querySelector('[data-suggestions]'),suggestButton=panel.querySelector('[data-suggest]');
 const suggestionIdentity=()=>{const c=context();return c&&JSON.stringify([c.key,c.quote.start,c.quote.end,c.quote.nl]);};
 const endpointData=()=>{const {mode,id,blockId}=context();return {mode,id,blockId};};
 const statusLabel={pending:'Nog te beoordelen',draft:'Aangepast voorstel',approved:'Goedgekeurd',rejected:'Afgekeurd'};
 function renderSuggestions(){
  suggestions.replaceChildren();if(!proposalSet)return;
  const intro=document.createElement('p');intro.textContent=proposalSet.reason||(!proposalSet.items?.length?'Nog geen voorstellen bij dit fragment.':'');suggestions.append(intro);
  for(const item of proposalSet.items||[]){const card=document.createElement('article');card.className='elementProposal';card.dataset.status=item.status||'pending';
   const e=item.element||item,title=document.createElement('strong');title.textContent=(ELEMENT_TYPES[e.type]||'Voorstel')+' · '+(e.type==='number'?e.label:e.text||'');card.append(title);
   const status=document.createElement('span');status.className='elementProposalStatus';status.textContent=statusLabel[item.status]||statusLabel.pending;card.append(status);
   const why=document.createElement('p');why.textContent=item.reason||'';card.append(why);
   if(item.creationError){const error=document.createElement('p');error.className='elementCreationError';error.textContent='Nog niet gemaakt: '+item.creationError;card.append(error);}
   const evidence=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Waarom dit voorstel · bron';evidence.append(summary);
   for(const content of [item.basis&&'Bronpassage: '+item.basis,item.imageIdea&&'Beeldkeuze: '+item.imageIdea,e.source&&'Toeschrijving: '+e.source].filter(Boolean)){const p=document.createElement('p');p.textContent=content;evidence.append(p);}
   if(e.sourceUrl&&/^https?:\/\//.test(e.sourceUrl)){const link=document.createElement('a');link.href=e.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Bekijk de bron';evidence.append(link);}card.append(evidence);
   const buttons=document.createElement('div');buttons.className='elementProposalActions';
   if(item.element&&!item.creationError&&item.status!=='rejected'){const isCurrent=item.status==='approved'&&item.element.artworkId===context()?.quote.element?.artworkId;if(item.status!=='approved'||isCurrent){const use=document.createElement('button');use.type='button';use.textContent=isCurrent?'Bekijk toegepast element':'Bekijken en aanpassen';use.onclick=()=>{if(isCurrent){if(dirty||busy||autosaving){message('Bewaar of sluit eerst je huidige aanpassing.');return;}populate();schedulePreview(0);}else openProposal(item);};buttons.append(use);}if(item.status!=='approved'&&context()?.quote.element){const replace=document.createElement('p');replace.className='muted';replace.textContent='Vervangt het huidige element na goedkeuren.';card.append(replace);}}
   if(item.status!=='rejected'&&item.status!=='approved'){const reject=document.createElement('button');reject.type='button';reject.textContent='Afkeuren';reject.onclick=()=>rejectProposal(item);buttons.append(reject);}
   card.append(buttons);suggestions.append(card);
  }
 }
 async function loadSuggestions(){
  const ctx=context();if(!ctx)return;const snapshot=suggestionIdentity();if(suggestionKey===snapshot)return;
  const ticket=++request,at=identity();suggestionKey=snapshot;suggestions.textContent='Bewaarde voorstellen laden…';
  try{const params=new URLSearchParams(endpointData()),r=await projectFetch('/api/element-proposals?'+params),result=await r.json();if(ticket!==request||at!==identity()||snapshot!==suggestionIdentity())return;if(!r.ok)throw Error(result.error||'Voorstellen laden mislukt');proposalSet=result;renderSuggestions();}
  catch(e){if(ticket===request&&at===identity()){suggestionKey=null;suggestions.textContent=e.message;}}
 }
 suggestButton.addEventListener('click',async()=>{
  if(dirty||busy||autosaving){message('Bewaar of sluit eerst je huidige aanpassing.');return;}
  const requested=identity();if(!await prepareSuggestions()||requested!==identity())return;
  const at=identity(),snapshot=suggestionIdentity(),ticket=++request;suggestionKey=snapshot;suggestButton.disabled=true;suggestions.textContent='AI kiest en maakt de voorbeelden…';
  try{const r=await projectFetch('/api/element-proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(endpointData())}),result=await r.json();if(ticket!==request||at!==identity()||snapshot!==suggestionIdentity())return;if(!r.ok)throw Error(result.error||'Voorstellen maken mislukt');proposalSet=result;renderSuggestions();window.dispatchEvent(new Event('fmt:element-proposals-changed'));}
  catch(e){if(ticket===request&&at===identity())suggestions.textContent=e.message;}finally{if(ticket===request)suggestButton.disabled=false;}
 });
 function putValues(e){
  asset=e?.assetId||null;
  for(const n of ['type','layout','text','value','label','source','sourceUrl','start','end'])field(n).value=e?.[n]??({type:'statement',layout:'side',start:0,end:Math.min(6,context().quote.end-context().quote.start)}[n]??'');
  for(const prefix of ['crop','annotation'])for(const n of ['x','y','width','height'])field(`${prefix}-${n}`).value=100*(e?.[prefix]?.[n]??({x:0,y:0,width:1,height:1}[n]));
  field('annotation-text').value=e?.annotation?.text||'';
  for(const n of ['leftTitle','rightTitle'])field(n).value=e?.comparison?.[n]||'';
  for(let i=0;i<3;i++)for(const n of ['left','right'])field(`${n}-${i}`).value=e?.comparison?.rows?.[i]?.[n]||'';
  for(let i=0;i<4;i++)field(`step-${i}`).value=e?.diagram?.steps?.[i]||'';field('feedback').value=e?.diagram?.feedback||'';field('image').value='';
 }
 function openProposal(item){
  if(dirty||busy||autosaving){message('Bewaar of sluit eerst je huidige aanpassing.');return;}
  if(!item.element||item.creationError)return;clearTimeout(draftTimer);generation++;activeProposal=item;const group=suggestions.closest('details');if(group&&group!==panel)group.open=false;putValues(item.element);dirty=false;draft=null;preview=null;fields();update();schedulePreview(0);message('Voorstel in beeld · pas aan, keur goed of keur af.');
 }
 function updateProposal(result,fallback){
  window.dispatchEvent(new Event('fmt:element-proposals-changed'));const item=result.proposal||fallback;if(item&&proposalSet){const index=proposalSet.items.findIndex(p=>p.proposalId===item.proposalId);if(index>=0)proposalSet.items[index]=item;if(activeProposal?.proposalId===item.proposalId)activeProposal=item;renderSuggestions();}
 }
 async function decide(item,action,element){
  const body={...endpointData(),key:proposalSet.key,proposalId:item.proposalId,action,...(element?{element}:{}),...(action==='approve'?{currentElement:context().quote.element||null}:{})};
  const r=await projectFetch('/api/element-proposals/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await r.json();if(!r.ok)throw Error(result.error||'Beslissing bewaren mislukt');return result;
 }
 async function rejectProposal(item){
  if(busy||autosaving){message('Wacht tot het voorstel is bewaard.');return;}if(dirty&&activeProposal?.proposalId!==item.proposalId){message('Bewaar of sluit eerst je huidige aanpassing.');return;}
  clearTimeout(draftTimer);const at=identity();busy=true;try{const result=await decide(item,'reject');if(at!==identity())return;updateProposal(result,{...item,status:'rejected'});if(activeProposal?.proposalId===item.proposalId)populate();message('Voorstel afgekeurd · je montage is behouden.');return true;}catch(e){message(e.message);}finally{busy=false;fields();update();}
 }
 function reset(){clearTimeout(previewTimer);clearTimeout(draftTimer);previewInvalid=false;request++;suggestionKey=null;proposalSet=null;activeProposal=null;suggestButton.disabled=false;suggestions.replaceChildren();key=null;dirty=false;draft=null;preview=null;generation++;panel.open=false;}
 function populate(){clearTimeout(previewTimer);clearTimeout(draftTimer);generation++;previewInvalid=false;const ctx=context();if(!ctx)return;const e=resolveElement(ctx.quote.element,ctx.quote.end-ctx.quote.start);key=ctx.key;saved=JSON.stringify([ctx.quote.element||null,ctx.quote.start,ctx.quote.end]);putValues(e);activeProposal=null;draft=null;preview=null;dirty=false;message('');fields();}
 function fields(){
  const t=field('type').value,isImage=['proof','annotatedProof'].includes(t);
  for(const n of ['text','value','label','image','image-controls','annotation','crop','comparison','diagram','sourceUrl']){const el=panel.querySelector(`[data-field="${n}"]`);el.hidden=n==='text'?t==='number':['value','label'].includes(n)?t!=='number':['image','image-controls','sourceUrl'].includes(n)?!isImage:['annotation','crop'].includes(n)?t!=='annotatedProof':t!==n;}
  field('layout').querySelector('[value="inset"]').disabled=['comparison','diagram'].includes(t);if(['comparison','diagram'].includes(t))field('layout').value='side';
  panel.querySelector('[data-element="remove"]').hidden=!context()?.quote.element||!!activeProposal;
  for(const n of ['draft','reject'])panel.querySelector(`[data-element="${n}"]`).hidden=!activeProposal;
  panel.querySelector('[data-element="save"]').textContent=activeProposal?'Goedkeuren en toepassen':'Bewaar element';
  const note=panel.querySelector('[data-proposal-note]');note.hidden=!activeProposal;note.textContent=activeProposal?(context()?.quote.element?'Je bekijkt een voorstel. Goedkeuren vervangt het huidige element.':'Je bekijkt een voorstel. Alleen goedkeuren verandert de montage.'):'';
 }
 function values(){
  const ctx=context();if(!ctx)throw Error('Kies een fragment');const e={type:field('type').value,layout:field('layout').value,start:Number(field('start').value),end:Number(field('end').value),text:field('text').value.trim(),value:field('value').value.trim(),label:field('label').value.trim(),source:field('source').value.trim(),assetId:asset};
  if(imageElement(e)&&field('sourceUrl').value.trim())e.sourceUrl=field('sourceUrl').value.trim();
  if(e.type==='annotatedProof'){for(const prefix of ['crop','annotation'])e[prefix]=Object.fromEntries(['x','y','width','height'].map(n=>[n,Number(field(`${prefix}-${n}`).value)/100]));e.annotation.text=field('annotation-text').value.trim();}
  if(e.type==='comparison')e.comparison={leftTitle:field('leftTitle').value.trim(),rightTitle:field('rightTitle').value.trim(),rows:[0,1,2].map(i=>({left:field(`left-${i}`).value.trim(),right:field(`right-${i}`).value.trim()})).filter(r=>r.left||r.right)};
  if(e.type==='diagram')e.diagram={steps:[0,1,2,3].map(i=>field(`step-${i}`).value.trim()).filter(Boolean),feedback:field('feedback').value.trim()};
  if(e.start<0||e.end>ctx.quote.end-ctx.quote.start+.00001||e.end-e.start<.04-1e-6)throw Error('Kies tijden binnen dit fragment');validateElement({...e,artworkId:'0'.repeat(64)});return e;
 }
 async function upload(data){const blob=await (await window.fetch(data)).blob(),r=await projectFetch('/api/element-assets',{method:'POST',headers:{'Content-Type':'image/png'},body:blob});const result=await r.json();if(!r.ok)throw Error(result.error);return result.id;}
 async function showDraft({keepPosition=false}={}){const ticket=++generation,at=identity(),e=values(),url=await artwork(e);if(ticket!==generation||at!==identity())return null;draft=e;preview=url;previewInvalid=false;const v=document.querySelector('#video'),relative=v.currentTime-context().quote.start;if(!keepPosition||!elementActive(e,relative)){v.pause();v.currentTime=context().quote.start+e.start;}update();return {e,url,at,ticket};}
 function scheduleDraft(result){
  clearTimeout(draftTimer);if(!activeProposal||!dirty)return;
  draftTimer=setTimeout(async()=>{if(result.at!==identity()||result.ticket!==generation||!activeProposal||!dirty)return;if(autosaving||busy){scheduleDraft(result);return;}const item=activeProposal;
   autosaving=(async()=>{try{const id=await upload(result.url);if(result.at!==identity()||result.ticket!==generation)return;const element={...result.e,artworkId:id},response=await decide(item,'draft',element);if(result.at!==identity())return;updateProposal(response,{...item,status:'draft',element});if(result.ticket===generation){dirty=false;message('Voorstel bewaard · nog niet toegepast');}}catch(e){if(result.at===identity())message(e.message+' Je aanpassing is nog niet bewaard.');}finally{autosaving=null;fields();}})();
  },650);
 }
 function schedulePreview(delay=180){clearTimeout(previewTimer);const at=identity();previewTimer=setTimeout(async()=>{if(at!==identity()||!panel.open||busy)return;const ticket=generation;try{const result=await showDraft({keepPosition:true});if(result){message(activeProposal?'Voorstel in beeld · nog niet toegepast':dirty?'Voorbeeld bijgewerkt · nog niet bewaard':'Voorbeeld van je bewaarde element');scheduleDraft(result);}}catch(e){if(at!==identity()||generation>ticket+1)return;draft=null;preview=null;previewInvalid=true;message(e.message);update();}},delay);}
 panel.addEventListener('input',event=>{if(!event.target.matches('input,textarea,select'))return;dirty=true;generation++;clearTimeout(draftTimer);message('Voorbeeld bijwerken…');fields();schedulePreview();});
 field('type').addEventListener('change',()=>{field('layout').value=['proof','annotatedProof'].includes(field('type').value)?'inset':'side';fields();});
 field('image').addEventListener('change',async()=>{const f=field('image').files[0];if(!f)return;const at=identity();asset=null;draft=null;preview=null;previewInvalid=true;update();busy=true;try{if(f.size>20*1024*1024)throw Error('Kies een afbeelding van maximaal 20 MB');const bitmap=await createImageBitmap(f),factor=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.round(bitmap.width*factor);c.height=Math.round(bitmap.height*factor);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();const id=await upload(c.toDataURL('image/png'));if(at===identity()){asset=id;message('Afbeelding gekozen · bekijk het nieuwe voorbeeld');}}catch(e){message(e.message);}finally{busy=false;schedulePreview(0);}});
 async function performAction(action){
  if(!action||busy)return false;clearTimeout(previewTimer);clearTimeout(draftTimer);
  if(autosaving){message('Wacht tot het voorstel is bewaard.');return;}
  if(action==='cancel'){populate();panel.open=false;update();return;}
  if(action==='reject'&&activeProposal)return await rejectProposal(activeProposal);
  if(action==='remove'){write(null);populate();update();message('Element weggelaten');return;}
  busy=true;try{if(!await prepare())return;const result=await showDraft();if(!result)return;if(['save','draft'].includes(action)){
    const id=await upload(result.url);if(result.at!==identity()||result.ticket!==generation)return;const element={...result.e,artworkId:id};
    if(activeProposal){const item=activeProposal,response=await decide(item,action==='save'?'approve':'draft',element);if(result.at!==identity())return;updateProposal(response,{...item,status:action==='save'?'approved':'draft',element});if(action==='save'){await applied(response);dirty=false;populate();renderSuggestions();message('Goedgekeurd en toegepast in de montage');}else {dirty=false;message('Voorstel bewaard · nog niet toegepast');}}
    else{write(element);saved=JSON.stringify([context().quote.element||null,context().quote.start,context().quote.end]);dirty=false;draft=null;preview=null;message('Element wordt lokaal bewaard');}
    fields();
   }else message('Voorbeeld · gebruik Afspelen om het fragment te bekijken');
   return true;
  }catch(e){message(e.message);return false;}finally{busy=false;update();}
 }
 panel.addEventListener('click',event=>{const action=event.target.closest('[data-element]')?.dataset.element;if(action)void performAction(action);});
 panel.addEventListener('toggle',()=>{if(panel.open&&key!==identity())populate();onToggle();if(panel.open){loadSuggestions();if(context()?.quote.element||dirty||activeProposal)schedulePreview(0);}else clearTimeout(previewTimer);});
 function update(){
  const ctx=context();if(suggestionKey&&suggestionKey!==suggestionIdentity()){request++;suggestionKey=null;proposalSet=null;activeProposal=null;suggestButton.disabled=false;suggestions.replaceChildren();}
  panel.hidden=!ctx||ctx.hasVideo===false;const frame=document.querySelector('#framePreview'),viewport=document.querySelector('#sourceViewport');
  if(!ctx||ctx.key!==key){reset();if(ctx)populate();}else if(!busy&&!dirty&&!activeProposal&&saved!==JSON.stringify([ctx.quote.element||null,ctx.quote.start,ctx.quote.end])){populate();if(panel.open&&ctx.quote.element)schedulePreview(0);}
  const e=ctx&&!previewInvalid&&resolveElement(draft?{...draft,artworkId:'0'.repeat(64)}:ctx.quote.element,ctx.quote.end-ctx.quote.start),active=!!ctx&&elementActive(e,document.querySelector('#video').currentTime-ctx.quote.start)&&frame.classList.contains('framingPreview');overlay.hidden=!active;document.querySelector('#previewFrame').hidden=active||!frame.classList.contains('framingPreview');
  if(active){const url=preview||imageURL(e.artworkId);if(overlay.getAttribute('src')!==url)overlay.src=url;const g=elementLayout(e);viewport.style.left=g.x/1920*100+'%';viewport.style.top=g.y/1080*100+'%';viewport.style.width=g.width/1920*100+'%';viewport.style.height=g.height/1080*100+'%';}else for(const n of ['left','top','width','height'])viewport.style.removeProperty(n);
  if(key===identity())panel.querySelector('summary').textContent=activeProposal?'Voorstel · '+ELEMENT_TYPES[field('type').value]:ctx?.quote.element?'Element · '+ELEMENT_TYPES[ctx.quote.element.type]:'Element toevoegen';
 }
 const v=document.querySelector('#video');for(const event of ['timeupdate','seeked','loadedmetadata'])v.addEventListener(event,update);function frame(){update();if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(frame);}if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(frame);
 window.addEventListener('beforeunload',e=>{if(dirty||busy||autosaving){e.preventDefault();e.returnValue='';}});
 return {update,performAction,reviewToken(){return activeProposal&&key===identity()&&suggestionKey===suggestionIdentity()?proposalSet.key+':'+activeProposal.proposalId:null;},
 async settleReview(){clearTimeout(previewTimer);clearTimeout(draftTimer);if(autosaving)await autosaving;if(busy)return false;generation++;return true;},
 async flush(){clearTimeout(previewTimer);clearTimeout(draftTimer);if(autosaving)await autosaving;if(busy)return false;if(!dirty)return true;if(!activeProposal){message('Bewaar eerst je element.');return false;}return !!await performAction('draft');},
 async review(item){
  if(!this.canLeave())return false;const at=identity(),snapshot=suggestionIdentity();
  const r=await projectFetch('/api/element-proposals?'+new URLSearchParams(endpointData())),result=await r.json();
  if(!r.ok)throw Error(result.error||'Voorstel laden mislukt');
  if(at!==identity()||snapshot!==suggestionIdentity())throw Error('Het fragment is gewijzigd. Open de lijst opnieuw.');
  const proposal=result.items?.find(p=>p.proposalId===item.proposalId);
  if(result.key!==item.key||!proposal||!['pending','draft'].includes(proposal.status))throw Error('Dit voorstel is gewijzigd of al afgehandeld. Open de lijst opnieuw.');
  request++;suggestionKey=snapshot;proposalSet=result;renderSuggestions();openProposal(proposal);panel.open=true;return true;
 },
 endReview(){populate();panel.open=false;update();},
 open(){if(key!==identity()||!activeProposal)populate();panel.open=true;document.querySelector('.sourceBody').scrollTop=0;loadSuggestions();if(context()?.quote.element||activeProposal)schedulePreview(0);},canLeave(){if(!dirty&&!busy&&!autosaving)return true;message(busy||autosaving?'Wacht tot het beeld is bewaard.':'Bewaar of sluit dit element voordat je van fragment wisselt.');panel.open=true;return false;}};
}
