import {resolveQuote} from './model.mjs';
export const SHOT_LABELS={wide:'Ruim',medium:'Medium',close:'Dichtbij'};
// Synthetic default profile; imported recordings use their own source dimensions.
export const DEFAULT_FRAMING={source:{width:1920,height:1080},image:{x:208,y:32,width:1504,height:846},caption:{x:200,y:916,width:1520,height:128},presets:Object.fromEntries(['Gast','Interviewer'].map(speaker=>[speaker,{wide:{x:0,y:0,width:1920,height:1080},medium:{x:160,y:90,width:1600,height:900},close:{x:320,y:180,width:1280,height:720}}]))};
export function validateGuestCrop(crop,catalog){
 if(crop===undefined)return;
 const source=(catalog.framing||DEFAULT_FRAMING).source;
 if(catalog.hasVideo===false||!crop||Array.isArray(crop)||typeof crop!=='object'||Object.keys(crop).sort().join(',')!=='height,width,x,y'||!['x','y','width','height'].every(k=>Number.isInteger(crop[k]))||crop.x<0||crop.y<0||crop.width<2||crop.height<2||crop.x+crop.width>source.width||crop.y+crop.height>source.height)throw Error('Kies een geldig gastkader binnen het bronbeeld.');
}
export function validateGuestFrames(frames,catalog){
 if(frames===undefined)return;
 if(!frames||typeof frames!=='object'||Array.isArray(frames)||!Object.hasOwn(frames,'wide')||Object.keys(frames).some(k=>!Object.hasOwn(SHOT_LABELS,k)))throw Error('Stel eerst Ruim in. Medium en Dichtbij zijn optioneel.');
 for(const frame of Object.values(frames)){validateGuestCrop(frame,catalog);if(!frame||frame.width*9!==frame.height*16)throw Error('Gebruik voor iedere uitsnede een 16:9-kader.');}
}
export function guestFrameChoices(state){return state.guestFrames?Object.keys(SHOT_LABELS).filter(k=>state.guestFrames[k]):[];}
export function resolveFraming(state,catalog,id,blockId){
 const q=resolveQuote(state,catalog,id,blockId),m=state.modes[state.mode],profile=catalog.framing||DEFAULT_FRAMING;
 if(state.guestFrames!==undefined){
  validateGuestFrames(state.guestFrames,catalog);
  const available=guestFrameChoices(state),positions=[...m.teaser.map(id=>({id,blockId:'teaser'})),...m.blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id})))];
  const index=Math.max(0,positions.findIndex(c=>c.id===id&&c.blockId===blockId)),suggested=available[index%available.length];
  const requested=q.shot,shot=requested&&available.includes(requested)?requested:requested?'wide':suggested;
  return {fullFrame:false,shot,suggested,manual:!!requested,label:SHOT_LABELS[shot],available,crop:{...state.guestFrames[shot],contain:true},source:profile.source,image:profile.image||DEFAULT_FRAMING.image,caption:profile.caption||DEFAULT_FRAMING.caption,reason:requested&&!available.includes(requested)?`${SHOT_LABELS[requested]} is niet ingesteld; Ruim wordt gebruikt.`:requested?'Jouw keuze voor deze fragmentplek.':'Automatische afwisseling tussen je ingestelde uitsneden, op volgorde van de fragmenten.'};
 }
 if(state.guestCrop!==undefined){validateGuestCrop(state.guestCrop,catalog);return {fullFrame:false,shot:'guest',label:'Gastkader',crop:{...state.guestCrop,contain:true},source:profile.source,image:profile.image||DEFAULT_FRAMING.image,caption:profile.caption||DEFAULT_FRAMING.caption};}
 const positions=blockId==='teaser'?m.teaser.map(id=>({id,blockId:'teaser'})):m.blocks.flatMap(b=>b.clipIds.map(id=>({id,blockId:b.id})));
 const index=Math.max(0,positions.findIndex(c=>c.id===id&&c.blockId===blockId));
 const suggested=q.speaker==='Interviewer'?'wide':blockId==='teaser'?['close','medium','wide'][index%3]:['wide','medium','close'][index%3];
 const shot=q.shot||suggested;if(!Object.hasOwn(SHOT_LABELS,shot))throw Error('Onbekende uitsnede.');
 const crop=profile.presets[q.speaker]?.[shot]||(catalog.imported?{x:0,y:0,width:profile.source.width,height:profile.source.height,contain:true}:null);if(!crop)throw Error('Deze spreker heeft nog geen ingestelde uitsnedes.');
 return {fullFrame:!!catalog.imported,shot,suggested,manual:!!q.shot,label:SHOT_LABELS[shot],crop,source:profile.source,image:profile.image,caption:profile.caption,reason:q.speaker==='Interviewer'?'Voorstel ruim: de interviewer staat in een klein bronvenster. Medium en dichtbij worden minder scherp.':blockId==='teaser'?'Een korte reeks van drie uitsnedes voor de teaser.':'Rustige afwisseling van ruim, medium en dichtbij, op de volgorde van de fragmenten. Geen automatische gezichtstracking.'};
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function guestFrame169(source,previous){
 const max=Math.floor(Math.min(source.width/16,source.height/9));
 if(max<1)throw Error('Dit bronbeeld is te klein voor een 16:9-kader.');
 const units=previous?clamp(Math.floor(Math.min(previous.width/16,previous.height/9)),1,max):max;
 const width=units*16,height=units*9,cx=previous?previous.x+previous.width/2:source.width/2,cy=previous?previous.y+previous.height/2:source.height/2;
 return {x:clamp(Math.round(cx-width/2),0,source.width-width),y:clamp(Math.round(cy-height/2),0,source.height-height),width,height};
}
export function moveGuestFrame(frame,source,dx,dy){return {...frame,x:clamp(Math.round(frame.x+dx),0,source.width-frame.width),y:clamp(Math.round(frame.y+dy),0,source.height-frame.height)};}
export function zoomGuestFrame(frame,source,zoom){
 const max=Math.floor(Math.min(source.width/16,source.height/9)),units=clamp(Math.round(max/clamp(zoom,1,max)),1,max);
 return guestFrame169(source,{x:frame.x+frame.width/2-units*8,y:frame.y+frame.height/2-units*4.5,width:units*16,height:units*9});
}
export function resizeGuestFrame(frame,source,corner,point){
 const right=corner.endsWith('r'),bottom=corner.startsWith('b'),ax=right?frame.x:frame.x+frame.width,ay=bottom?frame.y:frame.y+frame.height;
 const dx=(point.x-ax)*(right?1:-1),dy=(point.y-ay)*(bottom?1:-1);
 const max=Math.floor(Math.min((right?source.width-ax:ax)/16,(bottom?source.height-ay:ay)/9));
 const units=clamp(Math.round((dx*16+dy*9)/(16*16+9*9)),1,max),width=16*units,height=9*units;
 return {x:right?ax:ax-width,y:bottom?ay:ay-height,width,height};
}
