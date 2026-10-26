import test from 'node:test';
import assert from 'node:assert/strict';
import {applySubtitleResult,assertSubtitleResult,subtitleSelection,subtitleLanguage,subtitleBaseline,subtitlesAdjusted} from '../public/subtitle-state.mjs';
import {validateEdits} from '../public/model.mjs';
const setup=()=>{
 const catalog={duration:10,imported:true,words:[{start:1,end:2,text:' uh'}],quotes:{q:{start:1,end:5,text:'uh I think maybe',nl:'Ik denk misschien'}},catalog:{quoteverhaal:[{id:'b'}]}};
 const state={revision:3,mode:'quoteverhaal',modes:{quoteverhaal:{subtitleLanguage:'en',teaser:['q'],blocks:[{id:'b',clipIds:['q']}],edits:{'b:q':{start:2,end:4,nl:'Mijn eigen redactie',translationReviewed:true,translationRange:{start:2,end:4},shot:'wide'}}}}};
 const result={revision:3,mode:'quoteverhaal',subtitleLanguage:'en',items:subtitleSelection(state,catalog).map(q=>({...q,text:'I think it may work.'}))};
 return {state,catalog,result};
};
test('apply selected teaser and main subtitle texts only; preserve source, cuts and crop',()=>{
 const {state,catalog,result}=setup(),source=structuredClone(catalog),ranges=subtitleSelection(state,catalog);
 applySubtitleResult(state,catalog,result);assert.deepEqual(catalog,source);assert.deepEqual(subtitleSelection(state,catalog),ranges);
 assert.equal(state.modes.quoteverhaal.edits['b:q'].nl,'I think it may work.');assert.equal(state.modes.quoteverhaal.edits['b:q'].shot,'wide');assert.equal(state.modes.quoteverhaal.edits['b:q'].translationReviewed,false);assert.equal(state.modes.quoteverhaal.edits['b:q'].translationRange,undefined);validateEdits(state.modes.quoteverhaal,catalog,'quoteverhaal');
});
test('reject stale revisions, modes, language, selected ranges, missing or duplicate items',()=>{
 for(const mutate of [(s,r)=>s.revision++,(s,r)=>r.mode='gespreksmontage',(s,r)=>r.subtitleLanguage='nl',(s,r)=>s.modes.quoteverhaal.edits['b:q'].end=4.1,(s,r)=>r.items.pop(),(s,r)=>r.items[1]=r.items[0]]){
  const {state,catalog,result}=setup();mutate(state,result);assert.throws(()=>assertSubtitleResult(state,catalog,result));
 }
});
test('legacy state defaults to Dutch without mutating saved edits; invalid language rejected',()=>{
 const {state,catalog}=setup(),m=state.modes.quoteverhaal;delete m.subtitleLanguage;const before=structuredClone(m);assert.equal(subtitleLanguage(m),'nl');validateEdits(m,catalog,'quoteverhaal');assert.deepEqual(m,before);
 m.subtitleLanguage='fr';assert.throws(()=>validateEdits(m,catalog,'quoteverhaal'),/ondertiteltaal/);m.subtitleLanguage='en';m.edits['b:q'].subtitleLanguage='xx';assert.throws(()=>validateEdits(m,catalog,'quoteverhaal'),/ondertiteltaal/);
});

test('subtitle baseline survives saving and resets with a new proposal',()=>{
 const {state,catalog,result}=setup();applySubtitleResult(state,catalog,result);
 const edit=state.modes.quoteverhaal.edits['b:q'];
 assert.equal(subtitlesAdjusted(edit),false);edit.nl='Handmatig gewijzigd';
 const saved=JSON.parse(JSON.stringify(edit));assert.equal(subtitlesAdjusted(saved),true);
 saved.nl=subtitleBaseline(saved);assert.equal(subtitlesAdjusted(saved),false);
 applySubtitleResult(state,catalog,result);assert.equal(subtitlesAdjusted(state.modes.quoteverhaal.edits['b:q']),false);
 assert.equal(subtitleBaseline({nl:'Bestaande tekst'}),'Bestaande tekst');
});
