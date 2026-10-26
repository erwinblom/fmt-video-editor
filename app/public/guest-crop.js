import {DEFAULT_FRAMING,validateGuestFrames,SHOT_LABELS,guestFrame169,moveGuestFrame,zoomGuestFrame,resizeGuestFrame} from './framing.mjs';

// One interview setting, shared by both montage modes. Drafts stay in the dialog.
export function initGuestCrop({getCatalog,getState,source,beforeOpen,save}){
 const button=document.createElement('button');button.id='guestCropButton';button.textContent='Uitsneden instellen';
 document.querySelector('.projectTools').append(button);
 const dialog=document.createElement('dialog');dialog.id='guestCropDialog';
 dialog.className='taskDialog';dialog.setAttribute('aria-labelledby','cropHeading');
 dialog.innerHTML=`<div class="panelHead"><div><p class="eyebrow">Interviewbeeld</p><h2 id="cropHeading">Uitsneden instellen</h2></div><button id="cropCancel" aria-label="Uitsneden sluiten">Sluiten</button></div><div class="taskBody"><p class="muted">Ruim is verplicht. Medium en Dichtbij zijn optioneel en gelden voor alle fragmenten en de export.</p><div class="cropPresets" role="group" aria-label="Uitsneden instellen"><button data-preset="wide">Ruim · verplicht</button><button data-preset="medium">Medium instellen</button><button data-preset="close">Dichtbij instellen</button></div><div class="cropWorkspace"><section class="cropEditor"><p id="cropPresetInfo" class="muted"></p><canvas id="cropSource" tabindex="0" aria-label="Verplaatsbaar 16:9-gastkader; pijltjestoetsen verplaatsen het kader"></canvas><p class="muted">Sleep het kader of een hoek. Met de pijltjestoetsen verschuif je het kader; Shift maakt grotere stappen.</p><details class="detailSection"><summary>Ander moment in de opname</summary><label>Moment <input id="cropMoment" type="range" min="0" step="0.1" value="0" disabled><output id="cropTime"></output></label></details></section><section class="cropResult"><h3>Zo komt de gast in beeld</h3><canvas id="cropPreview" width="640" height="360" aria-label="Voorbeeld van het gastkader"></canvas><label>Inzoomen <input id="cropZoom" type="range" min="1" max="8" step="0.01" value="1" disabled><output id="cropZoomValue">1×</output></label><button id="cropRemove" hidden>Deze uitsnede weglaten</button><details class="detailSection"><summary>Herstellen</summary><p class="muted">Verwijder de gastuitsneden en gebruik het oorspronkelijke beeld.</p><button id="cropReset">Oorspronkelijk beeld herstellen</button></details></section></div></div><div class="taskActions"><p id="cropMessage" role="status"></p><button id="cropSave" class="primary" disabled>Bewaar uitsneden</button></div>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),canvas=$('#cropSource'),preview=$('#cropPreview'),moment=$('#cropMoment'),message=$('#cropMessage'),video=document.createElement('video');
 video.muted=true;video.preload='auto';video.playsInline=true;
 let draft=null,frames={},active='wide',size=null,anchor=null,ready=false,busy=false,baseline='',initialMoment=0;
 const zoom=$('#cropZoom');
 function update(){const c=getCatalog(),s=getState();button.hidden=!c||c.hasVideo===false;button.textContent=s?.guestFrames?'Uitsneden aanpassen':'Uitsneden instellen';}
 function setDraft(frame){draft=frame;frames[active]=frame;}
 function draw(){
  if(!dialog.open||!ready)return;
  for(const tab of dialog.querySelectorAll('[data-preset]')){const key=tab.dataset.preset;tab.textContent=key==='wide'?'Ruim · verplicht':SHOT_LABELS[key]+(frames[key]?'':' instellen');tab.setAttribute('aria-pressed',String(key===active));}
  $('#cropPresetInfo').textContent=SHOT_LABELS[active]+' · vast 16:9-kader';$('#cropRemove').hidden=active==='wide';
  const ctx=canvas.getContext('2d'),sx=canvas.width/size.width,sy=canvas.height/size.height;
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  if(draft){ctx.fillStyle='#0007';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(video,draft.x/size.width*video.videoWidth,draft.y/size.height*video.videoHeight,draft.width/size.width*video.videoWidth,draft.height/size.height*video.videoHeight,draft.x*sx,draft.y*sy,draft.width*sx,draft.height*sy);ctx.strokeStyle='#e10600';ctx.lineWidth=3;ctx.strokeRect(draft.x*sx,draft.y*sy,draft.width*sx,draft.height*sy);const h=12*canvas.width/canvas.getBoundingClientRect().width;ctx.fillStyle='white';for(const [x,y] of [[draft.x,draft.y],[draft.x+draft.width,draft.y],[draft.x,draft.y+draft.height],[draft.x+draft.width,draft.y+draft.height]]){ctx.fillRect(x*sx-h/2,y*sy-h/2,h,h);ctx.strokeRect(x*sx-h/2,y*sy-h/2,h,h);}}
  const p=preview.getContext('2d');p.fillStyle='#f5f3ee';p.fillRect(0,0,640,360);
  const c=draft||{x:0,y:0,...size},factor=Math.min(640/c.width,360/c.height),w=c.width*factor,h=c.height*factor;
  p.drawImage(video,c.x/size.width*video.videoWidth,c.y/size.height*video.videoHeight,c.width/size.width*video.videoWidth,c.height/size.height*video.videoHeight,(640-w)/2,(360-h)/2,w,h);
  const zoomLevel=Math.floor(Math.min(size.width/16,size.height/9))/(draft.width/16);zoom.max=Math.max(Math.min(8,Math.floor(Math.min(size.width/16,size.height/9))),zoomLevel);zoom.value=zoomLevel;$('#cropZoomValue').textContent=Number(zoom.value).toFixed(2)+'×';
  $('#cropTime').textContent=`${Math.floor(video.currentTime/60)}:${String(Math.floor(video.currentTime%60)).padStart(2,'0')}`;
  $('#cropSave').disabled=busy||!draft;
 }
 function position(e){const rect=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(size.width,Math.round((e.clientX-rect.left)/rect.width*size.width))),y:Math.max(0,Math.min(size.height,Math.round((e.clientY-rect.top)/rect.height*size.height)))};}
 function cornerAt(p){const rect=canvas.getBoundingClientRect(),radius=15*size.width/rect.width;return [['tl',draft.x,draft.y],['tr',draft.x+draft.width,draft.y],['bl',draft.x,draft.y+draft.height],['br',draft.x+draft.width,draft.y+draft.height]].find(([,x,y])=>Math.abs(p.x-x)<=radius&&Math.abs(p.y-y)<=radius)?.[0];}
 canvas.onpointerdown=e=>{if(!ready||busy||e.button!==0)return;const p=position(e),corner=cornerAt(p);if(!corner&&(p.x<draft.x||p.x>draft.x+draft.width||p.y<draft.y||p.y>draft.y+draft.height))return;anchor={point:p,frame:{...draft},corner};canvas.focus();canvas.setPointerCapture(e.pointerId);e.preventDefault();};
 canvas.onpointermove=e=>{if(!ready||busy)return;const p=position(e);if(!anchor){const c=cornerAt(p);canvas.style.cursor=c?(c==='tl'||c==='br'?'nwse-resize':'nesw-resize'):'move';return;}setDraft(anchor.corner?resizeGuestFrame(anchor.frame,size,anchor.corner,p):moveGuestFrame(anchor.frame,size,p.x-anchor.point.x,p.y-anchor.point.y));draw();};
 canvas.onpointerup=canvas.onpointercancel=()=>{anchor=null;};
 canvas.onkeydown=e=>{if(!ready||busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?10:1;setDraft(moveGuestFrame(draft,size,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));draw();};
 zoom.oninput=()=>{if(!ready||busy)return;setDraft(zoomGuestFrame(draft,size,Number(zoom.value)));draw();};
 video.onloadeddata=()=>{if(!dialog.open)return;ready=true;moment.disabled=false;zoom.disabled=false;moment.max=Math.max(0,video.duration-.1);if(initialMoment){video.currentTime=Math.min(initialMoment,Number(moment.max));moment.value=video.currentTime;initialMoment=0;}draw();};
 video.onseeked=()=>{if(ready)draw();};video.onerror=()=>{message.textContent='Het bronbeeld kon niet geladen worden. Sluit dit venster en probeer opnieuw.';};
 moment.oninput=()=>{if(ready)video.currentTime=Number(moment.value);};
 button.onclick=()=>{if(!beforeOpen())return;size=(getCatalog().framing||DEFAULT_FRAMING).source;frames=getState().guestFrames?structuredClone(getState().guestFrames):{wide:guestFrame169(size,getState().guestCrop)};active='wide';draft=frames.wide;baseline=JSON.stringify(frames);const st=getState(),first=st.modes[st.mode].blocks.find(b=>b.clipIds.length)?.clipIds[0];initialMoment=getCatalog().quotes[first]?.start||0;ready=false;anchor=null;discard.hidden=true;message.textContent=getState().guestCrop&&getState().guestCrop.width*9!==getState().guestCrop.height*16?'Je bestaande gastkader is het vertrekpunt voor Ruim. Je eerdere uitsnede blijft behouden tot je bewaart.':'';canvas.width=960;canvas.height=Math.round(960*size.height/size.width);$('#cropSave').disabled=true;$('#cropReset').disabled=!(getState().guestCrop||getState().guestFrames);moment.disabled=true;zoom.disabled=true;zoom.max=Math.min(8,Math.floor(Math.min(size.width/16,size.height/9)));moment.value=0;dialog.showModal();video.src=source;video.load();};
 for(const tab of dialog.querySelectorAll('[data-preset]'))tab.onclick=()=>{if(!ready||busy)return;active=tab.dataset.preset;frames[active]??={...frames.wide};draft=frames[active];anchor=null;draw();};
 $('#cropRemove').onclick=()=>{if(active==='wide'||busy)return;delete frames[active];active='wide';draft=frames.wide;draw();};
 const discard=document.createElement('button');discard.textContent='Wijzigingen verwerpen';discard.hidden=true;$('#cropSave').before(discard);discard.onclick=()=>{if(!busy)dialog.close();};const canClose=()=>{if(busy)return false;if(JSON.stringify(frames)===baseline)return true;message.textContent='Nog niet bewaard. Bewaar je uitsneden of verwerp de wijzigingen.';discard.hidden=false;return false;};$('#cropCancel').onclick=()=>{if(canClose())dialog.close();};
 async function commit(presets){
  if(busy)return;try{if(presets)validateGuestFrames(presets,getCatalog());busy=true;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);await save(presets);baseline=JSON.stringify(frames);dialog.close();}catch(e){message.textContent=e.message;}finally{busy=false;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);$('#cropReset').disabled=!(getState().guestCrop||getState().guestFrames);draw();update();}
 }
 $('#cropSave').onclick=()=>{if(draft&&ready)commit(structuredClone(frames));};$('#cropReset').onclick=()=>commit(null);
 dialog.addEventListener('cancel',e=>{if(!canClose())e.preventDefault();});dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();ready=false;});
 return {update};
}
