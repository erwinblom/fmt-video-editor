import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {withSubtitleModel} from '../cloud-subtitle-model.mjs';
test('publication candidate blocks cloud before reading credentials or sending content',async()=>{
 const old=process.env.FMT_ALLOW_CLOUD;delete process.env.FMT_ALLOW_CLOUD;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-no-cloud-'));let calls=0;
 try{await assert.rejects(withSubtitleModel(dir,ask=>ask('synthetic'),{key:'fake-test-value',fetcher:async()=>{calls++;throw Error('must not call');}}),/Cloudverwerking staat uit/);assert.equal(calls,0);assert.deepEqual(fs.readdirSync(dir),[]);}
 finally{if(old===undefined)delete process.env.FMT_ALLOW_CLOUD;else process.env.FMT_ALLOW_CLOUD=old;fs.rmSync(dir,{recursive:true,force:true});}
});
test('all named editorial and format fixtures declare synthetic origins and no real recording hash',()=>{
 for(const name of ['synthetic-editorial','synthetic-format','synthetic-full-format']){
  const data=JSON.parse(fs.readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url)));
  assert.equal(data.synthetic,true);assert.equal(data.transcriptHash,undefined);assert.match(data.source,/fictief|fictieve/i);
 }
});
