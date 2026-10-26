import {initThumbnailPanel} from '/thumbnail-panel.js';
import {transitionTarget} from '/transitions.mjs';
import {initCutProposalPanel} from '/cut-proposal-panel.js';
import {initCutBatchPanel} from '/cut-batch-panel.js';
import {initTransitionPanel} from '/transition-panel.js';
import {initCaptionPreview} from '/caption-preview.js';
import {initElementPanel} from '/element-panel.js';
import {initElementReviewPanel} from '/element-review-panel.js';
import {ELEMENT_TYPES} from '/elements.mjs';
import {initGuestCrop} from '/guest-crop.js';
import {initAudioAudit} from '/audio-audit.js';
import {proposeStoryline,selectApprovedStoryline,storylineKey,storylineCore} from '/storyline.mjs';
import {quoteNavigation} from '/model.mjs';
import {subtitleLanguage,assertSubtitleResult,applySubtitleResult,subtitleBaseline,subtitlesAdjusted} from '/subtitle-state.mjs';
import {speakerSummary,SPEAKER_ROLES} from '/speakers.mjs';
import {initSpeakerPanel} from '/speaker-panel.js';
import {projectId,projectFetch,initInterviews} from '/interviews.js';
const fetch=projectFetch;
import {resolveFraming,SHOT_LABELS,guestFrameChoices} from '/framing.mjs';
import {montageSignature,videoIsCurrent,montageReview,reviewSnapshot} from '/export-status.mjs';
import {proposalDuration} from '/proposals.mjs';
import {sentenceCheck,selectionSentenceAudit} from '/sentences.mjs';
import {resolveQuote,editKey,parseTime,fineTime,validateRange,sourceText,edgeWords,wordTrim,wordBounds,EDGE_FADE_MS} from '/model.mjs';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>{s=Math.max(0,Math.round(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
let workspace=null,elementReview=null;
let displayedExport=null,auditReport=null,manualReviewSignature=null;
function automaticallyChecked(q){if(!state||!catalog)return false;const key=q.reviewKey||(selected&&selectedBlock?editKey(selectedBlock,selected):null);return montageReview(state,catalog,auditReport).items.some(x=>{if(x.key!==key||!x.audio)return false;const known=quote(x.id,x.blockId);return known.start===q.start&&known.end===q.end&&(known.nl||'')===(q.nl||'');});}
let subtitleJob=null,subtitleResult=null,subtitleBusy=false,subtitleTicket=null;
const languageLabel=code=>({nl:'Nederlands',en:'Engels',de:'Duits',fr:'Frans'}[code]||code||'brontaal');
let editingTitle=null,exportJobs=[],exportPoll=null,exportRequest=false,exportError=null;
let layer=1,playingBlock=null,sequenceLabel='Montagepreview';
let notifyCutProposals=()=>{};
let catalog,state,proposalBank,selected=null,selectedBlock=null,editorDirty=false,editorTimer=null,pendingSaves=0,saveCounter=0,history=[],collapsed=new Set(),saveQueue=Promise.resolve(),drag=null,sequence=null,playingEnd=null,playGeneration=0;
const video=$('#video'),status=$('#saved');
let reviewBusy=false;
const cutReviewActions=document.createElement('div');cutReviewActions.className='manualReviewActions';cutReviewActions.innerHTML='<button id="markCutReviewed">Knip gecontroleerd</button><p id="cutReviewStatus" class="muted" role="status"></p>';$('#preciseEditor').after(cutReviewActions);
const visualReviewActions=document.createElement('div');visualReviewActions.className='manualReviewActions';visualReviewActions.id='visualReviewActions';visualReviewActions.innerHTML='<button id="markVisualReviewed">Overgang gecontroleerd</button><p id="visualReviewStatus" class="muted" role="status"></p>';$('.sourceMedia').append(visualReviewActions);
$('#markCutReviewed').onclick=()=>confirmCurrentReview('audio').catch(()=>{});$('#markVisualReviewed').onclick=()=>confirmCurrentReview('visual').catch(()=>{});
let elementWriting=false;
const captionPreview=initCaptionPreview(()=>catalog&&state&&selected&&selectedBlock?{id:selected,blockId:selectedBlock,mode:state.mode,quote:quote(selected,selectedBlock)}:null);
const elementPanel=initElementPanel({applied:response=>{if(response.changed){history.push(clone(state));if(history.length>40)history.shift();}state=response.state;status.classList.remove('error');status.textContent='✓ Lokaal bewaard';render();},context:()=>catalog&&state&&selected&&selectedBlock?{mode:state.mode,id:selected,blockId:selectedBlock,hasVideo:catalog.hasVideo!==false,key:state.mode+':'+editKey(selectedBlock,selected),quote:quote(selected,selectedBlock)}:null,prepare:async()=>{if(!commitInspector())return false;await saveQueue;return !status.classList.contains('error');},prepareSuggestions:async()=>{if(!commitInspector())return false;await saveQueue;return !status.classList.contains('error');},onToggle:()=>renderFraming(),write:element=>{elementWriting=true;try{change(()=>{const q=quote(selected,selectedBlock),key=editKey(selectedBlock,selected);current().edits??={};current().edits[key]={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:!!q.translationReviewed,...(q.translationRange?{translationRange:q.translationRange}:{}),...current().edits[key],element};});}finally{elementWriting=false;}}});
const interviewImages=initInterviewImages({source:'/bron.mp4?project='+encodeURIComponent(projectId),play:()=>$('#preview').click()});
const guestCropPanel=initGuestCrop({getCatalog:()=>catalog,getState:()=>state,source:'/bron.mp4?project='+encodeURIComponent(projectId),beforeOpen:()=>{if(!commitInspector())return false;stop();return true;},save:async frames=>{if(!change(()=>{if(frames)state.guestFrames=frames;else delete state.guestFrames;delete state.guestCrop;}))throw Error('Bewaar eerst de fragmentwijzigingen.');await saveQueue;if(status.classList.contains('error'))throw Error('Uitsneden niet bewaard. Probeer opnieuw.');}});
const transitionPanel=initTransitionPanel({getState:()=>state,getCatalog:()=>catalog,getReview:reviewAt,confirmReview:(id,blockId,proof)=>confirmCurrentReview('visual',{id,blockId},proof),save:async(id,blockId,nextId,frames,shot)=>{
 if(!change(()=>{
  const write=(id,extra)=>{const q=quote(id,blockId),key=editKey(blockId,id);current().edits??={};current().edits[key]={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:!!q.translationReviewed,...(q.translationRange?{translationRange:q.translationRange}:{}),...current().edits[key],...extra};};
  write(id,{transition:{nextId,frames}});
  if(shot!==undefined){write(nextId,{});const e=current().edits[editKey(blockId,nextId)];if(shot==='auto')delete e.shot;else e.shot=shot;}
 }))throw Error('Bewaar eerst de fragmentwijzigingen.');
 await saveQueue;if(status.classList.contains('error'))throw Error('De overgang is niet bewaard.');
},saved:async()=>{await saveQueue;if(status.classList.contains('error'))throw Error('Bewaren is mislukt.');}});
const wordHistory=new Map();
let selectedInspectorKey=null;
let switchingQuote=false;
document.body.dataset.layer='1';
function setLayer(next){layer=next;syncSourceVisibility();document.body.dataset.layer=String(next);if(selected&&selectedBlock){const q=quote(selected,selectedBlock);renderWordEditor(q);$('#playing').textContent=fragmentLabel(q);}}
function fragmentLabel(q){return layer===3?`${speakerLabel(q)} · ${fineTime(q.start)}–${fineTime(q.end)}`:`${speakerLabel(q)} · bronfragment`;}
$('#textLayer').addEventListener('toggle',()=>{if(!$('#textLayer').open){if(!commitInspector()){$('#textLayer').open=true;return;}$('#preciseEditor').open=false;setLayer(1);}else setLayer($('#preciseEditor').open?3:2);});
$('#preciseEditor').addEventListener('toggle',()=>setLayer($('#textLayer').open?($('#preciseEditor').open?3:2):1));
$('#backToOrder').onclick=()=>$('#closeSource').click();
function syncSourceVisibility(){const visible=playingEnd!==null||$('#textLayer').open||$('#shotLayer').open,panel=$('#sourcePanel'),opening=visible&&panel.hidden;panel.hidden=!visible;panel.querySelector('.panelHead h2').textContent=$('#textLayer').open?'Monteer':'Controleer de bron';renderFraming();if(opening&&window.matchMedia('(max-width:800px)').matches)panel.scrollIntoView({behavior:'instant',block:'start'});}
function inspectorNavigation(onlyUnchecked=false){return quoteNavigation(current(),selected,selectedBlock,ref=>{const q=quote(ref.id,ref.blockId);return !(onlyUnchecked||$('#reviewFilter').checked)||!q.nl||needsTranslationReview(q);});}
function renderQuoteNavigation(){
 if(!state)return;
 const nav=inspectorNavigation();
 $('#previousQuote').disabled=switchingQuote||!nav.previous;
 $('#nextQuote').disabled=switchingQuote||!nav.next;
 $('#quotePosition').textContent=$('#reviewFilter').checked?(nav.index<0?`${nav.total} quotes nog controleren`:`Nog controleren: ${nav.index+1} van ${nav.total}`):(nav.index<0?'':`Quote ${nav.index+1} van ${nav.total}`);
}
async function switchQuote(direction,{autoplay=false,onlyUnchecked=false}={}){
 if(switchingQuote||!elementPanel.canLeave()||!commitInspector())return;
 const target=inspectorNavigation(onlyUnchecked)[direction];
 if(!target&&!onlyUnchecked)return;
 switchingQuote=true;renderQuoteNavigation();
 const body=$('.sourceBody');body.inert=true;$('#closeSource').disabled=true;
 try{
  if(status.classList.contains('error'))persist();
  await saveQueue;
  if(status.classList.contains('error')){
   $('#editSaved').textContent='Wisselen gestopt: wijzigingen zijn niet bewaard. Probeer opnieuw.';
   return;
  }
  if(!target){stop();$('#editSaved').textContent='✓ Controle bewaard. Geen volgende ongecontroleerde quote.';return;}
  stop();selected=target.id;selectedBlock=target.blockId;
  const q=quote(selected,selectedBlock);
  showTranscript(q);showInspector(selected,selectedBlock);renderFraming();
  video.currentTime=q.start;$('#playing').textContent=fragmentLabel(q);
  body.scrollTop+=$('#inspector').getBoundingClientRect().top-body.getBoundingClientRect().top;
  document.querySelectorAll('.clip').forEach(el=>el.classList.toggle('selected',el.dataset.clip===selected&&el.dataset.block===selectedBlock));
  if(autoplay)await play(selected,false,false,selectedBlock);
 }finally{switchingQuote=false;body.inert=false;$('#closeSource').disabled=false;renderQuoteNavigation();}
}
$('#previousQuote').onclick=()=>switchQuote('previous',{autoplay:true});
$('#nextQuote').onclick=()=>switchQuote('next',{autoplay:true});
$('#reviewAndNext').onclick=()=>{if(switchingQuote||!selected)return;$('#translationReviewed').checked=true;queueInspector();return switchQuote('next',{autoplay:true,onlyUnchecked:true});};
function toggleTopics(open){$('#topicPanel').hidden=!open;$('#toggleTopics').setAttribute('aria-expanded',String(open));}
$('#toggleTopics').onclick=()=>toggleTopics($('#topicPanel').hidden);
$('#closeTopics').onclick=()=>{toggleTopics(false);$('#toggleTopics').focus();};
$('#closeSource').onclick=()=>{if(!elementPanel.canLeave())return;if(!commitInspector())return;stop();$('#textLayer').open=false;$('#shotLayer').open=false;$('#preciseEditor').open=false;setLayer(1);syncSourceVisibility();};
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||e.isComposing||$('#sourcePanel').hidden||!$('#textLayer').open||document.querySelector('dialog[open]'))return;e.preventDefault();$('#closeSource').click();});
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||$('#sourcePanel').hidden||!$('#textLayer').open||document.querySelector('dialog[open]'))return;
 if(e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
 if(![' ','ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();if(e.repeat||switchingQuote)return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){switchQuote(e.key==='ArrowLeft'?'previous':'next',{autoplay:true});return;}
 if(!video.paused){video.pause();return;}
 if(playingEnd===null||video.currentTime>=playingEnd){play(selected,false,false,selectedBlock);return;}
 video.play().catch(()=>note('Gebruik afspelen in de bronvideo.'));
});
let cutAudio=null;
const current=()=>state.modes[state.mode];
const quote=(id,blockId)=>Object.defineProperty(resolveQuote(state,catalog,id,blockId),'reviewKey',{value:blockId?editKey(blockId,id):null});
const speakerLabel=q=>speakerSummary(catalog,q).label;
const speakerRole=q=>{const x=speakerSummary(catalog,q);return x.role==='mixed'?'MEERDERE SPREKERS':x.role==='unknown'?'ROL NOG KIEZEN':SPEAKER_ROLES[x.role]?.toUpperCase()||'';};
const clone=x=>structuredClone(x);
const clipDuration=(id,blockId)=>{const q=quote(id,blockId);return q.end-q.start;};
const sum=(ids,blockId)=>ids.reduce((n,id)=>n+clipDuration(id,blockId),0);
const duration=()=>proposalDuration(current(),catalog);
function note(text){$('#check').textContent=text;}
function persist(){const snapshot=clone(state),ticket=++saveCounter;pendingSaves++;status.textContent='Bewaren…';status.classList.remove('error');saveQueue=saveQueue.catch(()=>{}).then(async()=>{snapshot.revision=state.revision??0;const res=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});const data=await res.json();if(!res.ok||!data.saved)throw Error(data.error||'Bewaren mislukt');state.revision=data.state.revision;if(data.proposals||data.proposalError)notifyCutProposals(data.proposals,data.proposalError);if(ticket===saveCounter)status.classList.remove('error');}).catch(e=>{status.textContent='Niet bewaard';status.classList.add('error');note(`Bewaren mislukt: ${e.message}. Download je montageplan.`);}).finally(()=>{pendingSaves--;renderManualReview();transitionPanel.refreshReview();if(!pendingSaves&&!status.classList.contains('error'))status.textContent='✓ Lokaal bewaard';});return saveQueue;}
function change(fn){if(!elementWriting&&!elementPanel.canLeave())return false;if(!commitInspector())return false;stop();history.push(clone(state));if(history.length>40)history.shift();fn();render();persist();return true;}
function idsFor(blockId){return blockId==='teaser'?current().teaser:current().blocks.find(b=>b.id===blockId)?.clipIds;}
function shift(arr,index,d){const j=index+d;if(j<0||j>=arr.length)return;[arr[index],arr[j]]=[arr[j],arr[index]];}
$('#reviewFilter').onchange=()=>{render();renderQuoteNavigation();};
function elementBadge(ids,blockId){const types=ids.map(id=>quote(id,blockId).element?.type).filter(Boolean);if(!types.length)return '';return `<button type="button" class="elementBadge" data-action="chapterElements" data-block="${esc(blockId)}" title="Bekijk en bewerk: ${esc(types.map(type=>ELEMENT_TYPES[type]).join(', '))}" aria-label="${types.length} ${types.length===1?'element':'elementen'} bekijken en aanpassen"><span aria-hidden="true">◆</span> ${types.length} ${types.length===1?'element':'elementen'}</button>`;}
function chooseChapterElement(blockId){
 if(!elementPanel.canLeave()||!commitInspector())return;
 const items=idsFor(blockId).map((id,index)=>({id,index,e:quote(id,blockId).element})).filter(x=>x.e);
 if(!items.length)return;
 if(items.length===1){openElement(items[0].id,blockId);return;}
 const dialog=document.createElement('dialog');dialog.className='elementChooser';const heading=document.createElement('h2');heading.textContent='Welk element wil je aanpassen?';dialog.append(heading);
 for(const {id,index,e} of items){const button=document.createElement('button');button.type='button';button.textContent=`Quote ${index+1} · ${ELEMENT_TYPES[e.type]} · ${e.type==='number'?e.value+' '+e.label:e.text}`;button.onclick=()=>{dialog.close();openElement(id,blockId);};dialog.append(button);}
 const close=document.createElement('button');close.type='button';close.textContent='Sluiten';close.onclick=()=>dialog.close();dialog.append(close);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
function openElement(id,block){if(!elementPanel.canLeave()||!commitInspector())return;stop();selected=id;selectedBlock=block;$('#textLayer').open=true;showInspector(id,block);$('#preciseEditor').open=false;video.currentTime=quote(id,block).start;syncSourceVisibility();elementPanel.open();return true;}
function clipHTML(id,blockId,index){const q=quote(id,blockId),teaser=blockId==='teaser',sc=sentenceCheck(catalog,q);return `<article class="clip ${selected===id&&selectedBlock===blockId?'selected':''}" draggable="false" data-clip="${esc(id)}" data-block="${esc(blockId)}"><button class="clipThumbnail" data-frame="${q.start}" data-action="playQuote" data-block="${esc(blockId)}" data-id="${esc(id)}" aria-label="Bekijk quote ${index+1}"><span class="frameFallback">Bronbeeld laden…</span><span class="framePlay" aria-hidden="true">▶</span></button><div class="clipTop"><span data-handle aria-hidden="true" title="Quote verslepen">⠿</span><strong class="quoteNumber">Quote ${index+1}</strong>${q.element?`<button type="button" class="elementBadge" data-action="elements" data-id="${esc(id)}" data-block="${esc(blockId)}" aria-label="${esc(ELEMENT_TYPES[q.element.type])} bekijken en aanpassen"><span aria-hidden="true">◆</span> ${esc(ELEMENT_TYPES[q.element.type])}</button>`:''}<span class="speaker ${q.speaker===(catalog.primarySpeaker||'Gast')?'laurits':''}">${esc(speakerLabel(q))}</span><span>${esc(speakerRole(q))}</span><span class="quoteControls"><button data-action="playQuote" data-block="${esc(blockId)}" data-id="${esc(id)}" aria-label="Quote ${index+1} openen en afspelen in Monteer" title="Quote openen en afspelen in Monteer">▶</button>${teaser||idsFor(blockId).length>1?`<button data-action="clipUp" data-block="${esc(blockId)}" data-index="${index}" aria-label="Quote omhoog" title="Quote omhoog">↑</button><button data-action="clipDown" data-block="${esc(blockId)}" data-index="${index}" aria-label="Quote omlaag" title="Quote omlaag">↓</button><button data-action="removeClip" data-block="${esc(blockId)}" data-id="${esc(id)}" aria-label="Quote verwijderen" title="Quote verwijderen">×</button>`:''}</span><span class="time">${time(q.start)}–${time(q.end)} · ${time(clipDuration(id,blockId))}</span></div><p>${esc(q.nl||q.text)}</p>${sentenceBadge(sc,q)}<div class="quoteSubtitleStatus" aria-label="Ondertitelstatus">${q.nl?`<span class="${subtitlesAdjusted(q)?'adjusted':''}">${subtitlesAdjusted(q)?'Door jou aangepast':'Ongewijzigd'}</span><span class="${needsTranslationReview(q)?'':'reviewed'}">${automaticallyChecked(q)?'✓ Audio gecontroleerd':needsTranslationReview(q)?'Controle volgt vóór de eindmontage':'✓ Gecontroleerd met de audio'}</span>`:'<span>Nog geen ondertitels</span>'}</div><div class="clipActions">${catalog.hasVideo!==false&&transitionTarget(state,id,blockId)?`<button data-action="transition" data-block="${esc(blockId)}" data-id="${esc(id)}">Beeldovergang${q.transition?.frames&&q.transition.nextId===transitionTarget(state,id,blockId)?.nextId?` · ${q.transition.frames>0?'+':''}${q.transition.frames} frames`:''}</button>`:''}${catalog.hasVideo!==false?`<button data-action="elements" data-block="${esc(blockId)}" data-id="${esc(id)}">${q.element?`Element: ${esc(ELEMENT_TYPES[q.element.type])}`:'Element toevoegen'}</button>`:''}${state.guestFrames?`<button data-action="framing" data-block="${esc(blockId)}" data-id="${esc(id)}">Beeld: ${esc(resolveFraming(state,catalog,id,blockId).label)}${q.shot?'':' · auto'}</button>`:''}${!teaser?`<label><input type="checkbox" data-action="teaser" data-id="${esc(id)}" ${current().teaser.includes(id)?'checked':''}> Gebruik als teaser</label>`:''}</div></article>`;}
let speakerPanelReady=false;
function renderImportInfo(){
 if(catalog?.imported&&!speakerPanelReady){speakerPanelReady=true;initSpeakerPanel({getCatalog:()=>catalog,onChange:d=>{catalog.speakers=d;render();if(selected)showTranscript(quote(selected,selectedBlock));},beforeOpen:async()=>{if(!commitInspector())return false;await saveQueue;stop();return true;}});}
 if(!catalog?.imported)return;$('#importNotice').hidden=false;$('#importNotice').textContent=[catalog.details?.guest&&'Geïnterviewde: '+catalog.details.guest,catalog.details?.interviewer&&'Interviewer: '+catalog.details.interviewer,catalog.details?.topic,catalog.manualEditing?'Zelf monteren: werkfragmenten zijn geen transcript of goedgekeurde knippen. Bepaal zelf selectie en ondertitels.':catalog.analysis?'Thematisch geanalyseerd. Koppel stemmen via Sprekers; controleer zinsgrenzen. Maak en controleer ondertitels vóór export.':'Brontranscript klaar: je kunt monteren. De voorbereiding van sprekers en onderwerpen zie je hieronder.'].filter(Boolean).join(' · ');
}
function render(){
 $('#subtitlesEnabled').checked=current().subtitlesEnabled!==false;
 elementReview?.watch();
 guestCropPanel.update();
 renderStoryline();
 renderImportInfo();
 renderSubtitleControls();
 if(catalog.imported&&state.mode==='quoteverhaal'){const n=current().blocks.flatMap(b=>b.clipIds.map(id=>quote(id,b.id))).filter(q=>!speakerSummary(catalog,q).guestOnly).length;if(n)$('#importNotice').textContent+=` · Let op: ${n} bestaande fragmenten bevatten nog een andere of onbekende spreker. Ze blijven bewaard; een nieuw voorstel gebruikt je sprekerrollen.`;}
 renderExportStatus();
 renderFraming();
 renderProposalStatus();
 const sentenceRows=renderSentenceAudit();
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',b.dataset.mode===state.mode);});
 $('#storyTitle').textContent=state.mode==='quoteverhaal'?'Jouw verhaal':'Jouw gesprek';$('#target').value=state.target/60;$('#angle').value=current().selectionAngle??current().proposal?.angle??'';$('#undo').disabled=!history.length;
 const d=duration();$('#duration').textContent=`Selectie ${time(d)}`;$('#duration').classList.toggle('over',d>state.target);$('#total').textContent=`${time(d)} / ${time(state.target)}`;
 $('#interviewTitle').textContent=catalog.title;
 const query=$('#search').value.toLowerCase(),blocks=catalog.catalog[state.mode];
 $('#topics').innerHTML=blocks.filter(b=>`${b.title} ${b.clipIds.map(id=>quote(id).text).join(' ')}`.toLowerCase().includes(query)).map(b=>{const chosen=current().blocks.find(x=>x.id===b.id),visibleIds=(chosen||b).clipIds;return `<div class="topic"><input type="checkbox" id="topic-${b.id}" data-action="toggleTopic" data-id="${b.id}" ${chosen?'checked':''}><label for="topic-${b.id}"><strong>${esc((chosen||b).title)}</strong><small>${visibleIds.length} ${visibleIds.length===1?'fragment':'fragmenten'} · ${time(sum(visibleIds,b.id))}</small></label><button data-action="focusBlock" data-id="${b.id}" aria-label="Ga naar onderwerp">↗</button></div>`;}).join('');
 let out=`<section class="block teaser"><div class="blockHead"><strong>Opening · ${current().teaser.length}/3 korte quotes</strong>${elementBadge(current().teaser,'teaser')}<span>${time(sum(current().teaser,'teaser'))}${sentenceRows.some(r=>r.blockId==='teaser'&&r.flagged&&!r.exception)?` · ⚑ ${sentenceRows.filter(r=>r.blockId==='teaser'&&r.flagged&&!r.exception).length}`:''}</span><button data-action="playBlock" data-id="teaser" aria-label="Teaser beluisteren" ${current().teaser.length?'':'disabled'}>▶</button><button data-action="collapse" data-id="teaser" aria-label="Teaser openen of sluiten">${(collapsed.has('teaser')&&!$('#reviewFilter').checked)?'⌄':'⌃'}</button></div><p class="reason" ${(collapsed.has('teaser')&&!$('#reviewFilter').checked)?'hidden':''}>${current().teaser.length}/3 gekozen. Wissel de volgorde met de pijlen; vink Teaser aan bij andere quotes.</p><div class="blockBody" ${(collapsed.has('teaser')&&!$('#reviewFilter').checked)?'hidden':''}>${current().teaser.map((id,i)=>clipHTML(id,'teaser',i)).join('')}${current().teaser.length!==3?'<p class="warning">Kies precies drie quotes voor de opening.</p>':''}<select id="teaserChoice" aria-label="Teaservoorstel" ${current().teaser.length===3?'hidden':''}>${catalog.teaserCandidates.filter(id=>!current().teaser.includes(id)).map(id=>`<option value="${id}">${esc(quote(id).nl||quote(id).text)}</option>`).join('')}</select><button data-action="addTeaser" ${current().teaser.length>=3?'disabled':''}>+ Teaserquote</button></div></section><div class="fixed"><strong>FMT Handpicked-intro</strong><small>00:06 gereserveerd · in de FMT-export</small></div>`;
 current().blocks.forEach((b,i)=>{const closed=collapsed.has(b.id)&&!$('#reviewFilter').checked;out+=`<section class="block" id="block-${b.id}" draggable="false" data-topic="${b.id}"><div class="blockHead"><span data-handle title="Onderwerp verslepen">⠿</span><span class="levelLabel">Onderwerp</span>${editingTitle===b.id?`<form class="titleEditor" data-title-form="${esc(b.id)}"><input aria-label="Hoofdstuktitel" value="${esc(b.title)}" maxlength="120" aria-describedby="titleRemaining" required><small id="titleRemaining" aria-live="polite">${120-b.title.length} over</small><button type="submit" aria-label="Titel bewaren" title="Titel bewaren">✓</button><button type="button" data-action="cancelTitle" aria-label="Titelwijziging annuleren" title="Annuleren">×</button></form>`:`<strong>${esc(b.title)}</strong><button data-action="editTitle" data-id="${esc(b.id)}" aria-label="Titel aanpassen: ${esc(b.title)}" title="Titel aanpassen">✎</button>`}${elementBadge(b.clipIds,b.id)}<span>${time(sum(b.clipIds,b.id)+3)}${sentenceRows.some(r=>r.blockId===b.id&&r.flagged&&!r.exception)?` · ⚑ ${sentenceRows.filter(r=>r.blockId===b.id&&r.flagged&&!r.exception).length}`:""}</span><button data-action="playBlock" data-id="${b.id}" aria-label="Hoofdstuk beluisteren: ${esc(b.title)}" ${b.clipIds.length?'':'disabled'}>▶</button><button data-action="blockUp" data-index="${i}" aria-label="Onderwerp omhoog" title="Onderwerp omhoog">↑</button><button data-action="blockDown" data-index="${i}" aria-label="Onderwerp omlaag" title="Onderwerp omlaag">↓</button><button data-action="collapse" data-id="${b.id}" aria-label="Onderwerp openen of sluiten" aria-expanded="${!closed}" title="${closed?'Onderwerp uitklappen':'Onderwerp inklappen'}">${closed?'⌄':'⌃'}</button><button data-action="removeBlock" data-id="${b.id}" aria-label="Onderwerp verwijderen" title="Onderwerp verwijderen">×</button></div><p class="reason" ${closed?'hidden':''}>${esc(b.reason)} Onderwerpkaart: 00:03.</p>${closed?'':`<div class="blockBody">${b.clipIds.length?b.clipIds.map((id,j)=>clipHTML(id,b.id,j)).join(''):'<p class="empty">Dit blok is leeg. Herstel fragmenten vanuit Buiten de selectie.</p>'}</div>`}</section>`;});
 out+='<div class="fixed"><strong>FMT Handpicked-outro</strong><small>00:06 gereserveerd · in de FMT-export</small></div>';$('#story').innerHTML=out;
 if($('#reviewFilter').checked){
  let remaining=0;
  $('#story').querySelectorAll('.clip').forEach(el=>{const q=quote(el.dataset.clip,el.dataset.block);el.hidden=!!q.nl&&!needsTranslationReview(q);if(!el.hidden)remaining++;});
  $('#story').querySelectorAll('.block').forEach(el=>{el.hidden=![...el.querySelectorAll('.clip')].some(q=>!q.hidden);});
  $('#story').querySelectorAll('.fixed').forEach(el=>el.hidden=true);
  const message=document.createElement('p');message.className='reviewFilterSummary';message.setAttribute('role','status');message.textContent=remaining?`${remaining} quotes nog controleren`:'Alle ondertitels zijn met de audio gecontroleerd.';$('#story').prepend(message);
 }
 syncChapterPlayback();syncPlaybackPosition();
 const present=new Set(current().blocks.flatMap(b=>b.clipIds)),removed=[];
 for(const b of blocks)for(const id of b.clipIds)if(!present.has(id))removed.push({id,block:b.id,title:b.title});
 $('#removedCount').textContent=`(${removed.length})`;$('#removed').innerHTML=removed.slice(0,80).map(r=>`<button data-action="restore" data-id="${r.id}" data-block="${r.block}">+ ${esc(speakerLabel(quote(r.id)))} · ${esc(quote(r.id).text.slice(0,80))}</button>`).join('')+(removed.length>80?'<p>Zoek een onderwerp om het hele blok terug te zetten.</p>':'');
 renderFilmstrip();
 interviewImages.update(catalog.title);
 workspace?.update();renderManualReview();transitionPanel.refreshReview();
 $('#overview').innerHTML='<button data-action="top">Teaser → Intro</button>'+current().blocks.map(b=>`<button data-action="focusBlock" data-id="${b.id}">${esc(b.title)}</button>`).join('');
}
function renderFilmstrip(){
 let strip=$('#montageFilmstrip');
 if(!strip){strip=document.createElement('section');strip.id='montageFilmstrip';strip.className='montageFilmstrip';strip.setAttribute('aria-label','Visuele montagevolgorde');document.querySelector('.interviewHero').after(strip);}
 const scroll=strip.querySelector('.filmstripTrack')?.scrollLeft||0,stages=[];
 const filmSeconds=(ids,block)=>ids.reduce((n,id)=>n+Math.max(1,Math.round(clipDuration(id,block)*25)),0)/25;
 if(current().teaser.length)stages.push({title:'Opening · teasers',elements:elementBadge(current().teaser,'teaser'),seconds:filmSeconds(current().teaser,'teaser'),frame:quote(current().teaser[0],'teaser').start,action:'filmOpening'});
 stages.push({title:'Intro',seconds:6,kind:'INTRO'});
 current().blocks.forEach((b,i)=>stages.push({title:b.title,elements:elementBadge(b.clipIds,b.id),seconds:filmSeconds(b.clipIds,b.id)+3,frame:b.clipIds.length?quote(b.clipIds[0],b.id).start:null,id:b.id,action:'focusBlock',number:i+1,kind:'LEEG HOOFDSTUK'}));
 stages.push({title:'Outro',seconds:6,kind:'OUTRO'});
 let elapsed=0;
 strip.innerHTML='<div class="filmstripHeading"><h2>Je montage in beeld</h2><span>Van links naar rechts · '+time(duration())+'</span></div><p class="filmstripHint">Sleep een hoofdstuk aan het beeld, de titel of de greep. De pijlen werken ook. Klik op het beeld om te openen. Hoofdstuktijden zijn inclusief de onderwerpkaart van 3 seconden.</p><ol class="filmstripTrack" tabindex="0" aria-label="Montagevolgorde">'+stages.map(stage=>{
 const start=elapsed;elapsed+=stage.seconds;
 const picture=stage.frame!=null?`<span class="filmstripImage" data-frame="${stage.frame}"><span class="frameFallback">Bronbeeld laden…</span></span>`:`<span class="filmstripImage filmstripCard"><span>${stage.kind}</span></span>`;
 const content=picture+`<span class="filmstripTitle">${stage.number?stage.number+'. ':''}${esc(stage.title)}</span><span class="filmstripTimes"><span>Vanaf ${time(start)}</span><strong>${time(stage.seconds)}</strong></span>`;
 return `<li ${stage.id?`data-film-topic="${esc(stage.id)}"`:''}>`+(stage.id?`<div class="filmstripReorder"><button data-film-handle aria-label="Versleep ${esc(stage.title)}" title="Hoofdstuk verslepen">⠿</button><button data-action="filmShift" data-id="${esc(stage.id)}" data-delta="-1" aria-label="${esc(stage.title)} naar links" ${stage.number===1?'disabled':''}>←</button><button data-action="filmShift" data-id="${esc(stage.id)}" data-delta="1" aria-label="${esc(stage.title)} naar rechts" ${stage.number===current().blocks.length?'disabled':''}>→</button></div>`:'')+(stage.action?`<button class="filmstripItem" data-action="${stage.action}" data-id="${esc(stage.id||'')}" aria-label="Open ${esc(stage.title)}">${content}</button>`:`<div class="filmstripItem">${content}</div>` )+(stage.elements||'')+'</li>';
 }).join('')+'</ol>';
 strip.querySelector('.filmstripTrack').scrollLeft=scroll;
}
function showTranscript(q){$('#speakerTitle').textContent=`${speakerLabel(q)} · ${time(q.start)}–${time(q.end)}`;const nearby=catalog.speakers?.status==='complete'?catalog.speakers.turns.filter(t=>t.end>q.start-8&&t.start<q.end+8).map(t=>({...t,displaySpeaker:catalog.speakers.voices.find(v=>v.id===t.speakerId)?.name||catalog.speakers.voices.find(v=>v.id===t.speakerId)?.label,text:(catalog.words||[]).filter(w=>w.start<t.end&&w.end>t.start).map(w=>w.text).join('').trim()})):catalog.transcript.filter(t=>t.end>q.start-8&&t.start<q.end+8);$('#transcript').innerHTML=nearby.map(t=>`<div class="turn ${t.start<q.end&&t.end>q.start?'current':''}"><small>${time(t.start)}</small> <b>${esc(t.displaySpeaker||speakerLabel(t))}</b>${esc(t.text)}</div>`).join('');note(q.review||'Controleer betekenis en samenhang met de oorspronkelijke context.');}
function syncPlaybackPosition(){
 const active=playingEnd!==null&&selected&&selectedBlock;
 syncSourceVisibility();const panel=$('#nowPlaying');panel.hidden=!active;
 document.querySelectorAll('#story .block').forEach(b=>b.classList.toggle('isPlaying',!!active&&(b.dataset.topic===selectedBlock||b.classList.contains('teaser')&&selectedBlock==='teaser')));
 document.querySelectorAll('.clip').forEach(el=>{const on=!!active&&el.dataset.clip===selected&&el.dataset.block===selectedBlock;el.classList.toggle('isPlaying',on);if(on)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');});
 document.querySelectorAll('#overview [data-id]').forEach(b=>b.classList.toggle('isPlaying',!!active&&b.dataset.id===selectedBlock));
 if(!active){panel.textContent='';return;}
 const q=quote(selected,selectedBlock),ids=idsFor(selectedBlock)||[],index=ids.indexOf(selected),title=selectedBlock==='teaser'?'Opening · drie korte quotes':current().blocks.find(b=>b.id===selectedBlock)?.title||'Bronfragment';
 panel.innerHTML=`<small>${video.paused?'Gepauzeerd':'Nu te horen'}</small><strong>${esc(title)}</strong><span>${index>=0?`Quote ${index+1} van ${ids.length} · `:''}${esc(speakerLabel(q))}</span><p>${esc(q.nl||q.text)}</p>`;
}
function syncChapterPlayback(){document.querySelectorAll('[data-action=playBlock]').forEach(b=>{const active=b.dataset.id===playingBlock;b.textContent=active?'■':'▶';b.setAttribute('aria-pressed',active);b.setAttribute('title',active?'Stop hoofdstuk':'Beluister hoofdstuk');});}
function stop(){$('#storylineAudio').pause();playingBlock=null;syncChapterPlayback();sequence=null;playingEnd=null;playGeneration++;video.pause();syncPlaybackPosition();$('#stopPreview').hidden=true;$('#preview').textContent='▶ Speel selectie af';}
async function play(id,context=false,fromSequence=false,blockId=selectedBlock){if(!elementPanel.canLeave())return;prepareCutAudio();if(!commitInspector())return;if(!fromSequence)stop();selected=id;selectedBlock=blockId;const q=quote(id,blockId),gen=++playGeneration;playingEnd=Math.min(catalog.duration,q.end+(context?2:0));video.currentTime=Math.max(0,q.start-(context?2:0));showTranscript(q);showInspector(id,blockId);syncSourceVisibility();$('#context').disabled=false;$('#playing').textContent=`${fromSequence?sequenceLabel+' · ':''}${fragmentLabel(q)}${context?' · met context':''}`;document.querySelectorAll('.clip').forEach(el=>el.classList.toggle('selected',el.dataset.clip===id&&el.dataset.block===blockId));try{await video.play();if(gen!==playGeneration)return;syncPlaybackPosition();watch(gen);}catch(e){note('Druk op afspelen in de bronvideo om de passage te bekijken.');}}
function finishIfNeeded(gen){if(gen!==playGeneration||playingEnd===null)return true;if(video.currentTime>=playingEnd){video.pause();playingEnd=null;if(sequence?.length){const next=sequence.shift();play(next.id,false,true,next.blockId);}else{playingBlock=null;syncChapterPlayback();sequence=null;$('#stopPreview').hidden=true;syncPlaybackPosition();$('#playing').textContent='Fragment afgelopen.';$('#preview').textContent='▶ Speel selectie af';}return true;}return false;}
function watch(gen){if(finishIfNeeded(gen))return;requestAnimationFrame(()=>watch(gen));}
video.addEventListener('playing',syncPlaybackPosition);
video.addEventListener('pause',syncPlaybackPosition);
video.addEventListener('timeupdate',()=>finishIfNeeded(playGeneration));
function toggleTopic(id){const i=current().blocks.findIndex(b=>b.id===id);if(i>=0)current().blocks.splice(i,1);else current().blocks.push(clone(catalog.catalog[state.mode].find(b=>b.id===id)));}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mode){if(change(()=>{state.mode=b.dataset.mode;editingTitle=null;})){selected=null;selectedBlock=null;$('#inspector').hidden=true;$('#context').disabled=true;$('#textLayer').open=false;$('#shotLayer').open=false;syncSourceVisibility();}return;}
 const a=b.dataset.action,id=b.dataset.id,block=b.dataset.block,index=+b.dataset.index;
 if(a==='editTitle'){if(!commitInspector())return;editingTitle=id;render();const input=document.querySelector('[data-title-form] input');input.focus();input.select();return;}
 if(a==='cancelTitle'){editingTitle=null;render();return;}
 if(a==='addTeaser'){const q=$('#teaserChoice')?.value;if(q&&current().teaser.length<3)change(()=>current().teaser.push(q));return;}
 if(a==='playQuote'){if(!commitInspector())return;$('#textLayer').open=true;$('#preciseEditor').open=true;setLayer(3);play(id,false,false,block);const body=$('.sourceBody');body.scrollTop+=$('#inspector').getBoundingClientRect().top-body.getBoundingClientRect().top;return;}
 if(a==='playBlock'){if(!commitInspector())return;if(playingBlock===id){stop();return;}stop();const ids=idsFor(id);if(!ids?.length)return;playingBlock=id;sequenceLabel=id==='teaser'?'Teaser':current().blocks.find(b=>b.id===id).title;sequence=ids.map(clipId=>({id:clipId,blockId:id}));syncChapterPlayback();$('#stopPreview').hidden=false;const first=sequence.shift();$('#textLayer').open=true;$('#preciseEditor').open=true;setLayer(3);play(first.id,false,true,first.blockId);const body=$('.sourceBody');body.scrollTop+=$('#inspector').getBoundingClientRect().top-body.getBoundingClientRect().top;return;}
 if(a==='transition'){if(!elementPanel.canLeave()||!commitInspector())return;stop();transitionPanel.open(id,block);return;}
 if(a==='elements'){openElement(id,block);return;}
 if(a==='chapterElements'){chooseChapterElement(block);return;}
 if(a==='framing'){if(!elementPanel.canLeave()||!commitInspector())return;stop();selected=id;selectedBlock=block;$('#textLayer').open=false;$('#shotLayer').open=true;video.currentTime=quote(id,block).start;$('#playing').textContent=`${quote(id,block).speaker} · uitsnede bekijken`;renderFraming();syncSourceVisibility();const body=$('.sourceBody');body.scrollTop+=$('#shotLayer').getBoundingClientRect().top-body.getBoundingClientRect().top;return;}
 if(a==='edit'){if($('#shotLayer').open)$('#shotLayer').open=false;if(!commitInspector())return;$('#preciseEditor').open=true;$('#textLayer').open=true;setLayer(3);stop();selected=id;selectedBlock=block;showTranscript(quote(id,block));showInspector(id,block);const q=quote(id,block);video.currentTime=q.start;$('#playing').textContent=fragmentLabel(q);const body=$('.sourceBody');body.scrollTop+=$('#inspector').getBoundingClientRect().top-body.getBoundingClientRect().top;if(window.matchMedia('(max-width:800px)').matches)$('#sourcePanel').scrollIntoView({behavior:'instant',block:'start'});return;}
 if(a==='collapseAll'||a==='expandAll'){if(!commitInspector())return;if(a==='collapseAll'){current().blocks.forEach(b=>collapsed.add(b.id));collapsed.add('teaser');}else{current().blocks.forEach(b=>collapsed.delete(b.id));collapsed.delete('teaser');}saveView();render();$('.story').scrollTop=0;return;}
 if(a==='filmShift'){const i=current().blocks.findIndex(x=>x.id===id);if(i>=0)change(()=>shift(current().blocks,i,Number(b.dataset.delta)));return;}
 if(a==='filmOpening'){collapsed.delete('teaser');saveView();render();$('.block.teaser').scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(a==='focusBlock'){collapsed.delete(id);saveView();render();$(`#block-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(a==='top'){$('.story').scrollTop=0;return;}
 if(a==='collapse'){if(!commitInspector())return;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);saveView();render();return;}
 if(a==='blockUp'||a==='blockDown')return change(()=>shift(current().blocks,index,a==='blockUp'?-1:1));
 if(a==='clipUp'||a==='clipDown')return change(()=>shift(idsFor(block),index,a==='clipUp'?-1:1));
 if(a==='removeBlock')return change(()=>{current().blocks=current().blocks.filter(x=>x.id!==id);});
 if(a==='removeClip')return change(()=>{const ids=idsFor(block);ids.splice(ids.indexOf(id),1);});
 if(a==='restore')return change(()=>{let b=current().blocks.find(x=>x.id===block);if(!b){b=clone(catalog.catalog[state.mode].find(x=>x.id===block));b.clipIds=[];current().blocks.push(b);}if(!b.clipIds.includes(id))b.clipIds.push(id);});
});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.action==='toggleTopic')change(()=>toggleTopic(el.dataset.id));if(el.dataset.action==='teaser'){const id=el.dataset.id;if(el.checked&&current().teaser.length>=3){el.checked=false;note('Er staan al drie quotes in de teaser. Verwijder eerst één quote uit de opening.');return;}change(()=>{if(el.checked)current().teaser.push(id);else current().teaser=current().teaser.filter(x=>x!==id);});}});
let directionTimer=null,directionDirty=false;
function saveDirection(){clearTimeout(directionTimer);if(!directionDirty)return;directionDirty=false;persist();}
$('#angle').addEventListener('input',()=>{current().selectionAngle=$('#angle').value;renderStoryline();directionDirty=true;clearTimeout(directionTimer);directionTimer=setTimeout(saveDirection,400);});
$('#angle').addEventListener('change',saveDirection);
$('#target').addEventListener('change',()=>{const value=+$('#target').value*60;if(Number.isFinite(value)&&value>=30&&value<=7200)change(()=>state.target=value);else $('#target').value=state.target/60;});
$('#search').addEventListener('input',render);
$('#undo').onclick=()=>{if(!elementPanel.canLeave()||!commitInspector())return;if(history.length){stop();const revision=state.revision;state=history.pop();state.revision=revision;render();if(selected&&selectedBlock)showInspector(selected,selectedBlock);persist();}};
$('#context').onclick=()=>selected&&play(selected,true,false,selectedBlock);
$('#stopPreview').onclick=stop;
$('#preview').onclick=()=>{if(!commitInspector())return;stop();sequenceLabel='Montagepreview';const refs=[...current().teaser.map(id=>({id,blockId:'teaser'})),...current().blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id})))];if(!refs.length)return;sequence=refs;$('#stopPreview').hidden=false;$('#preview').textContent='Bronpreview speelt…';const first=sequence.shift();play(first.id,false,true,first.blockId);};
$('#download').onclick=()=>{if(!commitInspector())return;const selectedIds=new Set(Object.values(state.modes).flatMap(m=>[...m.teaser,...m.blocks.flatMap(b=>b.clipIds)]));const data={...clone(state),source:{id:projectId,title:catalog.title,details:catalog.details||{},duration:catalog.duration},quotes:Object.fromEntries([...selectedIds].map(id=>[id,{...quote(id),speakerIdentity:speakerSummary(catalog,quote(id))}])),exportedAt:new Date().toISOString()};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=''+catalog.title.replace(/[^a-z0-9-]/gi,'-')+'-montageplan.json';a.click();URL.revokeObjectURL(a.href);};
document.addEventListener('dragstart',e=>{if(e.target.closest('[data-film-topic]')){e.preventDefault();return;}const c=e.target.closest('.clip'),b=e.target.closest('[data-topic]');drag=c?{kind:'clip',id:c.dataset.clip,from:c.dataset.block}:b?{kind:'block',id:b.dataset.topic}:null;if(drag)e.dataTransfer.setData('text/plain',JSON.stringify(drag));e.stopPropagation();});
document.addEventListener('dragover',e=>{if(drag&&(e.target.closest('.clip')||e.target.closest('[data-topic]')))e.preventDefault();});
document.addEventListener('drop',e=>{if(!drag)return;e.preventDefault();const d=drag;drag=null;if(d.kind==='block'){const target=e.target.closest('[data-topic]')?.dataset.topic;if(!target||target===d.id)return;change(()=>{const arr=current().blocks,i=arr.findIndex(b=>b.id===d.id),item=arr.splice(i,1)[0],j=arr.findIndex(b=>b.id===target);arr.splice(j,0,item);});}else{const c=e.target.closest('.clip'),block=c?.dataset.block||e.target.closest('[data-topic]')?.dataset.topic;if(!block||c?.dataset.clip===d.id||((block==='teaser')!==(d.from==='teaser')))return;change(()=>{const from=idsFor(d.from),to=idsFor(block);if(from!==to&&to.includes(d.id))return;from.splice(from.indexOf(d.id),1);const i=c?to.indexOf(c.dataset.clip):-1;to.splice(i<0?to.length:i,0,d.id);relocateEdit(d.from,block,d.id);});}});
$('#makeProposal').onclick=async()=>{
 if(!commitInspector())return;saveDirection();const button=$('#makeProposal');$('#proposalError').hidden=true;button.disabled=true;const mode=state.mode;
 try{
  await saveQueue;if(status.classList.contains('error'))throw Error('Bewaar eerst je wijzigingen voordat je een voorstel maakt.');
  if(state.mode!==mode)throw Error('De montagevorm is gewijzigd. Klik opnieuw voor deze montage.');
  const target=Number($('#target').value)*60,angle=$('#angle').value.trim(),revision=state.revision,ticket=saveCounter;
  if(catalog.imported&&(!proposalBank||angle||Boolean(proposalBank.direction)!==Boolean(angle))){
   const result=await requestAnalysis(angle);
   if(state.mode!==mode||state.revision!==revision||saveCounter!==ticket||editorDirty||directionDirty||titleDraftChanged())throw Error('Je hebt tijdens de analyse verder geredigeerd. Die wijzigingen blijven behouden; klik opnieuw om een voorstel toe te passen.');
   const response=await fetch('/api/catalog');if(!response.ok)throw Error('Analyse niet bereikbaar.');catalog=await response.json();proposalBank=result.bank;
  }
  if(state.mode!==mode||state.revision!==revision||saveCounter!==ticket||editorDirty||directionDirty||titleDraftChanged())throw Error('Je wijzigingen tijdens de analyse blijven behouden. Klik opnieuw om een voorstel te maken.');
  const story=proposeStoryline(state,catalog,proposalBank);
  change(()=>{current().storyline=story;});
  await saveQueue;if(!status.classList.contains('error')){$('#storylinePanel').scrollIntoView({behavior:'smooth',block:'start'});note('Verhaallijn klaar. Pas na Akkoord maken we de fragmentselectie.');}
 }catch(e){note(e.message);$('#proposalError').textContent=e.message;$('#proposalError').hidden=false;}finally{button.disabled=false;button.textContent='Maak verhaallijn';$('#analysisProgress').hidden=true;}
};

async function requestAnalysis(angle=''){
 const label=$('#analysisProgress');label.hidden=false;label.textContent='Lokale analyse starten…';$('#makeProposal').textContent='Voorstel maken…';
 const r=await fetch('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({angle})});let job=await r.json();if(!r.ok)throw Error(job.error);const id=job.id;if(job.angle!==angle)throw Error('Er loopt al een andere analyse voor dit interview. Wacht tot die klaar is.');
 while(job.status==='running'){label.textContent=job.message;await new Promise(resolve=>setTimeout(resolve,1000));const next=await fetch('/api/analysis');if(!next.ok)throw Error('Analysestatus niet bereikbaar.');job=await next.json();if(job.id!==id)throw Error('Er is een andere analyse gestart. Je montage blijft behouden.');}
 if(job.status!=='complete')throw Error(job.message||'Analyse mislukt. Je montage blijft behouden.');return job;
}

async function watchImportPreparation(){
 if(!catalog?.imported)return;
 try{const r=await fetch('/api/interviews/'+projectId);if(!r.ok)return;const meta=await r.json();
  if(meta.backgroundProcessing){$('#analysisProgress').hidden=false;$('#analysisProgress').textContent='Op de achtergrond: '+meta.message;$('#makeProposal').disabled=true;setTimeout(watchImportPreparation,2000);return;}
  if(meta.transcriptReadyAt){const [c,b]=await Promise.all([fetch('/api/catalog').then(r=>r.json()),fetch('/api/proposal-bank').then(r=>r.ok?r.json():null)]);catalog=c;proposalBank=b;$('#analysisProgress').hidden=false;$('#analysisProgress').textContent=meta.analysisError?'Analyse niet afgerond. Je kunt blijven monteren.':'Onderwerpen gereed. Gebruik Maak verhaallijn als je ze wilt toepassen.';$('#makeProposal').disabled=false;$('#makeProposal').textContent='Maak verhaallijn';render();}
 }catch(e){$('#analysisProgress').textContent='Achtergrondstatus tijdelijk niet bereikbaar.';setTimeout(watchImportPreparation,5000);}
}
try{[catalog,state,proposalBank]=await Promise.all([fetch('/api/catalog').then(r=>r.json()),fetch('/api/state').then(r=>r.json()),fetch('/api/proposal-bank').then(r=>r.ok?r.json():null).catch(()=>null)]);$('#makeProposal').disabled=!proposalBank&&!catalog.imported;$('#makeProposal').textContent=catalog.imported&&!proposalBank?'Analyseer en maak verhaallijn':'Maak verhaallijn';if(!loadView()){current().blocks.forEach(b=>collapsed.add(b.id));collapsed.add('teaser');}render();state.revision??=0;for(const mode of Object.values(state.modes))mode.edits??={};await initInterviews({beforeLeave:async()=>{if(!elementPanel.canLeave()||!commitInspector())return false;saveDirection();await saveQueue;stop();return !status.classList.contains('error');}});$('#interviewTitle').textContent=catalog.title;video.src='/bron.mp4?project='+encodeURIComponent(projectId);if(catalog.imported){$('#importNotice').hidden=false;$('#importNotice').textContent=[catalog.details?.guest&&'Geïnterviewde: '+catalog.details.guest,catalog.details?.interviewer&&'Interviewer: '+catalog.details.interviewer,catalog.details?.topic,catalog.manualEditing?'Zelf monteren: werkfragmenten zijn geen transcript of goedgekeurde knippen. Bepaal zelf selectie en ondertitels.':catalog.analysis?'Thematisch geanalyseerd. Koppel stemmen via Sprekers; controleer zinsgrenzen. Maak en controleer ondertitels vóór export.':'Brontranscript klaar: je kunt monteren. De voorbereiding van sprekers en onderwerpen zie je hieronder.'].filter(Boolean).join(' · ');$('#exportVideo').disabled=true;$('#exportState').textContent='Nieuwe bronmontage · video-export volgt';$('#angleHelp').textContent='Je aanwijzing wordt bij Maak verhaallijn toegepast op de bronpassages.';}status.textContent='✓ Lokaal bewaard';watchImportPreparation();}catch(e){status.textContent='Laden mislukt';note(e.message);}

// Pointer-based handles also work in WebKit; native HTML drag remains a fallback.
let pointerDrag=null,suppressFilmClickUntil=0;
function moveFilmGhost(d,e){
 if(!d.ghost){
  const card=d.item.querySelector('.filmstripItem'),rect=card.getBoundingClientRect();
  d.ghost=card.cloneNode(true);d.ghost.classList.add('filmDragGhost');d.ghost.setAttribute('aria-hidden','true');d.ghost.inert=true;
  d.ghost.style.width=rect.width+'px';d.ghost.style.height=rect.height+'px';
  d.offsetX=Math.min(rect.width,Math.max(0,d.startX-rect.left));d.offsetY=Math.min(rect.height,Math.max(0,d.startY-rect.top));
  document.body.append(d.ghost);
 }
 d.ghost.style.left=(e.clientX-d.offsetX)+'px';d.ghost.style.top=(e.clientY-d.offsetY)+'px';
}
function clearFilmDrag(d){d?.ghost?.remove();d?.item.classList.remove('dragging');document.querySelectorAll('.filmDropBefore,.filmDropAfter').forEach(x=>x.classList.remove('filmDropBefore','filmDropAfter'));}

document.addEventListener('click',e=>{if(Date.now()<suppressFilmClickUntil&&e.target.closest('[data-film-topic]')){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-handle],[data-film-handle]')||e.target.closest('[data-film-topic] .filmstripItem');if(!handle||e.button!==0)return;const clip=handle.closest('[data-clip]'),block=handle.closest('[data-topic]');const film=handle.closest('[data-film-topic]'),item=film||clip||block;if(!item)return;pointerDrag={startX:e.clientX,startY:e.clientY,handle,item,moved:false,kind:film?'film':clip?'clip':'block',id:film?film.dataset.filmTopic:clip?clip.dataset.clip:block.dataset.topic,from:clip?.dataset.block};handle.setPointerCapture(e.pointerId);e.preventDefault();});
document.addEventListener('pointermove',e=>{if(!pointerDrag)return;if(Math.hypot(e.clientX-pointerDrag.startX,e.clientY-pointerDrag.startY)>6){pointerDrag.moved=true;pointerDrag.item.classList.add('dragging');}if(pointerDrag.kind==='film'&&pointerDrag.moved){moveFilmGhost(pointerDrag,e);document.querySelectorAll('.filmDropBefore,.filmDropAfter').forEach(x=>x.classList.remove('filmDropBefore','filmDropAfter'));const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-film-topic]');if(hit&&hit!==pointerDrag.item)hit.classList.add(e.clientX>hit.getBoundingClientRect().left+hit.offsetWidth/2?'filmDropAfter':'filmDropBefore');const track=pointerDrag.item.closest('.filmstripTrack'),r=track.getBoundingClientRect();if(e.clientX>r.right-45)track.scrollLeft+=18;else if(e.clientX<r.left+45)track.scrollLeft-=18;}});
document.addEventListener('pointerup',e=>{if(!pointerDrag)return;const d=pointerDrag;pointerDrag=null;clearFilmDrag(d);if(!d.moved)return;if(d.kind==='film')suppressFilmClickUntil=Date.now()+400;const hit=document.elementFromPoint(e.clientX,e.clientY);if(d.kind==='film'){const target=hit?.closest('[data-film-topic]');document.querySelectorAll('.filmDropBefore,.filmDropAfter').forEach(x=>x.classList.remove('filmDropBefore','filmDropAfter'));if(!target||target.dataset.filmTopic===d.id)return;const after=e.clientX>target.getBoundingClientRect().left+target.offsetWidth/2;change(()=>{const arr=current().blocks,i=arr.findIndex(b=>b.id===d.id);if(i<0)return;const item=arr.splice(i,1)[0],j=arr.findIndex(b=>b.id===target.dataset.filmTopic);arr.splice(j+(after?1:0),0,item);});return;}if(d.kind==='block'){const target=hit?.closest('[data-topic]')?.dataset.topic;if(!target||target===d.id)return;change(()=>{const arr=current().blocks,i=arr.findIndex(b=>b.id===d.id),item=arr.splice(i,1)[0],j=arr.findIndex(b=>b.id===target);arr.splice(j,0,item);});}else{const clip=hit?.closest('[data-clip]'),block=clip?.dataset.block||hit?.closest('[data-topic]')?.dataset.topic;if(!block||clip?.dataset.clip===d.id||((block==='teaser')!==(d.from==='teaser')))return;change(()=>{const from=idsFor(d.from),to=idsFor(block);if(from!==to&&to.includes(d.id))return;from.splice(from.indexOf(d.id),1);const i=clip?to.indexOf(clip.dataset.clip):-1;to.splice(i<0?to.length:i,0,d.id);relocateEdit(d.from,block,d.id);});}});
document.addEventListener('pointercancel',()=>{clearFilmDrag(pointerDrag);pointerDrag=null;});
function relocateEdit(from,to,id){if(from===to)return;const edits=current().edits??={};const old=editKey(from,id),next=editKey(to,id);if(Object.hasOwn(edits,old)){edits[next]=edits[old];delete edits[old];}if(selected===id&&selectedBlock===from){selectedBlock=to;showInspector(id,to);}}
function needsTranslationReview(q){if(automaticallyChecked(q))return false;return (q.subtitleLanguage||'nl')!==subtitleLanguage(current())||!q.translationReviewed||q.translationRange?.start!==q.start||q.translationRange?.end!==q.end;}
function inspectorReadout(q){renderManualReview();renderSentenceInspector(q);renderWordEditor(q);$('#editDuration').textContent=`Fragment ${fineTime(q.end-q.start)} · Bronknip ${fineTime(q.sourceStart)}–${fineTime(q.sourceEnd)}`;$('#englishQuote').textContent=sourceText(catalog,q);$('#translationHint').textContent=needsTranslationReview(q)?'Conceptondertitels. Controleer betekenis, taal en aansluiting bij de gekozen knip.':'Ondertitels door jou gecontroleerd bij deze knip.';const other=speakerSummary(catalog,q).role==='mixed'||!catalog.imported&&catalog.words?.some(w=>w.speaker!==q.speaker&&Math.min(w.end,q.end)-Math.max(w.start,q.start)>.15);let warn=q.translationNote||'';if(q.nl&&(q.subtitleLanguage||'nl')!==subtitleLanguage(current()))warn+=` Deze tekst is ${languageLabel(q.subtitleLanguage||'nl')}; gekozen ondertiteltaal: ${languageLabel(subtitleLanguage(current()))}. Maak een nieuw voorstel of vertaal de tekst.`;if(other)warn+=' Binnen deze knip spreekt ook de andere spreker. Beluister de passage.';const cut=catalog.words?.some(w=>(catalog.imported||w.speaker===q.speaker)&&((w.start+.04<q.start&&q.start<w.end-.04)||(w.start+.04<q.end&&q.end<w.end-.04)));if(cut&&!automaticallyChecked(q))warn+=' Een knipgrens lijkt midden in een woord te vallen.';$('#editNotice').textContent=warn;}
function renderSubtitleEditStatus(){const changed=subtitlesAdjusted(quote(selected,selectedBlock),$('#translation').value);$('#subtitleEditStatus').textContent=changed?'Door jou aangepast':'Ongewijzigd';$('#subtitleEditStatus').classList.toggle('adjusted',changed);}
function showInspector(id,blockId){const changed=selectedInspectorKey!==editKey(blockId,id);selectedInspectorKey=editKey(blockId,id);if(changed){document.querySelector('.sentenceDetails').open=false;$('#preciseEditor').open=false;}const q=quote(id,blockId);$('#context').disabled=false;clearTimeout(editorTimer);editorDirty=false;$('#inspector').hidden=false;$('#editIdentity').textContent=`${speakerLabel(q)} · ${blockId==='teaser'?'Teaser':'Interviewfragment'} · alleen deze plek in deze montage`;$('#trimStart').value=fineTime(q.start);$('#trimEnd').value=fineTime(q.end);$('#translation').value=q.nl||'';$('#translationReviewed').checked=!needsTranslationReview(q);$('#translationReviewed').parentElement.lastChild.textContent=' Ondertitels gecontroleerd met de audio';$('#trimError').textContent='';$('#editSaved').textContent='✓ Bewaard';inspectorReadout(q);renderQuoteNavigation();renderSubtitleEditStatus();}
function inspectorValues(){const start=parseTime($('#trimStart').value),end=parseTime($('#trimEnd').value);validateRange(start,end,catalog.duration);const nl=$('#translation').value,translationReviewed=$('#translationReviewed').checked;const q=quote(selected,selectedBlock),bounds=wordBounds({...q,start,end});return {start,end,nl,subtitleBaseline:subtitleBaseline(q),subtitleLanguage:nl!==q.nl?subtitleLanguage(current()):(q.subtitleLanguage||'nl'),translationReviewed,...(q.shot?{shot:q.shot}:{}),...(q.transition?{transition:q.transition}:{}),...(q.element?{element:q.element}:{}),wordBounds:bounds,...($('#sentenceException')?.checked?{sentenceException:{start,end}}:{}),...(translationReviewed?{translationRange:{start,end}}:{})};}
function commitInspector(){if(!editorDirty)return true;clearTimeout(editorTimer);if(!selected||!selectedBlock)return true;let edit;try{edit=inspectorValues();}catch(e){$('#trimError').textContent=e.message;$('#editSaved').textContent='Ongeldige knip: nog niet bewaard.';return false;}editorDirty=false;stop();history.push(clone(state));if(history.length>40)history.shift();current().edits??={};current().edits[editKey(selectedBlock,selected)]=edit;render();renderQuoteNavigation();const q=quote(selected,selectedBlock);inspectorReadout(q);$('#trimError').textContent='';$('#editSaved').textContent='Fragment wordt bewaard…';persist().then(()=>{$('#editSaved').textContent=status.classList.contains('error')?'Niet bewaard. Probeer opnieuw of download je montageplan via Herstellen.':'✓ Fragment lokaal bewaard';});return true;}
function queueInspector(){renderSubtitleEditStatus();editorDirty=true;renderExportStatus();$('#editSaved').textContent='Wijzigingen nog niet bewaard…';clearTimeout(editorTimer);editorTimer=setTimeout(commitInspector,650);}
for(const id of ['trimStart','trimEnd','translation','translationReviewed'])$('#'+id).addEventListener('input',e=>{if(id==='trimStart'||id==='trimEnd'||id==='translation')$('#translationReviewed').checked=false;if((id==='trimStart'||id==='trimEnd')&&$('#sentenceException'))$('#sentenceException').checked=false;queueInspector();});
$('#applyEdit').onclick=()=>{if(editorDirty)commitInspector();else $('#editSaved').textContent='✓ Geen onbewaarde wijzigingen.';};
$('#resetEdit').onclick=()=>{if(!selected||!selectedBlock)return;clearTimeout(editorTimer);editorDirty=false;change(()=>{const key=editKey(selectedBlock,selected),element=current().edits[key]?.element;if(element){const q=catalog.quotes[selected];current().edits[key]={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:false,element};}else delete current().edits[key];});showInspector(selected,selectedBlock);};
document.addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(!b||!selected||!selectedBlock)return;const action=b.dataset.edit;if(action.startsWith('listen')){prepareCutAudio();if(!commitInspector())return;stop();const q=quote(selected,selectedBlock),start=action==='listenStart'?q.start:Math.max(q.start,q.end-2),end=action==='listenEnd'?q.end:Math.min(q.end,q.start+2);video.currentTime=start;playingEnd=end;const gen=++playGeneration;$('#playing').textContent=`${action==='listenStart'?'Begin':'Einde'} beluisteren · ${fineTime(start)}–${fineTime(end)}`;video.play().then(()=>watch(gen)).catch(()=>note('Gebruik afspelen in de bronvideo.'));return;}const field=action.endsWith('Start')?'trimStart':'trimEnd',el=$('#'+field);let value=action.startsWith('position')?video.currentTime:parseTime(el.value)+Number(b.dataset.delta);if(!Number.isFinite(value))return;el.value=fineTime(Math.max(0,Math.min(catalog.duration,value)));$('#translationReviewed').checked=false;if($('#sentenceException'))$('#sentenceException').checked=false;queueInspector();commitInspector();});
window.addEventListener('beforeunload',e=>{if(editorDirty||pendingSaves>0||status.classList.contains('error')){e.preventDefault();e.returnValue='';}});

function saveView(){try{localStorage.setItem('fmtInterviewEditor.collapsed.v1.'+projectId,JSON.stringify([...collapsed]));}catch{}}
function loadView(){try{const raw=localStorage.getItem('fmtInterviewEditor.collapsed.v1.'+projectId)??(projectId==='demo'?localStorage.getItem('fmtInterviewEditor.collapsed.v1'):null);if(raw===null)return false;const ids=JSON.parse(raw);if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))return false;collapsed=new Set(ids);return true;}catch{return false;}}

// Reuse a current film; otherwise render the active, saved montage.
function ownExport(){return exportJobs.find(j=>j.mode===state.mode);}
function titleDraftChanged(){const form=document.querySelector('[data-title-form]');if(!form||editingTitle!==form.dataset.titleForm)return false;return form.querySelector('input').value.trim()!==current().blocks.find(b=>b.id===form.dataset.titleForm)?.title;}
function renderExportStatus(){
 queueMicrotask(()=>workspace?.update());
 if(!state||!catalog)return;
 if(manualReviewSignature!==montageSignature(state,catalog))$('#manualReview').checked=false;
 const job=ownExport(),running=exportJobs.find(j=>j.status==='running'),dirty=editorDirty||titleDraftChanged(),currentFilm=!dirty&&videoIsCurrent(job,state,catalog);
 const checking=auditReport?.status==='running',selectionTime=time(duration());
 const label=$('#exportState');label.classList.toggle('stale',!!exportError||dirty||!!job&&!currentFilm);
 label.textContent=exportError||(checking?'Audio wordt gecontroleerd voor je huidige selectie van '+selectionTime:running?(running.mode===state.mode?(dirty||running.signature!==videoIsCurrentSignature()?'Video wordt gemaakt · je hebt daarna wijzigingen gedaan':'Je eindmontage wordt gemaakt…'):'Er wordt een video van de andere montage gemaakt.'):dirty?'Je hebt nog onbewaarde wijzigingen.':currentFilm?'Video is actueel.':job?.status==='complete'?'Gewijzigd sinds de laatste video.':job?.status==='failed'?'Export mislukt · klik om opnieuw te proberen.':'Nog geen video van deze montage.');
 $('#exportVideo').disabled=!!running||exportRequest||checking;$('#exportVideo').textContent=checking?'Audio controleren · '+selectionTime:running?'Eindmontage wordt gemaakt · '+time(running.duration):currentFilm?'Bekijk video · '+time(job.duration):'Maak eindmontage · '+selectionTime;
 $('#exportVideo').title=currentFilm?'Open je actuele video':'Maak je eindmontage met kaarten, ondertitels en muziek. Auphonic werkt het geluid af.';
 $('#exportDrawer').hidden=false;$('#exportPanel').hidden=!job;if(!job)return;
 $('#exportPanel').hidden=false;$('#exportTitle').textContent=job.mode==='gespreksmontage'?'Eindmontage · gesprek':'Eindmontage · quoteverhaal';$('#exportMessage').textContent=job.status==='complete'&&!currentFilm?'Vorige video · niet de huidige montage':job.message;$('#exportProgress').value=job.progress;
 $('#exportMeta').textContent=`${job.status==='complete'&&!currentFilm?'Vorige video: '+time(job.duration)+' · huidige selectie: '+selectionTime:time(job.duration)} · ${currentFilm?'Deze video bevat je huidige montage.':job.status==='complete'?'Deze video bevat je laatste wijzigingen nog niet.':'De video gebruikt de selectie bij het starten.'} Ondertitels blijven een kijkversie voor redactie.`;
 const ready=job.status==='complete'&&currentFilm;if(!ready)$('#exportPlayer').pause();$('#exportProgress').hidden=job.status==='complete';if(ready&&displayedExport!==job.id){$('#exportDrawer').open=true;displayedExport=job.id;}for(const id of ['exportOpen','exportSrt','exportDownload','exportPlayer'])$('#'+id).hidden=!ready;
 if(ready){const suffix=`?project=${encodeURIComponent(projectId)}`,url=`/api/exports/${job.id}/video${suffix}`;$('#exportOpen').href=url;$('#exportDownload').href=url;$('#exportDownload').download='FMT-'+catalog.title.replace(/[^a-z0-9-]/gi,'-').slice(0,80)+'.mp4';$('#exportSrt').href=`/api/exports/${job.id}/subtitles${suffix}`;if($('#exportPlayer').getAttribute('src')!==url)$('#exportPlayer').src=url;$('#exportPlayer').poster=`/api/exports/${job.id}/poster${suffix}`;}
}
function videoIsCurrentSignature(){try{return montageSignature(state,catalog);}catch{return null;}}
function rememberExport(job){exportJobs=[job,...exportJobs.filter(j=>j.id!==job.id)].sort((a,b)=>b.createdAt-a.createdAt);renderExportStatus();}
async function pollExport(){clearTimeout(exportPoll);const job=exportJobs.find(j=>j.status==='running');if(!job)return;try{const r=await fetch(`/api/exports/${job.id}`),j=await r.json();if(!r.ok)throw Error(j.error);rememberExport(j);if(j.status==='running')exportPoll=setTimeout(pollExport,2000);}catch{$('#exportMessage').textContent='Voortgang niet bereikbaar. Herlaad om opnieuw te verbinden.';exportPoll=setTimeout(pollExport,5000);}}
const audioAudit=initAudioAudit({fetch,projectId,onStatus:j=>{const changed=auditReport?.id!==j.id||auditReport?.status!==j.status||auditReport?.revision!==j.revision;auditReport=j;if(changed&&state&&!editorDirty&&!directionDirty&&!titleDraftChanged())render();},prepare:async()=>{if(!commitInspector())throw Error('Bewaar eerst je bewerking.');await saveQueue;if(status.classList.contains('error'))throw Error('Montage nog niet bewaard.');return state.revision;},adopt:async fresh=>{if(editorDirty||directionDirty||titleDraftChanged()||pendingSaves)throw Error('Je hebt verder geredigeerd. Bewaar je werk en herlaad om de controle te openen.');state=fresh;history=[];render();if(selected&&selectedBlock)showInspector(selected,selectedBlock);},onReady:async()=>{$('#exportVideo').click();}});
$('#exportVideo').onclick=async()=>{if(!elementPanel.canLeave())return;
 const form=document.querySelector('[data-title-form]');if(form){form.requestSubmit();if(document.querySelector('[data-title-form]'))return;}
 if(!commitInspector())return;await saveQueue;if(status.classList.contains('error')){note('Bewaar eerst je montage voordat je de video maakt.');return;}
 const job=ownExport();if(videoIsCurrent(job,state,catalog)){$('#exportDrawer').open=true;$('#exportPanel').scrollIntoView({behavior:'smooth',block:'start'});return;}
 exportError=null;exportRequest=true;renderExportStatus();try{if(!catalog.synthetic&&!$('#manualReview').checked&&!await audioAudit.check())return;const r=await fetch('/api/exports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,mode:state.mode,manuallyReviewed:$('#manualReview').checked})}),j=await r.json();if(!r.ok)throw Error(j.error);rememberExport(j);$('#exportDrawer').open=true;$('#exportPanel').scrollIntoView({behavior:'smooth',block:'start'});if(j.status==='running')pollExport();}catch(e){exportError=e.message;note(e.message);}finally{exportRequest=false;renderExportStatus();}
};
try{const jobs=await fetch('/api/exports').then(r=>r.json());if(Array.isArray(jobs)){exportJobs=jobs;renderExportStatus();if(jobs.some(j=>j.status==='running')){$('#exportDrawer').open=true;pollExport();}}}catch{$('#exportState').textContent='Videostatus niet bereikbaar. Herlaad om opnieuw te controleren.';}

// This undo stack is scoped to one fragment occurrence, never another montage or teaser.
function wordHistoryKey(){return `${state.mode}:${selectedBlock}:${selected}`;}
function renderWordEditor(q){
 const words=edgeWords(catalog,q),active=words.filter(w=>!w.removed);
 $('#wordEditor').innerHTML=words.map(w=>{
  const text=w.text.trim(),edge=!w.removed&&active.length>1&&(w.index===active[0]?.index||w.index===active.at(-1)?.index);
  const label=w.removed?`${w.removed==='before'?'Zet terug vanaf':'Zet terug tot en met'}: ${text}`:`Schrap ${w.index===active[0]?.index?'beginwoord':'eindwoord'}: ${text}`;
  return w.removed||edge?`<button class="word ${w.removed?'removed':''}" data-word="${w.index}" aria-label="${esc(label)}" ${layer===3?`title="${fineTime(w.start)}–${fineTime(w.end)}"`:""}>${w.removed?`<s>${esc(text)}</s>`:esc(text)}</button>`:`<span class="word kept">${esc(text)}</span>`;
 }).join(' ');
 $('#wordFeedback').textContent=words.length?`${words.filter(w=>w.removed).length} woorden buiten de knip · ${active.length} behouden`:'Geen bruikbare woordtijdcodes voor dit fragment. Gebruik de tijdvelden hieronder.';
 $('#listenWordCut').disabled=!active.length;
 const previous=wordHistory.get(wordHistoryKey())?.at(-1);$('#undoWordCut').disabled=!previous||previous.after.start!==q.start||previous.after.end!==q.end;
}
function storeWordEdit(edit){
 history.push(clone(state));if(history.length>40)history.shift();stop();current().edits??={};
 const key=editKey(selectedBlock,selected);if(edit===null){const element=current().edits[key]?.element;if(element){const q=catalog.quotes[selected];current().edits[key]={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:false,element};}else delete current().edits[key];}else current().edits[key]={subtitleBaseline:subtitleBaseline(quote(selected,selectedBlock)),...(current().edits[key]?.transition?{transition:current().edits[key].transition}:{}),...(current().edits[key]?.shot?{shot:current().edits[key].shot}:{}),...(current().edits[key]?.element?{element:current().edits[key].element}:{}),subtitleLanguage:quote(selected,selectedBlock).subtitleLanguage||'nl',...clone(edit)};
 render();const q=quote(selected,selectedBlock);showInspector(selected,selectedBlock);showTranscript(q);video.currentTime=q.start;persist();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-word]');if(!b||!selected||!selectedBlock)return;
 if(!commitInspector())return;
 const q=quote(selected,selectedBlock);let cut;
 try{cut=wordTrim(catalog,q,Number(b.dataset.word));}catch(err){$('#wordFeedback').textContent=err.message;return;}
 const key=wordHistoryKey(),stack=wordHistory.get(key)||[];
 stack.push({before:clone(q),after:cut});if(stack.length>40)stack.shift();wordHistory.set(key,stack);
 storeWordEdit({start:q.start,end:q.end,nl:q.nl||'',translationReviewed:false,...cut});
});
$('#undoWordCut').onclick=()=>{
 if(!selected||!selectedBlock||!commitInspector())return;
 const stack=wordHistory.get(wordHistoryKey());if(!stack?.length)return;
 const item=stack.at(-1),q=quote(selected,selectedBlock);if(item.after.start!==q.start||item.after.end!==q.end)return;stack.pop();const before=item.before,reviewed=q.nl===before.nl&&!needsTranslationReview(before);storeWordEdit({start:before.start,end:before.end,nl:q.nl||'',wordBounds:wordBounds(before),translationReviewed:reviewed,...(before.sentenceException?.start===before.start&&before.sentenceException?.end===before.end?{sentenceException:before.sentenceException}:{}),...(reviewed?{translationRange:{start:before.start,end:before.end}}:{})});
};
$('#listenWordCut').onclick=()=>{if(selected&&selectedBlock)play(selected,false,false,selectedBlock);};

// Schedule edge gain on the audio clock; requestAnimationFrame only stops the picture.
// This matches the existing export's 5 ms edge fades without moving source boundaries.
function prepareCutAudio(){
 try{
  if(!cutAudio){const context=new (window.AudioContext||window.webkitAudioContext)(),gain=context.createGain(),source=context.createMediaElementSource(video);gain.gain.value=0;source.connect(gain);gain.connect(context.destination);cutAudio={context,gain};}
  cutAudio.context.resume().catch(()=>note('Klik nogmaals op Beluister de knip om het geluid te activeren.'));
 }catch{note('De browser ondersteunt de microfade-preview niet. De export behoudt de 5 ms-fades.');}
}
function scheduleCutAudio(){
 if(!cutAudio)return;const {context,gain}=cutAudio,t=context.currentTime,remaining=playingEnd===null?null:Math.max(0,(playingEnd-video.currentTime)/video.playbackRate);
 gain.gain.cancelScheduledValues(t);
 if(remaining===null){gain.gain.setValueAtTime(1,t);return;}
 const fade=Math.min(EDGE_FADE_MS/1000,remaining/2);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(1,t+fade);gain.gain.setValueAtTime(1,t+Math.max(fade,remaining-fade));gain.gain.linearRampToValueAtTime(0,t+remaining);
}
video.addEventListener('playing',scheduleCutAudio);
video.addEventListener('seeking',()=>{if(!cutAudio)return;const {context,gain}=cutAudio;gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(playingEnd===null?1:0,context.currentTime);});
video.addEventListener('seeked',()=>{if(!video.paused)scheduleCutAudio();});
video.addEventListener('pause',()=>{if(!cutAudio)return;const {context,gain}=cutAudio;gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);});

video.addEventListener('waiting',()=>{if(cutAudio&&playingEnd!==null){const {context,gain}=cutAudio;gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);}});
video.addEventListener('ratechange',()=>{if(!video.paused)scheduleCutAudio();});

function sentenceBadge(check,q){
 if(q&&automaticallyChecked(q))return '<p class="sentenceBadge good">Audio gecontroleerd</p>';
 if(!check.flagged)return '<p class="sentenceBadge good">Zinsgrenzen volgens transcript</p>';
 return `<p class="sentenceBadge ${check.exception?'intentional':'warning'}">${check.exception?'Bewust afwijkend · ':''}${[check.start,check.end].filter(e=>e.status!=='ok').map(e=>esc(e.message)).join(' · ')}</p>`;
}
function renderSentenceAudit(){
 const auditOpen=$('#sentenceAudit details')?.open??false;
 const rows=selectionSentenceAudit(state,catalog,resolveQuote).map(r=>automaticallyChecked(quote(r.id,r.blockId))?{...r,flagged:false}:r),issues=rows.filter(r=>r.flagged&&!r.exception),exceptions=rows.filter(r=>r.flagged&&r.exception),inside=issues.filter(r=>r.start.status==='inside'||r.end.status==='inside').length;
 $('#sentenceAudit').innerHTML=`<strong>Audioknippen en zinsgrenzen</strong><p>${issues.length} van ${rows.length} fragmenten vragen nog controle${exceptions.length?` · ${exceptions.length} bewust afwijkend`:''}.</p><p class="muted">${inside} mogelijk midden in een zin · ${issues.length-inside} overige onzekere grenzen.</p><p class="muted">Afgeronde audiocontroles blijven geldig. Alleen ongecontroleerde of gewijzigde knippen vragen opnieuw aandacht. Je eigen knippen blijven behouden.</p><details ${auditOpen?'open':''}><summary>Bekijk ${issues.length} aandachtspunten</summary>${issues.map(r=>`<button class="sentenceIssue" data-action="edit" data-id="${esc(r.id)}" data-block="${esc(r.blockId)}"><strong>${esc(r.title)} · ${esc(r.speaker)} · ${fineTime(r.sourceStart)}–${fineTime(r.sourceEnd)}</strong><span>${[r.start,r.end].filter(e=>typeof e==='object'&&e.status!=='ok').map(e=>esc(e.message)).join(' · ')}</span></button>`).join('')}</details>`;
 return rows;
}
function renderSentenceInspector(q){
 const check=sentenceCheck(catalog,q);
 $('#sentenceInspector').innerHTML=`<h3>Zinsgrenzen</h3>${sentenceBadge(check,q)}${['start','end'].map(side=>{
 const edge=check[side];if(edge.status==='ok')return '';
 return `<div class="sentenceEdge"><strong>${side==='start'?'Begin':'Einde'} bij “${esc(edge.word||'?')}”</strong><p class="sentenceContext">${esc(edge.sentence||'Geen zinscontext beschikbaar.')}</p>${edge.candidates.map((c,i)=>`<div><button data-sentence-side="${side}" data-sentence-choice="${i}" ${c.uncertain?'disabled':''}>${c.uncertain?'Zinsgrens onzeker · eerst beluisteren':`${side==='start'?'Begin':'Eindig'} op ${fineTime(c.value)}${c.expands?' · verlengen':' · inkorten'}`}</button><small>${esc(c.text.slice(0,150))}${c.text.length>150?'…':''}</small>${c.uncertain?'<small class="warning">Grens onzeker of tijdcodes overlappen: stel handmatig bij na beluisteren.</small>':''}</div>`).join('')}</div>`;
 }).join('')}${check.flagged?`<label class="reviewLabel"><input id="sentenceException" type="checkbox" ${check.exception?'checked':''}> Deze afwijkende knip bewust behouden</label>`:''}<p class="muted">Een voorstel wijzigt alleen de bronknip. Controleer daarna ook je ondertiteltekst. Gebruik Begin/Einde beluisteren of Speel met context.</p>`;
}
document.addEventListener('change',e=>{if(e.target.id==='sentenceException'){queueInspector();commitInspector();}});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-sentence-side]');if(!b||!selected||!selectedBlock||!commitInspector())return;
 const q=quote(selected,selectedBlock),side=b.dataset.sentenceSide,c=sentenceCheck(catalog,q)[side].candidates[Number(b.dataset.sentenceChoice)];
 if(!c||c.uncertain)return;
 const start=side==='start'?c.value:q.start,end=side==='end'?c.value:q.end;
 try{validateRange(start,end,catalog.duration);}catch(err){$('#trimError').textContent=err.message;return;}
 storeWordEdit({start,end,nl:q.nl||'',translationReviewed:false,wordBounds:wordBounds({...q,start,end})});
});

function renderProposalStatus(){
 const warning=current()?.proposal?.warning;
 $('#proposalStatus').hidden=!warning;
 $('#proposalStatus').textContent=warning||'';
}

// A title belongs to the selected block; the suggested catalog title remains available.
document.addEventListener('submit',e=>{
 const form=e.target.closest('[data-title-form]');if(!form)return;e.preventDefault();const input=form.querySelector('input'),title=input.value.trim();
 if(!title||title.length>120){input.setCustomValidity(title.length>120?'Gebruik maximaal 120 tekens.':'Vul een hoofdstuktitel in.');input.reportValidity();return;}input.setCustomValidity('');
 const b=current().blocks.find(b=>b.id===form.dataset.titleForm);if(!b)return;
 if(b.title===title){editingTitle=null;render();return;}
 change(()=>{b.title=title;editingTitle=null;});
});
document.addEventListener('input',e=>{if(e.target.matches('[data-title-form] input')){e.target.setCustomValidity('');$('#titleRemaining').textContent=`${120-e.target.value.length} over`;renderExportStatus();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.closest('[data-title-form]')){e.preventDefault();editingTitle=null;render();}});

// Fixed picture window and subtitle rail; only the source image is reframed.
function renderFraming(){
 $('#shotLayer').hidden=!state?.guestFrames&&(!!catalog?.imported||!!state?.guestCrop);
 if(catalog&&state&&selected&&selectedBlock&&(state.guestFrames||!catalog.imported&&!state.guestCrop)){const framing=resolveFraming(state,catalog,selected,selectedBlock);$('#shotLayer summary').textContent=`Beeld · ${framing.label}${framing.manual?'':' · automatisch'}`;}
 const active=!!(catalog&&state&&selected&&selectedBlock&&(quote(selected,selectedBlock).element||$('#elementPanel').open||state.guestFrames||state.guestCrop||!catalog.imported&&$('#shotLayer').open));$('#framePreview').classList.toggle('framingPreview',active);$('#previewFrame').hidden=!active;$('#captionPreview').hidden=!active;video.controls=!active;
 if(!active){video.removeAttribute('style');elementPanel.update();return;}
 let f,q;try{f=resolveFraming(state,catalog,selected,selectedBlock);q=quote(selected,selectedBlock);}catch{return;}
 const c=f.crop,v=video.style;v.clipPath=`inset(${100*c.y/f.source.height}% ${100*(f.source.width-c.x-c.width)/f.source.width}% ${100*(f.source.height-c.y-c.height)/f.source.height}% ${100*c.x/f.source.width}%)`;v.width=`${f.source.width/c.width*100}%`;v.height=`${f.source.height/c.height*100}%`;v.left=`${-c.x/c.width*100}%`;v.top=`${-c.y/c.height*100}%`;
 if(c.contain){const factor=Math.min(1504/c.width,846/c.height);v.width=`${f.source.width*factor/1504*100}%`;v.height=`${f.source.height*factor/846*100}%`;v.left=`${((1504-c.width*factor)/2-c.x*factor)/1504*100}%`;v.top=`${((846-c.height*factor)/2-c.y*factor)/846*100}%`;}
 elementPanel.update();captionPreview.update();if(state.guestCrop&&!state.guestFrames)return;for(const option of $('#shotChoice').options)option.disabled=option.value!=='auto'&&!!state.guestFrames&&!guestFrameChoices(state).includes(option.value);$('#shotChoice').value=q.shot?(!state.guestFrames||guestFrameChoices(state).includes(q.shot)?q.shot:'wide'):'auto';$('#shotChoice option[value="auto"]').textContent=`Automatisch: ${SHOT_LABELS[f.suggested]}`;$('#shotReason').textContent=f.reason;
}
$('#shotLayer').addEventListener('toggle',()=>{if($('#shotLayer').open&&!selected){$('#shotLayer').open=false;note('Open eerst een blok met de playknop.');return;}syncSourceVisibility();});
$('#shotChoice').addEventListener('change',()=>{if(!selected||!selectedBlock)return;const shot=$('#shotChoice').value;change(()=>{const key=editKey(selectedBlock,selected),q=quote(selected,selectedBlock);current().edits??={};const edit={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:!!q.translationReviewed,...(q.translationRange?{translationRange:q.translationRange}:{}),...current().edits[key]};if(shot==='auto')delete edit.shot;else edit.shot=shot;current().edits[key]=edit;});});
$('#shotPlay').onclick=()=>{if(selected&&selectedBlock)play(selected,false,false,selectedBlock);};
$('#shotPause').onclick=()=>{if(video.paused&&playingEnd!==null)video.play();else video.pause();};

// Subtitles are a reviewable text proposal; applying them never changes source cuts.
function renderSubtitleControls(){
 if(!state)return;
 $('#subtitleLanguage').value=subtitleLanguage(current());
 $('#subtitleTextLabel').textContent='Ondertitels · '+languageLabel(subtitleLanguage(current()));
 $('#makeSubtitles').disabled=subtitleBusy;
 $('#makeSubtitles').textContent=subtitleBusy?'Ondertitels maken…':'Maak ondertitels';
 if(subtitleResult){try{assertSubtitleResult(state,catalog,subtitleResult);$('#applySubtitles').disabled=editorDirty||directionDirty||titleDraftChanged()||pendingSaves>0||saveCounter!==subtitleTicket;}catch{$('#applySubtitles').disabled=true;$('#subtitleMessage').textContent='Je montage of taal is gewijzigd. Dit voorstel blijft ter inzage; maak een nieuw voorstel om toe te passen.';}}
}
$('#subtitleLanguage').onchange=()=>{const value=$('#subtitleLanguage').value;if(!['nl','en'].includes(value))return;if(!change(()=>{current().subtitleLanguage=value;}))renderSubtitleControls();if(selected&&selectedBlock)showInspector(selected,selectedBlock);};
function showSubtitleJob(job,{reveal=true}={}){
 subtitleJob=job;if(!reveal){renderSubtitleControls();return;}$('#subtitlePanel').hidden=false;
 $('#subtitleMessage').textContent=job.error||job.message||'De gekozen fragmenten worden geredigeerd en zo nodig vertaald.';
 if(job.status==='complete'){
  subtitleResult=job.result;
  $('#subtitleItems').innerHTML=(subtitleResult?.items||[]).map(item=>`<article><strong>${esc(item.key)} · ${fineTime(item.start)}–${fineTime(item.end)}</strong><p>${esc(item.text)}</p></article>`).join('');
  $('#subtitleMessage').textContent=(subtitleResult?.model?.startsWith('gpt-5.6-terra')?'Terra-voorstel klaar. ':'Voorstel klaar. ')+ 'Lees de volzinnen en controleer betekenis en nuance tegen de bron.';
  $('#applySubtitles').hidden=false;$('#subtitleReplaceNotice').hidden=false;
 }
 renderSubtitleControls();
}
$('#makeSubtitles').onclick=async()=>{
 if(subtitleBusy||!commitInspector())return;
 saveDirection();
 $('#subtitlePanel').hidden=false;$('#subtitlePanel').open=true;
 if(titleDraftChanged()){$('#subtitlePanel').hidden=false;$('#subtitleMessage').textContent='Bewaar eerst je hoofdstuktitel.';return;}
 $('#subtitlePanel').open=true;subtitleBusy=true;subtitleResult=null;$('#subtitleItems').innerHTML='';$('#applySubtitles').hidden=true;$('#subtitleReplaceNotice').hidden=true;renderSubtitleControls();
 try{
  await saveQueue;if(status.classList.contains('error'))throw Error('Bewaar eerst je montage.');
  subtitleTicket=saveCounter;
  const body={revision:state.revision,mode:state.mode,subtitleLanguage:subtitleLanguage(current())};
  const res=await fetch('/api/subtitles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let job=await res.json();if(!res.ok)throw Error(job.error||'Ondertitels maken mislukt.');
  showSubtitleJob(job);
  while(['running','queued'].includes(job.status)){
   await new Promise(resolve=>setTimeout(resolve,1500));const r=await fetch('/api/subtitles');job=await r.json();if(!r.ok)throw Error(job.error||'Status ophalen mislukt.');showSubtitleJob(job);
  }
 }catch(e){$('#subtitlePanel').hidden=false;$('#subtitlePanel').open=true;$('#subtitleMessage').textContent=e.message;}finally{subtitleBusy=false;renderSubtitleControls();}
};
$('#applySubtitles').onclick=async()=>{
 try{
  if(editorDirty||directionDirty||titleDraftChanged()||pendingSaves||saveCounter!==subtitleTicket)throw Error('Je hebt verder geredigeerd. Maak een nieuw ondertitelvoorstel.');
  assertSubtitleResult(state,catalog,subtitleResult);
  change(()=>applySubtitleResult(state,catalog,subtitleResult));
  subtitleResult=null;$('#applySubtitles').hidden=true;$('#subtitleReplaceNotice').hidden=true;
  if(selected&&selectedBlock)showInspector(selected,selectedBlock);
  await saveQueue;
  if(status.classList.contains('error')){$('#subtitleMessage').textContent='Ondertitels toegepast, maar nog niet bewaard. Download je montageplan.';}
  else{$('#subtitlePanel').hidden=true;$('#subtitlePanel').open=false;$('#subtitleItems').replaceChildren();}
 }catch(e){$('#subtitleMessage').textContent=e.message;$('#applySubtitles').disabled=true;}
};

$('#downloadSubtitles').onclick=async()=>{
 if(!commitInspector())return;saveDirection();await saveQueue;
 if(status.classList.contains('error')){note('Bewaar eerst je montage voordat je ondertitels downloadt.');return;}
 const button=$('#downloadSubtitles');button.disabled=true;
 try{const res=await fetch('/api/subtitles/download?mode='+encodeURIComponent(state.mode));if(!res.ok){const body=await res.json();throw Error(body.error||'Ondertitels downloaden mislukt.');}const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download='FMT-ondertitels-'+subtitleLanguage(current())+'.srt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){note(e.message);}finally{button.disabled=false;}
};
// Reopening a running job or its proposal does not apply any text automatically.
if(state){
 subtitleBusy=true;renderSubtitleControls();
 try{let res=await fetch('/api/subtitles');if(res.ok){let job=await res.json();if(job?.status&&!['idle','none'].includes(job.status)){
  subtitleTicket=saveCounter;showSubtitleJob(job,{reveal:false});
  while(['running','queued'].includes(job.status)){await new Promise(resolve=>setTimeout(resolve,1500));res=await fetch('/api/subtitles');if(!res.ok)throw Error('Ondertitelstatus niet bereikbaar. Herlaad om opnieuw te controleren.');job=await res.json();showSubtitleJob(job,{reveal:false});}
 }}}catch(e){note(e.message);}finally{subtitleBusy=false;renderSubtitleControls();}
}

function renderStoryline(){
 const panel=$('#storylinePanel'),story=current()?.storyline;panel.hidden=!story;if(!story)return;
 const stale=story.key!==storylineKey(state,catalog,proposalBank);
 $('#storylineState').textContent=stale?'Instellingen of bronanalyse gewijzigd. Maak een nieuw voorstel.':story.status==='approved'?'Akkoord gegeven · fragmentselectie gemaakt.':'Voorstel · je huidige montage blijft behouden tot je akkoord geeft.';
 $('#storylineCore').textContent=storylineCore(story);
 $('#storylineChapters').innerHTML=story.chapters.map((c,i)=>`<li><strong>${story.chapters.length===1?'Opening en slot':i===0?'Opening':i===story.chapters.length-1?'Slot':'Opbouw'} · ${esc(c.title)}</strong><p>${esc(c.reason)}</p><details><summary>Bronvoorbeeld · ${time(c.example.start)}–${time(c.example.end)}</summary><p>${esc(c.example.text)}</p><button data-story-listen="${i}">Beluister bronvoorbeeld</button></details>${story.status==='editing'?`<div><button data-story-up="${i}" ${i===0?'disabled':''} aria-label="Onderwerp omhoog">↑</button> <button data-story-down="${i}" ${i===story.chapters.length-1?'disabled':''} aria-label="Onderwerp omlaag">↓</button> <button data-story-remove="${i}" ${story.chapters.length===1?'disabled':''}>Laat weg</button></div>`:''}</li>`).join('');
 $('#approveStoryline').disabled=stale||story.status==='approved';
 $('#adjustStoryline').disabled=stale;
 $('#storylineAdjustment').hidden=story.status!=='editing';
}
$('#adjustStoryline').onclick=()=>change(()=>{current().storyline.status='editing';});
$('#storylineChapters').onclick=e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.storyListen!==undefined){stop();const c=current().storyline.chapters[+b.dataset.storyListen];$('#storylineAudio').hidden=false;const a=$('#storylineAudio');a.src='/bron.mp4?project='+encodeURIComponent(projectId);a.currentTime=c.example.start;a.ontimeupdate=()=>{if(a.currentTime>=c.example.end)a.pause();};a.play().catch(()=>note('Druk op afspelen om de bron te beluisteren.'));return;}
 change(()=>{const chapters=current().storyline.chapters;if(b.dataset.storyRemove!==undefined)chapters.splice(+b.dataset.storyRemove,1);else{const i=+(b.dataset.storyUp??b.dataset.storyDown),j=i+(b.dataset.storyUp!==undefined?-1:1);[chapters[i],chapters[j]]=[chapters[j],chapters[i]];}current().storyline.status='editing';current().storyline.core=storylineCore(current().storyline);});
};
$('#reviseStoryline').onclick=()=>{$('#angle').focus();$('#angle').scrollIntoView({behavior:'smooth',block:'center'});note('Pas je redactie-aanwijzing aan en kies Maak verhaallijn.');};
$('#approveStoryline').onclick=async()=>{
 if(!commitInspector())return;saveDirection();const button=$('#approveStoryline');button.disabled=true;
 try{
 await saveQueue;if(status.classList.contains('error'))throw Error('Bewaar eerst je wijzigingen.');
 const mode=state.mode,ticket=saveCounter,revision=state.revision;
 const [freshCatalog,freshBank]=await Promise.all([fetch('/api/catalog').then(r=>{if(!r.ok)throw Error('Bron niet bereikbaar.');return r.json();}),fetch('/api/proposal-bank').then(r=>{if(!r.ok)throw Error('Analyse niet bereikbaar.');return r.json();})]);
 if(state.mode!==mode||saveCounter!==ticket||state.revision!==revision||editorDirty||directionDirty||titleDraftChanged())throw Error('Je montage is gewijzigd. Controleer de verhaallijn opnieuw.');
 const story={...clone(current().storyline),status:'approved'};
 const montage=selectApprovedStoryline(state,freshCatalog,freshBank,story);
 catalog=freshCatalog;proposalBank=freshBank;montage.subtitleLanguage=subtitleLanguage(current());
 change(()=>{state.modes[mode]=montage;selected=null;selectedBlock=null;$('#inspector').hidden=true;$('#context').disabled=true;montage.blocks.forEach(b=>collapsed.delete(b.id));collapsed.delete('teaser');saveView();});
 await saveQueue;if(!status.classList.contains('error'))note('Akkoord bewaard. De fragmentselectie volgt je verhaallijn.');
 }catch(e){note(e.message);$('#proposalError').textContent=e.message;$('#proposalError').hidden=false;}finally{renderStoryline();}
};

// A separate, silent decoder supplies stills without seeking the popup player.
function initInterviewImages({source,play}) {
 const hero=document.createElement('section');
 hero.className='interviewHero';hero.setAttribute('aria-label','Interviewbeeld');
 hero.innerHTML='<button class="heroPicture" data-frame="1" aria-label="Speel selectie af"><span class="frameFallback">Interviewbeeld laden…</span><span class="framePlay" aria-hidden="true">▶</span><span class="heroCaption">Bekijk je selectie</span></button><div class="heroIdentity"><span>IN DE MONTAGE</span><h2></h2><p>Bekijk de selectie of open een fragment om te monteren.</p></div>';
 document.querySelector('header').after(hero);
 hero.querySelector('button').onclick=play;
 const decoder=document.createElement('video');decoder.muted=true;decoder.preload='metadata';decoder.playsInline=true;
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
 const cache=new Map();let queue=Promise.resolve();
 const wait=(event,action)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(new Error('timeout')),8000);
  const done=()=>finish(),bad=()=>finish(new Error('media'));
  function finish(err){clearTimeout(timer);decoder.removeEventListener(event,done);decoder.removeEventListener('error',bad);err?reject(err):resolve();}
  decoder.addEventListener(event,done,{once:true});decoder.addEventListener('error',bad,{once:true});action();
 });
 let metadata;
 function frame(at){if(!cache.has(at)){
  const task=queue.then(async()=>{
   metadata??=wait('loadedmetadata',()=>{decoder.src=source;});await metadata;
   if(!decoder.videoWidth)throw new Error('audio');
   const position=Math.max(0,Math.min(at,Math.max(0,decoder.duration-.1)));
   if(decoder.readyState<2||Math.abs(decoder.currentTime-position)>.01)await wait('seeked',()=>{decoder.currentTime=position;});
   // Preserve the original aspect ratio, including portrait and square sources.
   canvas.height=Math.round(canvas.width*decoder.videoHeight/decoder.videoWidth);
   canvas.getContext('2d').drawImage(decoder,0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/jpeg',.78);
  });queue=task.catch(()=>{});cache.set(at,task);
 }return cache.get(at);}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const el=entry.target;observer.unobserve(el);
  frame(Number(el.dataset.frame)).then(url=>{if(!el.isConnected)return;const image=new Image();image.draggable=false;image.alt='';image.src=url;el.prepend(image);el.querySelector('.frameFallback').hidden=true;}).catch(()=>{el.querySelector('.frameFallback').textContent=decoder.error?'Bronbeeld niet beschikbaar':decoder.videoWidth?'Beeld niet beschikbaar':'Audio-interview';});
 }},{rootMargin:'180px'});
 return {update(title){hero.querySelector('h2').textContent=title;observer.disconnect();document.querySelectorAll('[data-frame]').forEach(el=>{if(!el.querySelector('img'))observer.observe(el);});}};
}

window.addEventListener('blur',()=>{clearFilmDrag(pointerDrag);pointerDrag=null;});

// The workspace moves existing controls; the original editing and persistence paths remain authoritative.
function initWorkspace(api) {
 const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=s=>{s=Math.round(s);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
 let chapter=null,clip=null,navKey='',lastMode=null;
 const header=$('body>header'),oldMain=$('main'),source=$('#sourcePanel'),player=$('#exportPlayer');
 const shell=document.createElement('div');shell.id='workspace';shell.innerHTML=`<aside class="chapterNav" aria-label="Hoofdstukken"><div class="chapterHeading"><h2>Montage</h2><button id="orderOpen">Bewerken</button></div><div id="chapterList"></div><button id="settingsOpen">Interviewinstellingen</button></aside><section id="montageStage"><h2 id="workspaceTitle"></h2><p id="workspaceStatus" role="status"></p><div id="montageScreen"><div id="montageEmpty"><img src="/target.svg" alt="FMT"><h3>Bekijk je selectie</h3><p>Er is nog geen actuele eindvideo. Je kunt ieder fragment bekijken en bewerken.</p><button id="sourcePreview">Bekijk fragment</button></div></div><div id="chapterContext"><div><strong id="chapterTitle"></strong><label id="clipChoiceLabel">Fragment <select id="clipChoice" aria-label="Fragment kiezen"></select></label></div><div class="contextActions"><button id="editSelected">Knip aanpassen</button><button id="elementSelected">Element toevoegen</button></div></div><button id="precisionOpen" class="quiet">Precies instellen</button></section><aside id="workspaceReview" aria-label="Montagecontrole"><h2>Nog even bekijken</h2><p id="reviewCount"></p><div id="reviewRows"></div><button id="allChecks">Alle controles</button></aside>`;
 oldMain.before(shell);shell.append(source);
 $('#montageScreen').prepend(player);
 const playback=document.createElement('div');playback.id='workspacePlayback';playback.innerHTML='<button id="montagePlay">Afspelen</button><span id="montageTime">00:00</span><input id="montageSeek" type="range" min="0" max="100" step="0.04" value="0" aria-label="Afspeelpositie montage"><button id="montageMute" aria-pressed="false">Geluid aan</button><button id="montageFull">Volledig scherm</button>';
 $('#montageScreen').after(playback);player.controls=false;
 $('#montagePlay').onclick=async()=>{if(!player.paused){player.pause();return;}try{await player.play();}catch{$('#workspaceStatus').textContent='Afspelen lukte niet. Open de video via Video en export.';}};
 $('#montageSeek').oninput=e=>{if(Number.isFinite(player.duration))player.currentTime=Number(e.target.value);};
 $('#montageMute').onclick=()=>{player.muted=!player.muted;$('#montageMute').textContent=player.muted?'Geluid uit':'Geluid aan';$('#montageMute').setAttribute('aria-pressed',String(player.muted));};
 $('#montageFull').onclick=async()=>{try{player.controls=true;await player.requestFullscreen();}catch{player.controls=false;}};
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)player.controls=false;});
 for(const event of ['timeupdate','loadedmetadata','play','pause','ended'])player.addEventListener(event,()=>{$('#montagePlay').textContent=player.paused?'Afspelen':'Pauzeren';$('#montageTime').textContent=time(player.currentTime)+' / '+time(Number.isFinite(player.duration)?player.duration:api.snapshot().duration);$('#montageSeek').max=Number.isFinite(player.duration)?player.duration:0;$('#montageSeek').value=player.currentTime;});
 const settings=document.createElement('dialog');settings.id='workspaceSettings';settings.innerHTML='<div class="panelHead"><h2>Interviewinstellingen</h2><button id="settingsClose" aria-label="Instellingen sluiten">Sluiten</button></div><div id="settingsContent"></div>';
 document.body.append(settings);
 const settingsContent=$('#settingsContent');
 for(const node of [$('.projectTools'),$('body>nav'),$('#openSpeakers'),$('#subtitleTools'),$('#importNotice'),$('#ownStyleButton')])if(node)settingsContent.append(node);
 const picker=$('#interviewPicker');const pickerLabel=picker.closest('label');header.querySelector('h1').after(picker);header.querySelector('h1').parentElement.classList.add('brandTitle');pickerLabel.hidden=true;
 const toolbar=document.createElement('div');toolbar.className='workspaceHeaderActions';toolbar.innerHTML='<span id="workspaceDuration"></span><button id="workspaceExport" class="primary">Exporteer video</button>';
 header.append(toolbar);
 const editing=document.createElement('details');editing.id='montageTools';editing.innerHTML='<summary>Montage bewerken <span>Volgorde, teasers en fragmenten</span></summary>';shell.after(editing);editing.append(oldMain);
 const strip=$('#montageFilmstrip');if(strip){const details=document.createElement('details');details.className='visualOrder';details.innerHTML='<summary>Ordenen met beelden</summary>';editing.append(details);details.append(strip);}
 const delivery=document.createElement('details');delivery.id='deliveryTools';delivery.innerHTML='<summary>Video en export <span id="deliveryStatus"></span></summary>';editing.after(delivery);delivery.append($('#exportDrawer'));initThumbnailPanel(delivery,{fetch,projectId});
 for(const node of [$('#proposalStatus'),$('.auditLayer'),$('#storylinePanel'),$('#analysisProgress'),$('#proposalError')])if(node)editing.append(node);
 $('.interviewHero').hidden=true;$('body>footer').hidden=true;
 $('#preciseEditor').open=false;$('#preciseEditor>summary').hidden=false;$('#preciseEditor>summary').textContent='Precies instellen · tijdcodes en frames';
 const element=$('#elementPanel'),timing=element.querySelector('.elementTimes');const detail=document.createElement('details');detail.className='elementTiming';detail.innerHTML='<summary>Timing instellen</summary>';timing.before(detail);detail.append(timing);
 const timingHelp=element.querySelector('.elementButtons').previousElementSibling;if(timingHelp?.tagName==='P')detail.append(timingHelp);
 const suggestions=document.createElement('details');suggestions.className='elementSuggestions';suggestions.innerHTML='<summary>Doe voorstellen</summary>';const suggestButton=element.querySelector('[data-suggest]');suggestButton.before(suggestions);const suggestHelp=suggestButton.nextElementSibling;const suggestResults=element.querySelector('[data-suggestions]');suggestions.append(suggestButton,suggestHelp,suggestResults);
 const sourceField=element.querySelector('[name=source]').closest('label');const sourceDetail=document.createElement('details');sourceDetail.innerHTML='<summary>Bron of toeschrijving</summary>';sourceField.before(sourceDetail);sourceDetail.append(sourceField);
 element.querySelector('[data-element=preview]').hidden=true;
 const sourceToolbar=document.createElement('div');sourceToolbar.className='sourceToolbar';sourceToolbar.innerHTML='<button id="sourcePlay">Afspelen / pauzeren</button><button id="sourceTransition">Beeldovergang</button><button id="sourceElement">Element aanpassen</button><button id="sourceFraming">Uitsnede kiezen</button>';
 source.querySelector('.sourceMedia').append(sourceToolbar);
 const currentRef=()=>{const snap=api.snapshot(),b=blocks(snap).find(b=>b.id===chapter);return b&&{id:b.clipIds.includes(clip)?clip:b.clipIds[0],block:b.id};};
 function blocks(s){return [...(s.mode.teaser.length?[{id:'teaser',title:'Opening · teasers',clipIds:s.mode.teaser}]:[]),...s.mode.blocks];}
 function closeEditor(){if(source.hidden)return true;$('#closeSource').click();return source.hidden;}
 function perform(kind){const ref=currentRef();if(!ref?.id)return;player.pause();api.open(kind,ref.id,ref.block);sync();}
 function reveal(node){node.open=true;node.scrollIntoView({behavior:'smooth',block:'start'});}
 function settingsOpen(){settings.showModal();}
 $('#makeProposal').addEventListener('click',()=>{settings.close();reveal(editing);});
 $('#settingsOpen').onclick=settingsOpen;$('#settingsClose').onclick=()=>settings.close();
 $('#orderOpen').onclick=()=>reveal(editing);$('#allChecks').onclick=()=>{reveal(editing);$('.auditLayer').open=true;$('.auditLayer').scrollIntoView({behavior:'smooth',block:'center'});};
 $('#workspaceExport').onclick=()=>{if(!closeEditor())return;reveal(delivery);};
 $('#editSelected').onclick=()=>perform('edit');$('#elementSelected').onclick=()=>perform('elements');$('#sourcePreview').onclick=()=>perform('playQuote');$('#precisionOpen').onclick=()=>perform('edit');
 $('#sourcePlay').onclick=()=>{if($('#video').paused)$('#shotPlay').click();else $('#video').pause();};
 $('#sourceTransition').onclick=()=>api.open('transition',api.snapshot().selected,api.snapshot().selectedBlock);
 $('#sourceElement').onclick=()=>api.open('elements',api.snapshot().selected,api.snapshot().selectedBlock);
 $('#sourceFraming').onclick=()=>{$('#shotLayer').open=!$('#shotLayer').open;};
 $('#clipChoice').onchange=e=>{clip=e.target.value;const ref=currentRef();if(ref)seek(ref);};
 function timeline(s){let at=0;const result=[];const add=(id,block)=>{const q=api.quote(id,block),start=at;at+=Math.max(1,Math.round((q.end-q.start)*25))/25;result.push({id,block,start,end:at});};s.mode.teaser.forEach(id=>add(id,'teaser'));at+=6;for(const b of s.mode.blocks){at+=3;for(const id of b.clipIds)add(id,b.id);}return result;}
 function seek(ref){const item=timeline(api.snapshot()).find(x=>x.id===ref.id&&x.block===ref.block);if(item&&!player.hidden)player.currentTime=item.start;}
 $('#chapterList').onclick=e=>{const button=e.target.closest('[data-chapter]');if(!button)return;if(!closeEditor())return;chapter=button.dataset.chapter;clip=null;update();const ref=currentRef();if(ref)seek(ref);if(button.dataset.elements==='true')api.open('chapterElements',null,chapter);};
 player.addEventListener('timeupdate',()=>{if(player.paused)return;const item=timeline(api.snapshot()).find(x=>player.currentTime>=x.start&&player.currentTime<x.end);if(item&&(chapter!==item.block||clip!==item.id)){chapter=item.block;clip=item.id;update();}});
 player.addEventListener('play',()=>{$('#video').pause();});$('#video').addEventListener('play',()=>player.pause());
 new MutationObserver(sync).observe(source,{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(()=>{sync();$('#workspaceStatus').textContent=$('#exportState').textContent;$('#deliveryStatus').textContent=$('#exportState').textContent;}).observe($('#exportState'),{childList:true});
 new MutationObserver(sync).observe(player,{attributes:true,attributeFilter:['hidden']});
 function sync(){const active=!source.hidden;$('#montageStage').hidden=active;$('#workspaceReview').hidden=active;shell.classList.toggle('editing',active);$('#montageEmpty').hidden=!player.hidden;playback.hidden=player.hidden;source.classList.toggle('elementEditing',element.open);if(element.open&&['proof','annotatedProof'].includes(element.querySelector('[name=type]').value))element.querySelector('[name=source]').closest('details').open=true;if(active)player.pause();const s=api.snapshot();if(s.selected){$('#sourceTransition').hidden=!api.hasTransition(s.selected,s.selectedBlock);$('#sourceElement').hidden=s.catalog.hasVideo===false;} }
 element.addEventListener('toggle',sync);
 function update(){
  const s=api.snapshot();if(!s.state||!s.catalog)return;
  if(lastMode!==s.state.mode){chapter=null;clip=null;lastMode=s.state.mode;}
  const list=blocks(s);if(!list.some(b=>b.id===chapter)){chapter=list[0]?.id;clip=null;}
  const title=picker.selectedOptions[0]?.textContent||s.catalog.title;$('#workspaceTitle').textContent=title;$('#workspaceDuration').textContent=time(s.duration);$('#workspaceStatus').textContent=$('#exportState').textContent;
  const navHTML=list.map((b,i)=>{const n=b.clipIds.filter(id=>api.quote(id,b.id).element).length,seconds=b.clipIds.reduce((n,id)=>{const q=api.quote(id,b.id);return n+q.end-q.start;},b.id==='teaser'?0:3);return `<div class="chapterRow ${chapter===b.id?'active':''}"><button data-chapter="${esc(b.id)}" aria-current="${chapter===b.id?'true':'false'}"><span class="chapterNumber">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(b.title)}</strong><small>${time(seconds)} · ${b.clipIds.length} fragment${b.clipIds.length===1?'':'en'}</small></span></button>${n?`<button class="chapterElements" data-chapter="${esc(b.id)}" data-elements="true">${n} element${n===1?'':'en'}</button>`:''}</div>`;}).join('');if(navKey!==navHTML){$('#chapterList').innerHTML=navHTML;navKey=navHTML;}
  const b=list.find(b=>b.id===chapter);$('#chapterTitle').textContent=b?.title||'Nog geen fragmenten gekozen';const ids=b?.clipIds||[];if(!ids.includes(clip))clip=ids[0];
  const options=ids.map((id,i)=>`<option value="${esc(id)}" ${id===clip?'selected':''}>${i+1} · ${esc((api.quote(id,b.id).nl||api.quote(id,b.id).text||('Bron '+time(api.quote(id,b.id).start)+'–'+time(api.quote(id,b.id).end))).slice(0,65))}</option>`).join('');if($('#clipChoice').innerHTML!==options)$('#clipChoice').innerHTML=options;
  $('#clipChoiceLabel').hidden=ids.length<2;for(const id of ['editSelected','elementSelected','precisionOpen','sourcePreview'])$('#'+id).disabled=!ids.length;$('#elementSelected').hidden=s.catalog.hasVideo===false;
  if(ids.length)$('#elementSelected').textContent=api.quote(clip,b.id).element?'Element aanpassen':'Element toevoegen';
  const review=s.review,issues=review.hasBaseline?review.issues:s.issues.filter(x=>x.flagged&&!x.exception&&!review.items.find(r=>r.id===x.id&&r.blockId===x.blockId)?.audio);
  $('#workspaceReview h2').textContent=review.complete?'Controle afgerond':'Nog even bekijken';
  $('#reviewCount').textContent=review.complete?'Audio en overgangen gecontroleerd':issues.length?`${issues.length} ${review.hasBaseline?(issues.length===1?'gewijzigde plek om te controleren':'gewijzigde plekken om te controleren'):(issues.length===1?'aandachtspunt':'aandachtspunten')}`:review.audioComplete?'Audio gecontroleerd':'Nog geen afgeronde controle';
  $('#reviewRows').innerHTML=issues.slice(0,3).map((x,i)=>`<button class="reviewRow" data-review="${i}"><strong>${review.hasBaseline?esc(x.reasons[0]):'Knip controleren'}</strong><span>${esc(list.find(b=>b.id===x.blockId)?.title||'Opening')}</span><small>${review.hasBaseline?esc(x.reasons.join(' · ')):'Beluister de woorden rond deze knip'}</small></button>`).join('')+`<p class="reviewHint">${review.complete?'Je huidige fragmenten en beeldwissels komen overeen met de afgeronde controle.':review.hasBaseline?'Alleen gewijzigde plekken vragen opnieuw aandacht. De overige controles blijven geldig.':review.audioComplete?'Een afzonderlijke beoordeling van de beeldovergangen is nog niet vastgelegd.':'Brontranscriptmeldingen zijn aanwijzingen. Beoordeel op gehoor.'}</p>`;
  $('#reviewRows').onclick=e=>{const n=e.target.closest('[data-review]')?.dataset.review;if(n===undefined)return;const x=issues[Number(n)];chapter=x.blockId;clip=x.id;perform('edit');};
  sync();
 }
 document.addEventListener('click',e=>{if(e.target.closest('#toggleTopics'))reveal(editing);});
 initDetailWorkspace(api);
 update();return {update,select(id,blockId){chapter=blockId;clip=id;update();}};
}

if(catalog&&state)workspace=initWorkspace({
 snapshot:()=>({state,catalog,mode:current(),selected,selectedBlock,duration:duration(),review:montageReview(state,catalog,auditReport),issues:selectionSentenceAudit(state,catalog,resolveQuote)}),
 quote,hasTransition:(id,block)=>!!transitionTarget(state,id,block),
 open:(action,id,block)=>{
  const button=document.createElement('button');button.hidden=true;button.dataset.action=action;
  if(id)button.dataset.id=id;if(block)button.dataset.block=block;
  document.body.append(button);button.click();button.remove();
  if(action==='edit'){$('#preciseEditor').open=true;syncSourceVisibility();}
  if(['edit','elements','chapterElements','framing','playQuote'].includes(action))window.scrollTo({top:0,behavior:'instant'});
 }
});

// Shared task dialogs keep deep tools in the same visual and interaction language.
function initDetailWorkspace(api){
 const $=s=>document.querySelector(s),settings=$('#workspaceSettings'),editing=$('#montageTools'),delivery=$('#deliveryTools');
 function taskDialog(id,title,subtitle,content){
  const dialog=document.createElement('dialog');dialog.id=id;dialog.className='taskDialog';dialog.setAttribute('aria-labelledby',id+'Title');
  const head=document.createElement('div');head.className='panelHead';const heading=document.createElement('div'),eyebrow=document.createElement('p'),h=document.createElement('h2'),close=document.createElement('button');eyebrow.className='eyebrow';eyebrow.textContent=subtitle;h.id=id+'Title';h.textContent=title;close.textContent='Terug naar montage';close.onclick=()=>{const form=$('[data-title-form]');if(form&&dialog.contains(form)){form.requestSubmit();if($('[data-title-form]'))return;}dialog.close();};heading.append(eyebrow,h);head.append(heading,close);const body=document.createElement('div');body.className='taskBody';body.append(content);dialog.append(head,body);document.body.append(dialog);return dialog;
 }
 const order=taskDialog('orderDialog','Montagevolgorde','Verhaal en fragmenten',editing);editing.open=true;
 const exportDialog=taskDialog('deliveryDialog','Video exporteren','Opleveren',delivery);delivery.open=true;
 const view=document.createElement('details'),viewTitle=document.createElement('summary');view.className='orderView';viewTitle.textContent='Weergave en bronselectie';view.append(viewTitle);for(const node of document.querySelectorAll('#orderDialog [data-action=collapseAll],#orderDialog [data-action=expandAll],#orderDialog #preview'))view.append(node);$('#orderDialog .storyTools').append(view);
 const orderInfo=document.createElement('p');orderInfo.className='muted';orderInfo.textContent='Verplaats hoofdstukken met de pijlen of sleepgreep. Open Fragmenten om de inhoud aan te passen. Wijzigingen worden lokaal bewaard; Ongedaan maken zet ze terug.';editing.prepend(orderInfo);
 let orderOpened=false;
 function showOrder(){if(!orderOpened){for(const b of api.snapshot().mode.blocks)collapsed.add(b.id);collapsed.add('teaser');orderOpened=true;render();}if(!order.open)order.showModal();editing.open=true;}
 $('#orderOpen').onclick=()=>{if(!elementPanel.canLeave()||!commitInspector())return;showOrder();};
 $('#allChecks').onclick=()=>{if(!elementPanel.canLeave()||!commitInspector())return;showOrder();$('.auditLayer').open=true;$('.auditLayer').scrollIntoView({block:'start'});};
 $('#workspaceExport').onclick=()=>{if(!elementPanel.canLeave()||!commitInspector())return;const form=$('[data-title-form]');if(form){form.requestSubmit();if($('[data-title-form]'))return;}delivery.open=true;refreshDelivery();exportDialog.showModal();};
 $('#makeProposal').addEventListener('click',()=>{if(!order.open)showOrder();});
 // Keep useful buttons visible; rare alternatives open beside their owner.
 function refineOrder(){
  for(const head of document.querySelectorAll('#story .blockHead')){
   if(head.querySelector('.blockMore'))continue;
   const collapse=head.querySelector('[data-action=collapse]');if(collapse){collapse.textContent=collapse.getAttribute('aria-expanded')==='true'||collapse.textContent==='⌃'?'Fragmenten sluiten':'Fragmenten';}
   const extra=[...head.querySelectorAll(':scope>[data-action=removeBlock],:scope>[data-action=editTitle]')];if(extra.length){const more=document.createElement('details'),summary=document.createElement('summary');more.className='blockMore';summary.textContent='Meer';more.append(summary,...extra);head.append(more);}
  }
  for(const clip of document.querySelectorAll('#story .clip')){if(clip.querySelector('.clipMore'))continue;const actions=clip.querySelector('.clipActions'),controls=clip.querySelector('.quoteControls');if(!actions)continue;const more=document.createElement('details'),summary=document.createElement('summary');more.className='clipMore';summary.textContent='Fragmentopties';actions.before(more);more.append(summary,actions);for(const button of controls?.querySelectorAll('[data-action=clipUp],[data-action=clipDown],[data-action=removeClip]')||[])actions.prepend(button);}
 }
 new MutationObserver(refineOrder).observe($('#story'),{childList:true});refineOrder();
 document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(order.open&&['edit','elements','chapterElements','framing','playQuote','playBlock','filmQuote','filmBlock','filmOpening'].includes(action)){order.close();window.scrollTo({top:0,behavior:'instant'});}if(e.target.closest('#toggleTopics')&&!order.open)showOrder();});
 order.addEventListener('cancel',e=>{const form=$('[data-title-form]');if(form&&order.contains(form)){form.requestSubmit();if($('[data-title-form]'))e.preventDefault();}});
 // Settings remain a short menu, with montage/proposal settings as a named deeper layer.
 const defaults=document.createElement('details');defaults.className='detailSection';const title=document.createElement('summary');title.textContent='Montage en nieuw voorstel';defaults.append(title,$('#workspaceSettings nav'));$('#settingsContent .projectTools').after(defaults);
 const info=$('#importNotice');if(info){const source=document.createElement('details'),summary=document.createElement('summary');source.className='detailSection';summary.textContent='Bronstatus';source.append(summary,info);$('#settingsContent').append(source);}
 $('#workspaceSettings').classList.add('taskDialog');$('#settingsContent').classList.add('taskBody');
 // Return to the settings menu after a child task; never stack two visible work surfaces.
 for(const id of ['uploadDialog','manageDialog','guestCropDialog','speakerDialog']){
  const child=$('#'+id);if(!child)continue;new MutationObserver(()=>{if(child.open&&settings.open){settings.close();child.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))settings.showModal();},{once:true});}}).observe(child,{attributes:true,attributeFilter:['open']});
 }
 const summary=document.createElement('section');summary.className='deliverySummary';summary.setAttribute('aria-label','Te exporteren montage');summary.innerHTML='<h3>Deze montage</h3><dl><div><dt>Interview</dt><dd id="deliveryName"></dd></div><div><dt>Duur</dt><dd id="deliveryDuration"></dd></div><div><dt>Inhoud</dt><dd id="deliveryContent"></dd></div></dl><p>Export gebruikt je bewaarde selectie, kaarten, elementen, ondertitels en beeldwissels. Er wordt geen nieuw montagevoorstel gemaakt.</p>';
 delivery.prepend(summary);$('#exportDownload').classList.add('primaryLink');$('#exportDownload').textContent='Download MP4';$('#exportOpen').textContent='Open video in nieuw venster';
 const audit=$('#audioAudit'),checks=document.createElement('details'),checksTitle=document.createElement('summary');checks.className='detailSection';checksTitle.textContent='Audio en ondertitels controleren';checks.append(checksTitle);audit.before(checks);checks.append(audit);
 function refreshDelivery(){const s=api.snapshot(),m=s.mode,ids=[...m.teaser.map(id=>({id,block:'teaser'})),...m.blocks.flatMap(b=>b.clipIds.map(id=>({id,block:b.id})))];$('#deliveryName').textContent=$('#interviewPicker').selectedOptions[0]?.textContent||s.catalog.title;$('#deliveryDuration').textContent=$('#workspaceDuration').textContent;$('#deliveryContent').textContent=`${ids.length} fragmenten · ${m.blocks.length} hoofdstukken · ${ids.filter(x=>api.quote(x.id,x.block).element).length} elementen`;
  const ready=!$('#exportDownload').hidden;$('#exportVideo').hidden=ready;$('#exportDrawer').classList.toggle('ready',ready);if(!audit.hidden&&audit.querySelector('#auditItems')?.children.length)checks.open=true;
 }
 new MutationObserver(refreshDelivery).observe($('#exportState'),{childList:true});new MutationObserver(refreshDelivery).observe($('#exportDownload'),{attributes:true,attributeFilter:['hidden']});refreshDelivery();
 for(const dialog of document.querySelectorAll('.taskDialog'))new MutationObserver(()=>{if(dialog.open){$('#exportPlayer').pause();$('#video').pause();}}).observe(dialog,{attributes:true,attributeFilter:['open']});
}

function reviewAt(id,blockId){if(!state||!catalog)return null;return montageReview(state,catalog,auditReport).items.find(x=>x.id===id&&x.blockId===blockId);}
function renderManualReview(){
 const ref=selected&&selectedBlock&&reviewAt(selected,selectedBlock),blocked=reviewBusy||pendingSaves>0||editorDirty||auditReport?.status==='running';
 $('#markCutReviewed').disabled=blocked||!ref||ref.audio;
 $('#cutReviewStatus').textContent=ref?.audio?(ref.audioHuman?'Door jou gecontroleerd.':'Controle is geldig.'):'Bevestig na beluisteren van de knip en controle van de ondertitels.';
 $('#visualReviewActions').hidden=!ref||!!transitionTarget(state,selected,selectedBlock)||catalog.hasVideo===false;
 $('#markVisualReviewed').disabled=blocked||!ref||ref.visual;
 $('#visualReviewStatus').textContent=ref?.visual?(ref.visualHuman?'Door jou gecontroleerd.':'Controle is geldig.'):'Bevestig na bekijken van de beeldwissels van dit fragment.';
}
async function confirmCurrentReview(kind,ref={id:selected,blockId:selectedBlock},proof){
 if(reviewBusy||!ref.id||!ref.blockId)return;const mode=state.mode,message=$(kind==='audio'?'#cutReviewStatus':'#visualReviewStatus');
 if(!elementPanel.canLeave()||!commitInspector())return;
 const initial=reviewSnapshot(state,catalog).items.find(x=>x.id===ref.id&&x.blockId===ref.blockId),signature=proof?.signature??JSON.stringify(initial?.[kind]);let failure=null;
 reviewBusy=true;renderManualReview();message.textContent='Controle bewaren…';
 try{
  await saveQueue;if(status.classList.contains('error'))throw Error('Bewaar eerst de fragmentwijziging.');
  if(state.mode!==mode||proof&&proof.mode!==mode)throw Error('De montagevorm is gewijzigd. Controleer opnieuw.');if(editorDirty)throw Error('Het fragment is opnieuw gewijzigd. Bewaar en controleer opnieuw.');
  if(!auditReport?.reviewSourceToken){const r=await fetch('/api/audio-audit');if(!r.ok)throw Error('Controlestatus niet bereikbaar.');auditReport=await r.json();}
  const item=reviewSnapshot(state,catalog).items.find(x=>x.id===ref.id&&x.blockId===ref.blockId);if(!item)throw Error('Dit fragment staat niet meer in de montage.');if(signature!==JSON.stringify(item[kind]))throw Error('De knip of overgang is opnieuw gewijzigd. Controleer de huidige versie.');
  const r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...ref,mode,revision:state.revision,kind,signature,sourceToken:auditReport.reviewSourceToken})});const result=await r.json();if(!r.ok)throw Error(result.error||'Controle niet bewaard.');
  auditReport=result;render();if(selected===ref.id&&selectedBlock===ref.blockId&&!editorDirty){inspectorReadout(quote(selected,selectedBlock));$('#translationReviewed').checked=!needsTranslationReview(quote(selected,selectedBlock));renderSubtitleEditStatus();message.textContent='Door jou gecontroleerd. Lokaal bewaard.';}return result;
 }catch(e){failure=e;throw e;}finally{reviewBusy=false;renderManualReview();transitionPanel.refreshReview();if(failure)message.textContent=failure.message;}
}

// Suggestions operate on saved snapshots; applying joins the existing undo/review flow.
if(catalog&&state){
 const cutProposals=initCutProposalPanel({getState:()=>state,getCatalog:()=>catalog,stop:()=>{stop();$('#exportPlayer').pause();},prepare:async()=>{if(!elementPanel.canLeave()||!commitInspector())return false;await saveQueue;return !status.classList.contains('error');},applied:response=>{
  if(response.changed){history.push(clone(state));if(history.length>40)history.shift();}
  state=response.state;if(response.audit)auditReport=response.audit;if(response.batch)notifyCutProposals(response.batch);status.classList.remove('error');status.textContent='✓ Lokaal bewaard';render();if(selected&&selectedBlock)showInspector(selected,selectedBlock);
 }});
 const button=document.createElement('button');button.id='cutSuggestions';button.textContent='AI-voorstellen';$('#allChecks').before(button);
 button.onclick=()=>{const chapter=$('.chapterRow.active [data-chapter]')?.dataset.chapter,id=$('#clipChoice')?.value;cutProposals.open(id,chapter);};
 const sourceButton=document.createElement('button');sourceButton.id='sourceCutSuggestions';sourceButton.textContent='AI-voorstellen';$('.sourceToolbar').append(sourceButton);sourceButton.onclick=()=>cutProposals.open(selected,selectedBlock);
 const proposalNotices=[document.createElement('div'),document.createElement('div')];
 for(const container of proposalNotices){container.className='automaticCutNotice';container.hidden=true;const text=document.createElement('p');text.setAttribute('role','status');const open=document.createElement('button');open.type='button';container.append(text,open);}
 const batchProposals=initCutBatchPanel({onStatus:(data,error)=>{
  let text='',label='Bekijk voorstellen';
  if(error)text='Voorstellen niet bereikbaar: '+error;
  else if(data?.inFlight){text=data.automatic?'AI bekijkt je aangepaste knip en de geraakte beeldovergangen…':'AI maakt voorstellen voor je montage…';label='Bekijk voortgang';}
  else if(data?.totals.proposals){text=data.totals.proposals+' '+(data.totals.proposals===1?'voorstel klaar':'voorstellen klaar')+' · jij kiest wat je toepast.';label='Bekijk voorstellen ('+data.totals.proposals+')';}
  else if(data?.status==='interrupted'||data?.status==='partial'||data?.status==='stopped'){text='De voorstelronde is '+(data.status==='stopped'?'gestopt':'niet afgerond')+'. Je knip is bewaard.';label='Bekijk en hervat';}
  else if(data?.automatic&&data.status==='complete')text=data.totals.applied||data.totals.skipped?'Voorstellen afgehandeld. Je keuzes zijn bewaard.':'Geen wijziging voorgesteld bij je aangepaste knip en beeldovergangen.';
  for(const container of proposalNotices){container.hidden=!text;container.querySelector('p').textContent=text;const button=container.querySelector('button');button.textContent=label;button.hidden=!!error||!data?.inFlight&&!data?.totals.proposals&&!['interrupted','partial','stopped'].includes(data?.status);}
 },getState:()=>state,prepare:async()=>{if(!elementPanel.canLeave()||!commitInspector())return false;await saveQueue;if(status.classList.contains('error'))return false;stop();$('#exportPlayer').pause();return true;},openProposal:(task,batchId,onClose)=>cutProposals.open(task.id,task.blockId,{kind:task.kind,batchId,onClose})});
 const batchButton=document.createElement('button');batchButton.id='montageCutSuggestions';batchButton.textContent='Doe voorstellen voor hele montage';button.before(batchButton);batchButton.onclick=()=>batchProposals.open();
 batchButton.after(proposalNotices[0]);$('.sourceToolbar').after(proposalNotices[1]);for(const notice of proposalNotices)notice.querySelector('button').onclick=()=>batchProposals.open({startMissing:false});
 notifyCutProposals=(data,error)=>{if(error){for(const notice of proposalNotices){notice.hidden=false;notice.querySelector('p').textContent=error;notice.querySelector('button').hidden=true;}}else void batchProposals.watch();};void batchProposals.watch();
}

if(workspace){
 elementReview=initElementReviewPanel({
  getState:()=>state,panel:elementPanel,
  prepare:async()=>{if(!await elementPanel.flush()||!commitInspector())return false;await saveQueue;return !status.classList.contains('error');},
  open:item=>{workspace.select(item.id,item.blockId);return openElement(item.id,item.blockId);},
  close:()=>{$('#video').pause();$('#closeSource').click();}
 });
}
window.addEventListener('fmt-style-changed',()=>location.reload());

$('#manualReview').onchange=()=>{manualReviewSignature=$('#manualReview').checked?montageSignature(state,catalog):null;};

$('#subtitlesEnabled').onchange=()=>{const enabled=$('#subtitlesEnabled').checked;change(()=>{current().subtitlesEnabled=enabled;});};
