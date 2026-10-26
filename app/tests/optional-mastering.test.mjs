import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {python} from '../runtime-config.mjs';
test('lokale export roept geen dienst aan; Auphonic-fout valt zichtbaar terug',()=>{const r=spawnSync(python,['-c',`from optional_mastering import optional_mastering
calls=[]
def fail(*args):
 calls.append(1)
 raise RuntimeError('service unavailable')
for env in [{},{'FMT_ALLOW_CLOUD':'1'},{'FMT_AUDIO_MASTERING':'auphonic'}]:
 source,receipt=optional_mastering('source.wav','cache',lambda m:None,fail,env)
 assert source=='source.wav' and receipt['provider']=='local'
assert calls==[]
source,receipt=optional_mastering('source.wav','cache',lambda m:None,fail,{'FMT_ALLOW_CLOUD':'1','FMT_AUDIO_MASTERING':'auphonic'})
assert calls==[1] and source=='source.wav' and receipt['fallback']
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(r.status,0,r.stderr);});
