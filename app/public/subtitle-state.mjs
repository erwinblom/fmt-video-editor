import {resolveQuote,editKey} from './model.mjs';
export const subtitleLanguage=mode=>mode.subtitleLanguage||'nl';
export function subtitleSelection(state,catalog){
 const m=state.modes[state.mode];
 const item=(id,block)=>{const q=resolveQuote(state,catalog,id,block);return {key:editKey(block,id),clipId:id,start:q.start,end:q.end};};
 return [...m.teaser.map(id=>item(id,'teaser')),...m.blocks.flatMap(b=>b.clipIds.map(id=>item(id,b.id)))];
}
export function assertSubtitleResult(state,catalog,result){
 if(!result||result.revision!==state.revision||result.mode!==state.mode||result.subtitleLanguage!==subtitleLanguage(state.modes[state.mode]))throw Error('De montage of taal is gewijzigd. Maak een nieuw ondertitelvoorstel.');
 const selected=subtitleSelection(state,catalog);
 if(!Array.isArray(result.items)||result.items.length!==selected.length||!selected.length)throw Error('Het ondertitelvoorstel is onvolledig.');
 selected.forEach((q,i)=>{const item=result.items[i];if(!item||Object.keys(q).some(k=>q[k]!==item[k])||typeof item.text!=='string'||!item.text.trim()||item.text.length>20000)throw Error('De selectie of knip is gewijzigd. Maak een nieuw ondertitelvoorstel.');});
 return selected;
}
export function applySubtitleResult(state,catalog,result){
 assertSubtitleResult(state,catalog,result);
 const m=state.modes[state.mode];m.edits??={};
 for(const item of result.items){const prior=m.edits[item.key]||{};m.edits[item.key]={...prior,start:item.start,end:item.end,nl:item.text,subtitleBaseline:item.text,subtitleLanguage:result.subtitleLanguage,translationReviewed:false};delete m.edits[item.key].translationRange;}
}

export const subtitleBaseline=q=>q.subtitleBaseline??q.nl??'';
export const subtitlesAdjusted=(q,text=q.nl||'')=>text!==subtitleBaseline(q);
