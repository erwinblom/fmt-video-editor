import {applyVisualCuts} from './public/transitions.mjs';
import {resolveElement} from './public/elements.mjs';
import {resolveFraming} from './public/framing.mjs';
import {sentenceCheck} from './public/sentences.mjs';
import {resolveQuote,validateRange,EDGE_FADE_MS,alignedSubtitleCues} from './public/model.mjs';
export const FPS=25;
export function exportPlan(state,catalog,{preview=false}={}){
 const mode=state.mode,m=state.modes[mode],subtitleLanguage=m.subtitleLanguage||'nl',subtitlesEnabled=m.subtitlesEnabled!==false;
 if(m.teaser.length>3)throw Error('Kies maximaal drie teaserquotes voordat je exporteert.');
 if(!m.blocks.some(b=>b.clipIds.length))throw Error('Kies minstens één interviewfragment.');
 const blocks=m.blocks.filter(b=>b.clipIds.length);
 const events=[];let frame=0;
 const add=(kind,frames,extra={})=>{const e={kind,frame,frames,start:frame/FPS,duration:frames/FPS,...extra};events.push(e);frame+=frames;return e;};
 const clip=(id,blockId)=>{const q=resolveQuote(state,catalog,id,blockId);validateRange(q.start,q.end,catalog.duration);if(!preview&&subtitlesEnabled&&!q.nl?.trim())throw Error(`Ondertiteltekst ontbreekt bij ${blockId}:${id}.`);if(!preview&&subtitlesEnabled&&(q.subtitleLanguage||'nl')!==subtitleLanguage)throw Error('De ondertiteltaal klopt niet bij '+blockId+':'+id+'. Maak of controleer de ondertitels opnieuw.');add('clip',Math.max(1,Math.round((q.end-q.start)*FPS)),{id,blockId,framing:resolveFraming(state,catalog,id,blockId),element:resolveElement(q.element,q.end-q.start),speaker:q.speaker,sourceStart:q.start,sourceEnd:q.end,nl:subtitlesEnabled?q.nl:'',subtitleCues:(()=>{try{return subtitlesEnabled?alignedSubtitleCues(q):[];}catch(e){if(!preview)throw e;}})(),sentenceBoundary:sentenceCheck(catalog,q),translationReviewed:!!q.translationReviewed&&q.translationRange?.start===q.start&&q.translationRange?.end===q.end});};
 m.teaser.forEach(id=>clip(id,'teaser'));add('intro',150,{reelStart:0});
 blocks.forEach((b,i)=>{add('topic',75,{blockId:b.id,title:b.title,number:i+1,reelStart:6+i*3});b.clipIds.forEach(id=>clip(id,b.id));});
 add('outro',150,{reelStart:6+blocks.length*3});
 const visualCuts=applyVisualCuts(events,state,catalog);
 return {version:1,visualCuts,subtitleLanguage,audio:{edgeFadeMs:EDGE_FADE_MS},mode,revision:state.revision??0,fps:FPS,width:1920,height:1080,frames:frame,duration:frame/FPS,target:state.target,events,subjects:blocks.map(b=>b.title),warnings:[...(events.some(e=>e.kind==='clip'&&e.sentenceBoundary.flagged&&!e.sentenceBoundary.exception)?['Er staan verdachte of onzekere zinsgrenzen in de selectie. Beoordeel deze in de editor.']:[]),'Concepttekst en automatisch verdeelde ondertiteltiming: controleer tegen de audio.'],rounding:'Per fragment afgerond op 25 fps; maximaal 20 ms verschil. Bronstart exact behouden; bronend wordt niet overschreden.'};
}
