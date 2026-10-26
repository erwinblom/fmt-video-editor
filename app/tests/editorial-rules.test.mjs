import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {editorialRules,editorialPrompt,editorialCache,withEditorialRules} from '../editorial-rules.mjs';
import {runAnalysis} from '../analyze-interview.mjs';
test('rules are read from the canonical file, propagated to prompts and isolate old caches',async()=>{
 assert.equal(editorialRules().version,6);assert.match(editorialRules().hash,/^[a-f0-9]{64}$/);assert.throws(()=>editorialPrompt('missing'));
 for(const name of ['format','general','teaser-select','teaser-review','subtitles','source-kinds','quote-extract','topic-groups'])assert.ok(editorialPrompt(name).length>100,name);
 const prompts=[];const ask=withEditorialRules(async p=>prompts.push(p));await ask('Analyseer onderwerpen');assert.ok(prompts[0].startsWith(editorialPrompt('general')));
 const teaser=editorialPrompt('teaser-review')+' Bron: []';await ask(teaser);assert.equal(prompts[1],teaser);
 const cache=new Map([['old',{stale:true}]]),scoped=editorialCache(cache);assert.equal(scoped.get('old'),undefined);scoped.set('old',{fresh:true});assert.deepEqual(scoped.get('old'),{fresh:true});
});
for(const revision of [0,7])for(const fail of [false,true])test(`analysis preserves montage revision ${revision}, failure=${fail}, including edits made while it runs`,async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-analysis-preserve-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const data=path.join(dir,'data');fs.mkdirSync(data);
 const montage=path.join(data,'montages.json');fs.writeFileSync(montage,JSON.stringify({revision,edits:{q:{nl:'Eigen ondertitel',start:2,end:5,translationReviewed:true}},teaser:['q']}));
 fs.writeFileSync(path.join(data,'catalog.json'),JSON.stringify({quotes:{q:{text:'source'}}}));let expected=fs.readFileSync(montage,'utf8');
 const deps={withModel:async(_dir,work)=>work(async()=>({})),prepare:async c=>c,analyze:async c=>{assert.equal(fs.readFileSync(montage,'utf8'),expected);expected=JSON.stringify({revision:revision+1,edits:{q:{nl:'Tijdens analyse aangepast',start:3,end:6,translationReviewed:false}},teaser:['q']});fs.writeFileSync(montage,expected);if(fail)throw Error('Modeltestfout');return {catalog:c,bank:{units:[]}};}};
 if(fail)await assert.rejects(runAnalysis(dir,()=>{},'',deps),/Modeltestfout/);else {const bank=await runAnalysis(dir,()=>{},'',deps);assert.equal(bank.editorialRules.hash,editorialRules().hash);}
 assert.equal(fs.readFileSync(montage,'utf8'),expected);
});
test('startup and background completion cannot apply a proposal, even at revision zero',()=>{
 const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const startup=source.slice(source.indexOf('try{[catalog,state'),source.indexOf('// Pointer-based handles'));
 const background=source.slice(source.indexOf('async function watchImportPreparation'),source.indexOf('try{[catalog,state'));
 assert.ok(startup.length>100);assert.doesNotMatch(startup,/buildProposal|await persist/);assert.doesNotMatch(background,/buildProposal|await persist/);
});
test('fixed editorial examples have immutable quotes, both accepted and rejected cases, and no model answers',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('./fixtures/synthetic-editorial.json',import.meta.url),'utf8'));assert.equal(f.cases.length,12);assert.equal(new Set(f.cases.map(c=>c.id)).size,12);assert.equal(f.cases.filter(c=>c.expectedAccept).length,3);
 for(const c of f.cases){assert.ok(c.end>c.start);assert.ok(c.text&&c.reason);assert.equal(typeof c.expectedAccept,'boolean');assert.equal(c.actual,undefined);}
});
