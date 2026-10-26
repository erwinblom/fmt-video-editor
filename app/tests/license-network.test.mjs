import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runDesert} from '../desert-ant.mjs';
import {requireLicenseNetworkConsent} from '../license-network.mjs';
test('license network remains a separate explicit choice before native model execution',async()=>{
 const previous=process.env.FMT_ALLOW_LICENSE_NETWORK;delete process.env.FMT_ALLOW_LICENSE_NETWORK;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-license-gate-'));const output=path.join(dir,'result.json');
 try{
  await assert.rejects(runDesert('voz','synthetic-missing.wav',output),/apart licentieverkeer/);
  assert.equal(fs.existsSync(output),false);
  process.env.FMT_ALLOW_LICENSE_NETWORK='1';assert.doesNotThrow(()=>requireLicenseNetworkConsent());
 }finally{if(previous===undefined)delete process.env.FMT_ALLOW_LICENSE_NETWORK;else process.env.FMT_ALLOW_LICENSE_NETWORK=previous;fs.rmSync(dir,{recursive:true,force:true});}
});
test('direct optional Node model route also stops before imports, downloads and output without license consent',()=>{
 const env={...process.env,FMT_ALLOW_LICENSE_NETWORK:'0'};
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../voz-node.mjs',import.meta.url)),'synthetic-missing.wav','unused-output.json','nl'],{env,encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stderr,/apart licentieverkeer/);
});
