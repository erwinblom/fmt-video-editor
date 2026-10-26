import {validateTransition} from './transitions.mjs';
import {validateElement} from './elements.mjs';
export const EDGE_FADE_MS=5;
export const editKey=(blockId,id)=>`${blockId}:${id}`;
export function resolveQuote(state,catalog,id,blockId,mode=state.mode){const base=catalog.quotes[id];if(!base)throw Error('Onbekend fragment');const edit=blockId?state.modes[mode].edits?.[editKey(blockId,id)]:undefined;return {...base,...edit,sourceStart:base.start,sourceEnd:base.end,sourceText:base.text};}
export function parseTime(value){const text=String(value).trim().replace(',','.');if(/^\d+(?:\.\d{1,3})?$/.test(text))return Number(text);const m=/^(\d{1,3}):([0-5]\d(?:\.\d{1,3})?)$/.exec(text);return m?Math.round((Number(m[1])*60+Number(m[2]))*1000)/1000:NaN;}
export function fineTime(seconds){const ms=Math.round(seconds*1000),minutes=Math.floor(ms/60000);return `${String(minutes).padStart(2,'0')}:${((ms-minutes*60000)/1000).toFixed(3).padStart(6,'0')}`;}
export function validateRange(start,end,duration){if(!Number.isFinite(start)||!Number.isFinite(end))throw Error('Gebruik mm:ss.mmm, bijvoorbeeld 04:55.650.');if(start<0||end>duration+.000001)throw Error('De knip moet binnen de oorspronkelijke opname vallen.');if(end-start<.039999)throw Error('Het einde moet minstens één beeldje (0,04 seconde) na het begin liggen.');}
export function validateEdits(modeState,catalog,mode){if(modeState.subtitleLanguage!==undefined&&!['nl','en'].includes(modeState.subtitleLanguage))throw Error('Ongeldige ondertiteltaal');const edits=modeState.edits??{};if(!edits||Array.isArray(edits)||typeof edits!=='object'||Object.keys(edits).length>2500)throw Error('Ongeldige fragmentwijzigingen');const blocks=new Set(['teaser',...(catalog.legacyBlockIds||[]),...catalog.catalog[mode].map(b=>b.id)]);
 for(const [key,e]of Object.entries(edits)){const split=key.indexOf(':'),block=key.slice(0,split),id=key.slice(split+1);if(split<1||!blocks.has(block)||!Object.hasOwn(catalog.quotes,id)||mode==='quoteverhaal'&&!catalog.imported&&catalog.quotes[id].speaker!==(catalog.primarySpeaker||'Gast'))throw Error('Ongeldige fragmentverwijzing');if(!e||typeof e!=='object'||Object.keys(e).some(k=>!['start','end','nl','translationReviewed','translationRange','wordBounds','sentenceException','shot','subtitleLanguage','subtitleTiming','subtitleBaseline','element','transition'].includes(k)))throw Error('Ongeldige fragmentvelden');validateTransition(e.transition);if(e.transition&&!Object.hasOwn(catalog.quotes,e.transition.nextId)&&!(e.transition.nextId.startsWith('topic:')&&blocks.has(e.transition.nextId.slice(6))))throw Error("Onbekende volgende quote");if(e.subtitleBaseline!==undefined&&(typeof e.subtitleBaseline!=='string'||e.subtitleBaseline.length>20000))throw Error('Ongeldige ondertitelreferentie');if(e.subtitleTiming!==undefined)validateSubtitleTiming(e.subtitleTiming,catalog.duration);if(e.subtitleLanguage!==undefined&&!['nl','en'].includes(e.subtitleLanguage))throw Error('Ongeldige ondertiteltaal');if(e.shot!==undefined&&!['wide','medium','close'].includes(e.shot))throw Error('Ongeldige uitsnede');validateRange(e.start,e.end,catalog.duration);if(e.wordBounds!==undefined){if(!e.wordBounds||typeof e.wordBounds!=='object'||Array.isArray(e.wordBounds))throw Error('Ongeldige woordgrenzen');if(Object.keys(e.wordBounds).some(k=>!['start','end'].includes(k)))throw Error('Ongeldige woordgrenzen');validateRange(e.wordBounds.start,e.wordBounds.end,catalog.duration);if(e.wordBounds.start>e.start||e.wordBounds.end<e.end)throw Error('Woordoverzicht moet de knip omvatten');}if(e.sentenceException!==undefined){const x=e.sentenceException;if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!['start','end'].includes(k))||x.start!==e.start||x.end!==e.end)throw Error('Bevestig de afwijkende zinsgrens opnieuw voor deze knip');}if(typeof e.nl!=='string'||e.nl.length>20000||typeof e.translationReviewed!=='boolean')throw Error('Ongeldige ondertiteltekst');if(e.translationReviewed&&(!e.translationRange||e.translationRange.start!==e.start||e.translationRange.end!==e.end))throw Error('Controleer de vertaling opnieuw voor deze knip');}
}
export function sourceText(catalog,q){const words=catalog.words?.filter(w=>(catalog.imported||w.speaker===q.speaker)&&w.start<q.end&&w.end>q.start);return words?.length?words.map(w=>w.text).join('').trim():q.sourceText||q.text;}

// Keep a stable word envelope so crossed-out words survive saving and reopening.
export function wordBounds(q){return {start:Math.min(q.sourceStart,q.start,q.wordBounds?.start??Infinity),end:Math.max(q.sourceEnd,q.end,q.wordBounds?.end??-Infinity)};}
export function edgeWords(catalog,q){
 const bounds=wordBounds(q);
 return (catalog.words||[]).flatMap((w,index)=>(catalog.imported||w.speaker===q.speaker)&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.text?.trim()&&w.start<bounds.end&&w.end>bounds.start?[{...w,index,removed:w.end<=q.start+.000001?'before':w.start>=q.end-.000001?'after':null}]:[]);
}
export function wordTrim(catalog,q,index){
 const words=edgeWords(catalog,q),i=words.findIndex(w=>w.index===index);
 if(i<0)throw Error('Dit woord hoort niet bij dit fragment.');
 const word=words[i],active=words.filter(w=>!w.removed),bounds=wordBounds(q);let start=q.start,end=q.end;
 if(word.removed==='before')start=Math.max(bounds.start,word.start-.025,i>0?words[i-1].end:0);
 else if(word.removed==='after')end=Math.min(bounds.end,word.end+.025,i+1<words.length?words[i+1].start:Infinity);
 else {
  if(active.length<2)throw Error('Laat minstens één woord staan; verwijder het fragment als je alles wilt weglaten.');
  if(word.index===active[0].index)start=Math.max(q.start,word.end,active[1].start-.025);
  else if(word.index===active.at(-1).index)end=Math.min(q.end,word.start,active.at(-2).end+.025);
  else throw Error('Je kunt hier alleen het eerste of laatste woord schrappen.');
 }
 start=Math.round(start*1000)/1000;end=Math.round(end*1000)/1000;
 validateRange(start,end,catalog.duration);
 if(start===q.start&&end===q.end)throw Error('Deze woordtijdcodes overlappen. Gebruik de knipgrenzen en beluister de rand.');
 return {start,end,wordBounds:bounds};
}

export function validateSubtitleTiming(t,duration){
 if(!t||typeof t!=='object'||typeof t.text!=='string'||!Array.isArray(t.cues)||!t.cues.length||t.cues.length>200)throw Error('Ongeldige ondertiteltiming.');
 validateRange(t.start,t.end,duration);let end=t.start;
 for(const c of t.cues){validateRange(c.start,c.end,duration);if(c.start<end-.001||c.start<t.start-.001||c.end>t.end+.001||typeof c.text!=='string'||!c.text.trim())throw Error('Ondertitels overlappen of vallen buiten de bronknip.');end=c.end;}
 if(t.cues.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim()!==t.text.replace(/\s+/g,' ').trim())throw Error('Ondertiteltiming bevat niet de volledige tekst.');
}
export function alignedSubtitleCues(q){
 const t=q.subtitleTiming;if(!t)return undefined;
 if(t.start!==q.start||t.end!==q.end||t.text!==q.nl)throw Error('De tekst of knip is gewijzigd. Controleer de betekenisgebonden ondertiteltiming opnieuw.');
 return t.cues;
}

export function quoteNavigation(montage,id,blockId,include=()=>true){
 const refs=[...(montage.teaser||[]).map(id=>({id,blockId:'teaser'})),
  ...montage.blocks.flatMap(block=>block.clipIds.map(id=>({id,blockId:block.id})))];
 const index=refs.findIndex(ref=>ref.id===id&&ref.blockId===blockId);
 const eligible=refs.filter(include);
 return {index:eligible.findIndex(ref=>ref.id===id&&ref.blockId===blockId),total:eligible.length,previous:index>0?refs.slice(0,index).filter(include).at(-1)||null:null,next:index>=0?refs.slice(index+1).find(include)||null:null};
}
