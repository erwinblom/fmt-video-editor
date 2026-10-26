import {readStyle} from './own-style.mjs';
import {cardReel} from './card-reel.mjs';
import {exportContext} from './export-jobs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {exportPlan} from './export-plan.mjs';
import {python} from './runtime-config.mjs';
const pending=new Map();
export const transitionFile=(root,key)=>path.join(root,'data','transition-previews',key,'preview.mp4');
export async function transitionPreview(appRoot,root,source,input,state,catalog,metadata={}){
 if(input.revision!==state.revision||input.mode!==state.mode)throw Error('De montage is gewijzigd. Heropen de overgang.');
 if(catalog.hasVideo===false)throw Error('Dit interview heeft geen videobeeld.');
 const plan=exportPlan(state,catalog,{preview:true}),i=plan.events.findIndex(e=>e.kind==='clip'&&e.id===input.id&&e.blockId===input.blockId);
 if(i<0||!['clip','topic'].includes(plan.events[i+1]?.kind))throw Error('Kies een quote met een volgende quote of hoofdstukkaart.');
 const events=plan.events.slice(i,i+2);
 return renderPreviewEvents(appRoot,root,source,events,plan,catalog,metadata);
}
export async function renderPreviewEvents(appRoot,root,source,events,plan,catalog,metadata={},windows=null){
 const stat=fs.statSync(source);
 let cards=null;
 if(events[1]?.kind==='topic'){const context=exportContext(source,metadata,catalog);cards=await cardReel(appRoot,root,{guest:context.guest,organization:context.organization,intro:context.intro,subjects:plan.subjects,style:readStyle(appRoot)});}
 const key=createHash('sha256').update(JSON.stringify({version:6,cards,windows,source,bytes:stat.size,mtime:stat.mtimeMs,events,language:plan.subtitleLanguage})).digest('hex');
 const dir=path.dirname(transitionFile(root,key));
 if(fs.existsSync(transitionFile(root,key)))return {key,captionDraft:events.some(e=>e.kind==='clip'&&!e.subtitleCues)};
 if(!pending.has(dir))pending.set(dir,(async()=>{
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'request.json'),JSON.stringify({events,windows,catalog,source,cards,assets:path.join(root,'data/element-assets'),subtitleLanguage:plan.subtitleLanguage}));
  await new Promise((resolve,reject)=>{const child=spawn(python,[path.join(appRoot,'render-transition.py'),dir],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>error=(error+b).slice(-2000));child.on('error',reject);child.on('close',code=>code?reject(Error('Overgang kon niet worden gemaakt: '+error.slice(-350))):resolve());});
 })().finally(()=>pending.delete(dir)));
 await pending.get(dir);return {key,captionDraft:events.some(e=>e.kind==='clip'&&!e.subtitleCues)};
}
