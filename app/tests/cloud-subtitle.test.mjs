import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {withSubtitleModel} from '../cloud-subtitle-model.mjs';
test('Terra request uses low, no storage, counts usage and never records credentials',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terra-'));
 try{const result=await withSubtitleModel(dir,ask=>ask('Brontekst',800),{allowCloud:true,key:'test-secret',fetcher:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.model,'gpt-5.6-terra');assert.equal(body.reasoning.effort,'low');assert.equal(body.store,false);assert.equal(body.max_output_tokens,1800);return new Response(JSON.stringify({status:'completed',model:body.model,usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:'{"subtitleLanguage":"nl","items":[]}'}]}]}));}});assert.equal(result.subtitleLanguage,'nl');const log=fs.readFileSync(path.join(dir,'usage.json'),'utf8');assert.ok(!log.includes('test-secret'));assert.equal(JSON.parse(log).usd,.0008);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('API failure and truncation are surfaced without returning partial subtitles or secret error bodies',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terra-'));
 try{for(const response of [new Response('secret',{status:401}),new Response('secret',{status:429}),new Response(JSON.stringify({status:'incomplete',usage:{input_tokens:1,output_tokens:1},output:[]}))])await assert.rejects(withSubtitleModel(dir,ask=>ask('test'),{allowCloud:true,key:'test-secret',fetcher:async()=>response}),e=>!e.message.includes('secret'));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('redactionele antwoordschemas worden ongewijzigd doorgegeven',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terra-schema-')),schema={type:'object',properties:{reviews:{type:'array',items:{type:'string'}}},required:['reviews'],additionalProperties:false};
 try{await withSubtitleModel(dir,ask=>ask('Geef JSON',3500,schema),{allowCloud:true,key:'test-secret',fetcher:async(_url,options)=>{const body=JSON.parse(options.body);assert.deepEqual(body.text.format,{type:'json_schema',name:'fmt_editorial',strict:true,schema});return new Response(JSON.stringify({status:'completed',usage:{input_tokens:1,output_tokens:1},output:[{content:[{type:'output_text',text:'{"reviews":[]}'}]}]}));}});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
