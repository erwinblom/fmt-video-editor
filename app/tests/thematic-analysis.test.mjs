import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePassages,compileAnalysis,validateAssignments,validateThemes,validateTeaserReview,unsafeTeaserBoundary} from '../thematic-analysis.mjs';
import {buildThematicProposal,proposalDuration} from '../public/proposals.mjs';
import {validateEdits} from '../public/model.mjs';
function fixture(){const transcript=Array.from({length:12},(_,i)=>({start:i*20,end:i*20+10,text:i%2?'Het product wordt in scholen gebruikt.':'Het bedrijf begon met twee oprichters.'})),catalog={title:'Ander interview',language:'nl',duration:240,transcript,quotes:{},catalog:{quoteverhaal:[{id:'old'}],gespreksmontage:[{id:'old'}]}};const passages=sourcePassages(catalog),assignments=passages.map((p,i)=>({id:p.id,theme:i%2?'Onderwijs':'Ontstaan',score:100-i,standalone:true,teaser:i<3})),themes=[{title:'Oprichting',labels:['Ontstaan'],reason:'Eerst de aanleiding.'},{title:'Toepassing',labels:['Onderwijs'],reason:'Daarna de praktijk.'}];return {...compileAnalysis(catalog,passages,assignments,themes),passages,assignments,themes};}
test('same themes from nonadjacent moments are grouped; every original range and text is retained',()=>{const f=fixture();assert.equal(f.catalog.catalog.gespreksmontage.length,2);assert.equal(f.catalog.catalog.gespreksmontage[0].clipIds.length,6);for(const p of f.passages)assert.deepEqual(f.catalog.quotes[p.id].sourceSegments,p.sourceSegments);assert.equal(f.catalog.quotes[f.passages[0].id].text,f.passages[0].text);assert.ok(f.catalog.legacyBlockIds.includes('old'));});
test('invented IDs, omissions, repeated assignments and lost theme labels are rejected',()=>{const f=fixture();assert.throws(()=>validateAssignments({passages:f.assignments.slice(1)},f.passages));assert.throws(()=>validateAssignments({passages:f.assignments.map((r,i)=>i?{...r,id:f.assignments[0].id}:r)},f.passages));assert.throws(()=>validateThemes({themes:[f.themes[0]]},['Ontstaan','Onderwijs']));});
test('shorter target creates a smaller proposal with three teasers and graphics inside the exact limit',()=>{const f=fixture(),state={mode:'gespreksmontage'};for(const target of [60,90,120,300]){const m=buildThematicProposal(state,f.catalog,f.bank,target);assert.equal(m.teaser.length,3);assert.ok(proposalDuration(m,f.catalog)<=target);assert.ok(m.blocks.length);assert.doesNotThrow(()=>validateEdits(m,f.catalog,'gespreksmontage'));}const a=buildThematicProposal(state,f.catalog,f.bank,90),b=buildThematicProposal(state,f.catalog,f.bank,180);assert.ok(a.blocks.flatMap(x=>x.clipIds).length<b.blocks.flatMap(x=>x.clipIds).length);});
test('strict semantic direction excludes nonmatching material, including teasers; no keyword fallback',()=>{const f=fixture(),angle='Alleen de oprichting';const bank={...f.bank,direction:angle,units:f.bank.units.map(u=>({...u,eligible:u.blockId==='theme0'}))};const m=buildThematicProposal({mode:'gespreksmontage'},f.catalog,bank,120,angle);assert.deepEqual(m.blocks.map(b=>b.id),['theme0']);assert.ok(m.teaser.every(id=>f.bank.units.find(u=>u.id===id).blockId==='theme0'));assert.throws(()=>buildThematicProposal({mode:'gespreksmontage'},f.catalog,f.bank,120,angle));});
test('proposal never changes the prior edited state or invents shortened cuts to fill a target',()=>{const f=fixture(),state={mode:'gespreksmontage',modes:{gespreksmontage:{edits:{example:'eigen tekst'}}}},before=JSON.stringify(state);const m=buildThematicProposal(state,f.catalog,f.bank,120);assert.equal(JSON.stringify(state),before);for(const e of Object.entries(m.edits)){const id=e[0].split(':')[1],q=f.catalog.quotes[id];assert.equal(e[1].start,q.start);assert.equal(e[1].end,q.end);}assert.throws(()=>buildThematicProposal(state,f.catalog,f.bank,30));});
test('a generated teaser sentence cannot become a source quote',()=>{const f=fixture(),rows=f.assignments.map(x=>({...x,teaser:'Een verzonnen citaat.'}));const validated=validateAssignments({passages:rows},f.passages);assert.ok(validated.every(x=>x.teaser===false));const c=compileAnalysis(f.catalog,f.passages,validated,f.themes);assert.ok(Object.values(c.catalog.quotes).every(q=>!q.text.includes('verzonnen')));});
test('analysis keeps old chapter edit references valid while a new proposal stays separate',()=>{const f=fixture(),id=f.passages[0].id,old={blocks:[{id:'old',clipIds:[id]}],teaser:[],edits:{['old:'+id]:{start:0,end:8,nl:'Mijn eigen tekst.',translationReviewed:false}}};assert.doesNotThrow(()=>validateEdits(old,f.catalog,'gespreksmontage'));const before=JSON.stringify(old);buildThematicProposal({mode:'gespreksmontage'},f.catalog,f.bank,120);assert.equal(JSON.stringify(old),before);});

test('a pause without sentence punctuation does not create a new passage',()=>{const c={duration:20,transcript:[{start:0,end:5,text:'Ik besloot toen om'},{start:8,end:12,text:'het bedrijf op te richten.'}]};const p=sourcePassages(c);assert.equal(p.length,1);assert.equal(p[0].text,'Ik besloot toen om het bedrijf op te richten.');assert.equal(p[0].end,12);});
test('source identity survives unrelated earlier additions to the transcript',()=>{const c={duration:100,transcript:[{start:30,end:40,text:'Dit is de oorspronkelijke volledige zin.'}]},before=sourcePassages(c)[0];const after=sourcePassages({...c,transcript:[{start:0,end:10,text:'Een eerdere losse zin.'},...c.transcript]}).find(p=>p.start===30);assert.equal(after.id,before.id);});

test('coherent answers retain every source segment and literal word in order',async()=>{
 const {groupAnswers}=await import('../thematic-analysis.mjs');const rows=[{id:'a',start:1,end:3,text:'Hoe werkt dat?',nl:'',sourceSegments:[{start:1,end:3}]},{id:'b',start:3,end:9,text:'Ik werk met een agent.',nl:'',sourceSegments:[{start:3,end:9}]},{id:'c',start:10,end:15,text:'Wat kost dat?',nl:'',sourceSegments:[{start:10,end:15}]}];
 const result=groupAnswers(rows,[1,2]);assert.equal(result.length,2);assert.equal(result[0].text,'Hoe werkt dat? Ik werk met een agent.');assert.deepEqual(result.flatMap(r=>r.sourceSegments),rows.flatMap(r=>r.sourceSegments));assert.equal(result[0].start,1);assert.equal(result[0].end,9);
 for(const ends of [[0],[1,1,2],[2,1],[-1,2],[0,3],[.5,2]])assert.throws(()=>groupAnswers(rows,ends));
});
test('answer grouping carries the unfinished last answer into the next window',async()=>{
 const {coherentAnswers}=await import('../thematic-analysis.mjs');const preparedPassages=Array.from({length:30},(_,i)=>({id:'original'+i,start:i*3,end:i*3+2,text:'Bronzin '+i+'.',nl:'',sourceSegments:[{start:i*3,end:i*3+2}]}));let calls=0;
 const result=await coherentAnswers({preparedPassages},async()=>({groups:(calls++===0?[5,11,17,23]:[5,11]).map(n=>({topic:'Onderwerp',lastId:'P'+n}))}),()=>{},{});
 assert.equal(calls,2);assert.equal(result.length,5);assert.equal(result.map(x=>x.text).join(' '),preparedPassages.map(x=>x.text).join(' '));assert.deepEqual(result.flatMap(x=>x.sourceSegments),preparedPassages.flatMap(x=>x.sourceSegments));
});

test('separate short teasers keep long answers intact and follow parent exclusions',()=>{
 const f=fixture();const before=JSON.stringify(f.bank.units);f.bank.teaserUnits=f.bank.units.slice(0,3).map((u,i)=>{const q={...f.catalog.quotes[u.id],id:'teaser'+i,end:f.catalog.quotes[u.id].start+4};f.catalog.quotes[q.id]=q;return {...u,id:q.id,parentId:u.id,teaser:true,clips:[{...u.clips[0],quoteId:q.id,end:q.end}]};});
 const p=buildThematicProposal({mode:'gespreksmontage'},f.catalog,f.bank,180);assert.equal(p.teaser.length,3);assert.ok(p.teaser.every(id=>id.startsWith('teaser')));assert.equal(JSON.stringify(f.bank.units),before);assert.ok(p.blocks.every(b=>b.clipIds.every(id=>!id.startsWith('teaser'))));
 f.bank.units[0].eligible=false;const limited=buildThematicProposal({mode:'gespreksmontage'},f.catalog,f.bank,180);assert.ok(!limited.teaser.includes('teaser0'));
});

test('question blocks and acknowledgements merge into the next actual answer without losing source',async()=>{const {mergeQuestionGroups}=await import('../thematic-analysis.mjs');const rows=['Vorige antwoord.','Hoe werkt dit?','Ja, precies.','Dit is de uitleg.','Volgend onderwerp.'].map((text,i)=>({text,start:i*10,end:i*10+8,nl:'',sourceSegments:[{start:i*10,end:i*10+8}]}));const merged=mergeQuestionGroups(rows,[1,2]);assert.equal(merged.length,3);assert.equal(merged[1].text,'Hoe werkt dit? Ja, precies. Dit is de uitleg.');assert.deepEqual(merged.flatMap(x=>x.sourceSegments),rows.flatMap(x=>x.sourceSegments));assert.throws(()=>mergeQuestionGroups(rows,[4]));});
test('brief agreement after a declarative question stays with the substantive response',async()=>{const {attachQuestions}=await import('../thematic-analysis.mjs');const rows=[{start:0,end:30,text:'Dit was het vorige onderwerp.'},{start:31,end:45,text:'So I assume this helps founders. Yeah, exactly.'},{start:46,end:80,text:'They can start with agents as their first team.'}].map(r=>({...r,nl:'',sourceSegments:[{start:r.start,end:r.end}]}));const result=await attachQuestions(rows,async()=>({questionOnly:[]}),()=>{},{});assert.equal(result.length,2);assert.equal(result[1].start,31);assert.equal(result[1].end,80);assert.equal(result[0].text,rows[0].text);});

test('teaser review rejects missing context and company updates even with high scores',()=>{
 const selected=[{quote:{id:'experience',text:'My agent booked the meetings.'}},{quote:{id:'update'}},{quote:{id:'context'}}];
 const reviews=[{id:'T0',hasOutcome:true,risk:'geen',kind:'ervaring',contextSafe:true,score:94,reason:'Concreet resultaat'},{id:'T1',hasOutcome:true,risk:'geen',kind:'overig',contextSafe:true,score:99,reason:'Bedrijfsupdate'},{id:'T2',hasOutcome:true,risk:'nuance',kind:'belofte',contextSafe:false,score:100,reason:'Nuance ontbreekt'}];
 const before=JSON.stringify(selected);const result=validateTeaserReview({reviews},selected);
 assert.deepEqual(result.map(r=>r.quote.id),['experience']);assert.equal(result[0].score,97);assert.deepEqual(validateTeaserReview({reviews:[{...reviews[0],risk:'regie'}]},[selected[0]]),[]);assert.equal(JSON.stringify(selected),before);
 assert.throws(()=>validateTeaserReview({reviews:reviews.slice(1)},selected));
 assert.throws(()=>validateTeaserReview({reviews:[reviews[0],reviews[0],reviews[2]]},selected));
 assert.throws(()=>validateTeaserReview({reviews:reviews.map((r,i)=>i===0?{...r,id:'T9'}:r)},selected));
 assert.deepEqual(validateTeaserReview({reviews:reviews.map(r=>({...r,score:60}))},selected),[]);
});

test('obvious directions, appended questions and qualified blanket claims cannot become teasers',()=>{
 assert.ok(unsafeTeaserBoundary("We work together. Don't stress about the time."));
 assert.ok(unsafeTeaserBoundary('I work like a team. Can you tell how you use it?'));assert.ok(unsafeTeaserBoundary('You could tell us more about borrowing a rake.'));
 assert.ok(unsafeTeaserBoundary("There is nothing it can't do.","But quality depends on human guidance."));
 assert.equal(unsafeTeaserBoundary('My agent contacts the media for me.'),false);
});

test('teasers require a result for experiences and reject hesitation or rambling regardless of score',()=>{
 const row={id:'T0',hasOutcome:true,risk:'geen',kind:'ervaring',contextSafe:true,score:85,reason:'Resultaat'};const selected=[{quote:{text:'My agent writes emails in my voice.'}}];
 for(const patch of [{hasOutcome:false},{risk:'omslachtig'},{risk:'aarzelend'},{contextSafe:false}])assert.deepEqual(validateTeaserReview({reviews:[{...row,...patch}]},selected),[]);
 const experience=validateTeaserReview({reviews:[row]},selected)[0];const promise=validateTeaserReview({reviews:[{...row,kind:'belofte',score:100}]},selected)[0];assert.ok(experience.score>promise.score);
 assert.ok(unsafeTeaserBoundary('My agents write it. I do not know how to explain it really, but yeah.'));
 assert.equal(unsafeTeaserBoundary('Um, my agent writes emails and nobody notices the difference.'),false);
});

test('local review accepts safe as an unambiguous synonym without bypassing context checks',()=>{
 const row={id:'T0',hasOutcome:true,risk:'safe',kind:'ervaring',contextSafe:true,score:95,reason:'Contact gelegd'};const selected=[{quote:{text:'My agent arranged the meetings.'}}];assert.equal(validateTeaserReview({reviews:[row]},selected).length,1);assert.deepEqual(validateTeaserReview({reviews:[{...row,contextSafe:false}]},selected),[]);
});

test('screen-time claims exceeding a day require manual context selection',()=>{assert.ok(unsafeTeaserBoundary('My screen time was 31 hours combined with my phone a day.'));assert.equal(unsafeTeaserBoundary('I saved 31 hours of work using the agent.'),false);});
