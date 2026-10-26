import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapService} from '../../scripts/bootstrap-service.mjs';
test('macOS may release the old service asynchronously; retry without changing paths',async()=>{
 const calls=[],waits=[];await bootstrapService((cmd,args)=>{calls.push([cmd,args]);return {status:calls.length<3?5:0,stderr:'Input/output error'};},'gui/501','/local/editor.plist',{pause:async ms=>waits.push(ms)});
 assert.equal(calls.length,3);assert.deepEqual(waits,[500,1000]);assert.ok(calls.every(c=>c[1][2]==='/local/editor.plist'));
});
test('a persistent service failure stops after the bounded retry',async()=>{let attempts=0;await assert.rejects(bootstrapService(()=>{attempts++;return {status:5,stderr:'Input/output error'};},'gui/501','/local/editor.plist',{pause:async()=>{}}),/Input\/output/);assert.equal(attempts,4);});
