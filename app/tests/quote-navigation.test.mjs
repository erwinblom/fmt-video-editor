import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteNavigation} from '../public/model.mjs';
test('doorloopt montagevolgorde met dezelfde quote apart in teaser en verhaal',()=>{
 const m={teaser:['a'],blocks:[{id:'b1',clipIds:['a','b']},{id:'leeg',clipIds:[]},{id:'b2',clipIds:['c']}]};
 assert.deepEqual(quoteNavigation(m,'a','teaser'),{index:0,total:4,previous:null,next:{id:'a',blockId:'b1'}});
 assert.deepEqual(quoteNavigation(m,'b','b1').next,{id:'c',blockId:'b2'});
 assert.deepEqual(quoteNavigation(m,'c','b2').previous,{id:'b',blockId:'b1'});
 assert.equal(quoteNavigation(m,'c','b2').next,null);
 assert.equal(quoteNavigation(m,'verwijderd','b2').next,null);
});

test('filtered navigation skips reviewed quotes and retains a just-reviewed anchor',()=>{
 const m={teaser:['a'],blocks:[{id:'b',clipIds:['a','b','c','d']}]};
 const include=r=>r.id==='a'&&r.blockId==='teaser'||r.id==='c';
 assert.deepEqual(quoteNavigation(m,'a','teaser',include),{index:0,total:2,previous:null,next:{id:'c',blockId:'b'}});
 assert.deepEqual(quoteNavigation(m,'b','b',include),{index:-1,total:2,previous:{id:'a',blockId:'teaser'},next:{id:'c',blockId:'b'}});
 assert.equal(quoteNavigation(m,'c','b',include).next,null);
 assert.deepEqual(quoteNavigation(m,'c','b',()=>false),{index:-1,total:0,previous:null,next:null});
});
