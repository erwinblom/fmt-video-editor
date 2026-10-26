import fs from 'node:fs';
import path from 'node:path';
export function validateStyle(input){
 if(!input||typeof input!=='object')throw Error('Ongeldige stijl.');
 const name=typeof input.name==='string'?input.name.trim():'',website=typeof input.website==='string'?input.website.trim():'';
 if(name.length>60||/[\r\n]/.test(name))throw Error('Gebruik maximaal 60 tekens op één regel voor de naam.');
 if(website.length>100||/\s/.test(website))throw Error('Gebruik een website zonder spaties, maximaal 100 tekens.');
 const logo=input.logo||'';
 if(typeof logo!=='string'||logo.length>2800000)throw Error('Het logo is te groot. Kies een kleiner beeld.');
 if(logo){if(!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(logo))throw Error('Gebruik een PNG-logo.');const bytes=Buffer.from(logo.split(',')[1],'base64');if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Ongeldig PNG-logo.');}
 return {name,website,logo};
}
export function readStyle(appRoot){const f=path.join(appRoot,'data/eigen-stijl.json');return fs.existsSync(f)?validateStyle(JSON.parse(fs.readFileSync(f,'utf8'))):{name:'',website:'',logo:''};}
export function saveStyle(appRoot,input){const style=validateStyle(input),dir=path.join(appRoot,'data');fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'eigen-stijl.json');fs.writeFileSync(f+'.tmp',JSON.stringify(style),{mode:0o600});fs.renameSync(f+'.tmp',f);return style;}
