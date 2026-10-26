import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectRoot,command} from '../app/runtime-config.mjs';
const data=path.join(projectRoot,'app/data');
if(fs.existsSync(path.join(data,'catalog.json'))||fs.existsSync(path.join(data,'demo'))){
 console.error('Demo bestaat al of er staat een montage. Er is niets vervangen.');process.exit(1);
}
const folder=path.join(data,'demo');fs.mkdirSync(folder,{recursive:true});
const tmp=path.join(folder,'source.part.mp4');
const r=spawnSync(command('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=0xF5E8DD:s=640x360:r=25','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','45','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',tmp],{encoding:'utf8',timeout:120000});
if(r.status!==0){fs.rmSync(folder,{recursive:true,force:true});console.error('Fictieve demo maken mislukt. Controleer FFmpeg; er zijn geen eerdere projecten gewijzigd.');process.exit(1);}
fs.renameSync(tmp,path.join(folder,'source.mp4'));
const quotes={
 a:{id:'a',speaker:'Gast',start:2,end:10,text:'Synthetic interface example: neighbours share a repair bench.',nl:'Fictieve demotekst: buurtbewoners delen een reparatietafel.'},
 b:{id:'b',speaker:'Interviewer',start:12,end:18,text:'Synthetic interface question: how do members borrow tools?',nl:'Fictieve demovraag: hoe lenen buurtbewoners gereedschap?'},
 c:{id:'c',speaker:'Gast',start:20,end:30,text:'Synthetic interface example: a return label records the agreed day.',nl:'Fictieve demotekst: een retourlabel vermeldt de afgesproken dag.'}
};
const blocks=[{id:'repair',title:'Een reparatietafel delen',clipIds:['a']},{id:'borrow',title:'Gereedschap terugbrengen',clipIds:['b','c']}];
const crop={x:0,y:0,width:640,height:360,contain:true};
const catalog={version:1,title:'Demo Werkplaats · volledig fictief',duration:45,source:'/bron.mp4',primarySpeaker:'Gast',quotes,transcript:[],words:[],teaserCandidates:[],synthetic:true,
 details:{guest:'Gast (fictief)',interviewer:'Interviewer (fictief)',topic:'Bedieningsdemo zonder echte opname of gesproken transcript.'},
 catalog:{quoteverhaal:[blocks[0],{...blocks[1],clipIds:['c']}],gespreksmontage:blocks},
 framing:{source:{width:640,height:360},image:{x:208,y:32,width:1504,height:846},caption:{x:200,y:916,width:1520,height:128},presets:{Gast:{wide:crop,medium:crop,close:crop},Interviewer:{wide:crop,medium:crop,close:crop}}}};
const state={version:1,mode:'gespreksmontage',target:120,revision:0,modes:Object.fromEntries(['quoteverhaal','gespreksmontage'].map(mode=>[mode,{subtitleLanguage:'nl',blocks:structuredClone(catalog.catalog[mode]),teaser:[],edits:{}}]))};
for(const [name,value] of Object.entries({'catalog.json':catalog,'montages.json':state,'interview-metadata.json':{id:'demo',title:catalog.title,guest:'Gast (fictief)',interviewer:'Interviewer (fictief)',organization:'Demo Werkplaats',topic:'Gegenereerde stille video; tekst is een fictief interfacevoorbeeld, geen transcript.',intro:'Volledig fictieve bedieningsdemo.',status:'ready',createdAt:0}}))fs.writeFileSync(path.join(data,name),JSON.stringify(value,null,2));
console.log('Fictieve bedieningsdemo gemaakt: 45 seconden kleurbeeld met stilte. Geen personen, echte spraak of externe dienst. Start FMT Video Editor op http://localhost:4319.');
