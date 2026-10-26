import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAnalysis} from '../analyze-interview.mjs';
import {editorialRules} from '../editorial-rules.mjs';
import {EDITORIAL_MODEL_ID} from '../editorial-model.mjs';
test('standaardanalyse gebruikt Terra, negeert lokale cache en behoudt montage',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-terra-default-')),data=path.join(dir,'data');fs.mkdirSync(data);
 const originalFetch=globalThis.fetch,originalKey=process.env.OPENAI_API_KEY,originalCloud=process.env.FMT_ALLOW_CLOUD;process.env.FMT_ALLOW_CLOUD='1';process.env.OPENAI_API_KEY='test-only';
 t.after(()=>{globalThis.fetch=originalFetch;if(originalCloud===undefined)delete process.env.FMT_ALLOW_CLOUD;else process.env.FMT_ALLOW_CLOUD=originalCloud;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;fs.rmSync(dir,{recursive:true,force:true});});
 const montage='{"edits":{"q":{"nl":"Eigen tekst","translationReviewed":true}},"revision":7}';fs.writeFileSync(path.join(data,'montages.json'),montage);fs.writeFileSync(path.join(data,'catalog.json'),JSON.stringify({analysis:{},quotes:{}}));fs.writeFileSync(path.join(data,'analysis-cache.json'),JSON.stringify({[editorialRules().hash+':probe']:'oud oordeel'}));
 let calls=0;globalThis.fetch=async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(body.model,'gpt-5.6-terra');assert.equal(body.reasoning.effort,'low');assert.equal(body.store,false);assert.match(body.input,/JSON/);return new Response(JSON.stringify({status:'completed',model:body.model,usage:{input_tokens:1,output_tokens:1},output:[{content:[{type:'output_text',text:'{"checked":true}'}]}]}));};
 const deps={prepare:async(c,ask,progress,cache)=>{assert.equal(cache.get('probe'),undefined);cache.set('probe','Terra oordeel');assert.deepEqual(await ask('Controleer bron'),{checked:true});return c;},analyze:async c=>({catalog:c,bank:{units:[]}})};
 await runAnalysis(dir,()=>{},'',deps);assert.equal(calls,1);assert.equal(JSON.parse(fs.readFileSync(path.join(data,'catalog.json'))).analysis.model,'gpt-5.6-terra (low)');assert.equal(fs.readFileSync(path.join(data,'montages.json'),'utf8'),montage);assert.ok(fs.existsSync(path.join(data,'analysis-cache-'+EDITORIAL_MODEL_ID+'.json')));
 const bank=await runAnalysis(dir,()=>{},'focus', {rank:async(b,c,angle,ask)=>{await ask('Beoordeel de richting');return b;}});assert.equal(calls,2);assert.equal(bank.directionModel,'gpt-5.6-terra (low)');assert.equal(fs.readFileSync(path.join(data,'montages.json'),'utf8'),montage);
});
