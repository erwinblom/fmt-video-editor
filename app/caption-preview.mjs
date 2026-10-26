import {spawn} from 'node:child_process';
import path from 'node:path';
import {python} from './runtime-config.mjs';
import {validateRange,resolveQuote,alignedSubtitleCues} from './public/model.mjs';
export async function captionPreview(root,input,state,catalog){
 if(!['quoteverhaal','gespreksmontage'].includes(input.mode)||typeof input.id!=='string'||typeof input.blockId!=='string'||input.blockId.length>100||typeof input.nl!=='string'||input.nl.length>20000)throw Error('Ongeldige ondertitelpreview');
 validateRange(input.start,input.end,catalog.duration);const q=resolveQuote(state,catalog,input.id,input.blockId,input.mode),frames=Math.max(1,Math.round((input.end-input.start)*25));
 const event={kind:'clip',id:input.id,blockId:input.blockId,start:0,frames,duration:frames/25,sourceStart:input.start,sourceEnd:input.end,nl:input.nl,speaker:q.speaker,...(q.start===input.start&&q.end===input.end&&q.nl===input.nl?{subtitleCues:alignedSubtitleCues(q)}:{})};
 return new Promise((resolve,reject)=>{const child=spawn(python,[path.join(root,'caption_layout.py')],{stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);child.on('error',reject);child.stdin.on('error',()=>{});child.on('close',code=>{if(code!==0)return reject(Error('Ondertitelpreview niet beschikbaar: '+error.slice(-200)));try{resolve(JSON.parse(output));}catch{reject(Error('Ondertitelpreview is ongeldig'));}});child.stdin.end(JSON.stringify({format:'json',plan:{events:[event]},catalog}));});
}
