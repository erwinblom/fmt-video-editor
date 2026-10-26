import fs from 'node:fs';
import {createHash} from 'node:crypto';
const text=fs.readFileSync(new URL('../REDACTIEREGELS.md',import.meta.url),'utf8');
const version=Number(text.match(/^version: (\d+)$/m)?.[1]);
if(!version)throw Error('Redactieregels missen een versienummer.');
const hash=createHash('sha256').update(text).digest('hex');
export const editorialRules=()=>({version,hash});
export function editorialPrompt(section){
 const start='<!-- prompt:'+section+' -->',end='<!-- endprompt:'+section+' -->';
 if(!text.includes(start)||!text.includes(end))throw Error('Redactieregels ontbreken: '+section);
 return text.split(start)[1].split(end)[0].trim();
}
export function withEditorialRules(ask){
 const wrapped=(prompt,...args)=>ask(['teaser-select','teaser-review'].some(section=>prompt.startsWith(editorialPrompt(section)))?prompt:editorialPrompt('general')+'\n\n'+editorialPrompt('format')+'\n\n'+prompt,...args);
 wrapped.sourceOrder=(prompt,...args)=>ask(editorialPrompt('general')+'\n\nDeze stap bepaalt uitsluitend bronindeling. Behoud de opnamevolgorde strikt; verhaalvolgorde en onderwerpselectie komen pas later.\n\n'+prompt,...args);
 wrapped.editorial=ask;
 return wrapped;
}
export const editorialCache=cache=>({get:key=>cache.get?.(hash+':'+key),set:(key,value)=>cache.set?.(hash+':'+key,value)});
