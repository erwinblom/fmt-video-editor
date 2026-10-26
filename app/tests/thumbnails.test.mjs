import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {thumbnailService,thumbnailKey,thumbnailTitle,rankThumbnailFrames,renderThumbnail} from '../thumbnail-service.mjs';
test('coverkeuze sluit onscherpe/gesloten ogen uit en spreidt beelden',()=>{
 const rows=[{id:'bad',seconds:1,score:100,blurry:true,faceQuality:1},{id:'closed',seconds:100,score:90,eyesClosed:true,faceQuality:1},{id:'small',seconds:150,score:80,faceQuality:.4},{id:'a',seconds:200,score:9,faceQuality:.9},{id:'near',seconds:205,score:8,faceQuality:.9},{id:'b',seconds:300,score:7,faceQuality:.8}];
 assert.deepEqual(rankThumbnailFrames(rows,1000).map(r=>r.id),['a','b']);assert.deepEqual(rankThumbnailFrames([],100),[]);
});
test('thumbnail bewaart alleen aparte keuze, heropent en weigert verouderd kader of onbekend beeld',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-thumb-'));try{
 const source=path.join(root,'source'),stateFile=path.join(root,'montages.json');fs.writeFileSync(source,'video');fs.writeFileSync(stateFile,JSON.stringify({revision:472}));const before=fs.readFileSync(stateFile);const svc=thumbnailService(root,source,stateFile);const {key}=svc.status(),dir=path.join(root,'data/thumbnails',key);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify({key,status:'complete',candidates:[{id:'001'}]}));await sharp({create:{width:1280,height:720,channels:3,background:'#d7e4eb'}}).jpeg().toFile(path.join(dir,'001.jpg'));
 const saved=await svc.save({key,id:'001',title:'Mens & machine <samen>'});assert.equal(saved.choice.title,'Mens & machine <samen>');assert.equal(thumbnailService(root,source,stateFile).status().choice.output,saved.choice.output);const output=svc.download(key,saved.choice.output),m=await sharp(output).metadata();assert.equal(m.width,1280);assert.equal(m.height,720);assert.ok(fs.statSync(output).size<2*1024*1024);assert.deepEqual(fs.readFileSync(stateFile),before);assert.throws(()=>svc.image(key,'../../x'));assert.throws(()=>svc.download(key,'../../x'));
 fs.writeFileSync(stateFile,JSON.stringify({guestCrop:{x:0,y:0,width:640,height:360}}));assert.notEqual(svc.status().key,key);await assert.rejects(()=>svc.save({key,id:'001',title:'Oud'}),/gewijzigd/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('geldige korte titel vereist; niet-video geweigerd',()=>{assert.throws(()=>thumbnailTitle(''));assert.throws(()=>thumbnailTitle('a'.repeat(71)));assert.throws(()=>thumbnailTitle('a\nb'));assert.throws(()=>thumbnailService('/tmp','x','y',{hasVideo:false}).status(),/video-interviews/);});
