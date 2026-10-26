import {buildProposal,angleRanking} from './proposals.mjs';
import {mayProposeQuote} from './speakers.mjs';

// Store the evidence and settings that the reader actually approved.
export function storylineKey(state,catalog,bank){
 const text=JSON.stringify({mode:state.mode,target:state.target,angle:state.modes[state.mode].selectionAngle||'',bank,catalog:catalog.catalog,quotes:catalog.quotes,speakers:catalog.speakers});
 let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `${text.length}:${a>>>0}:${b>>>0}`;
}
export function storylineCore(story){return story.topicCore?story.chapters.map(c=>c.title).join(' → '):story.core;}
export function proposeStoryline(state,catalog,bank){
 if(!bank?.units?.length)throw Error('Maak eerst de onderwerpenanalyse.');
 const angle=state.modes[state.mode].selectionAngle||'';
 if(bank.kind==='thematic'&&angle.trim()!==(bank.direction||'').trim())throw Error('Laat deze redactie-aanwijzing eerst analyseren.');
 let pool=state.mode==='quoteverhaal'&&bank.quoteUnits?bank.quoteUnits:bank.units;
 if(bank.kind!=='thematic'&&angle)pool=angleRanking(pool,angle,catalog);
 pool=pool.filter(u=>u.eligible!==false&&(u.priority??100)>=50&&u.clips.some(c=>{const id=state.mode==='quoteverhaal'?c.quoteId:c.conversationId;return catalog.quotes[id]&&(state.mode!=='quoteverhaal'||mayProposeQuote(catalog,catalog.quotes[id]));}));
 const themes=catalog.catalog[state.mode].map(b=>{
  const units=pool.filter(u=>u.blockId===b.id).sort((a,b)=>b.priority-a.priority);
  if(!units.length)return null;
  const u=units[0],c=u.clips.find(c=>catalog.quotes[state.mode==='quoteverhaal'?c.quoteId:c.conversationId]);
  return {id:b.id,title:b.title,reason:u.reason||b.reason||'Dit onderwerp wordt gedragen door de onderstaande bronpassage.',order:u.order??catalog.catalog[state.mode].indexOf(b),priority:u.priority,example:{id:state.mode==='quoteverhaal'?c.quoteId:c.conversationId,start:c.start,end:c.end,text:c.text||c.nl||catalog.quotes[state.mode==='quoteverhaal'?c.quoteId:c.conversationId].text}};
 }).filter(Boolean);
 if(!themes.length)throw Error('Geen geschikte onderwerpen voor deze montagevorm. Controleer bij Sprekers de rol Geïnterviewde.');
 const limit=Math.min(5,Math.max(1,Math.floor(state.target/60)));
 const best=new Set([...themes].sort((a,b)=>b.priority-a.priority).slice(0,limit).map(b=>b.id));
 const chapters=themes.filter(b=>best.has(b.id)).sort((a,b)=>a.order-b.order);
 return {version:1,status:'draft',topicCore:bank.kind==='thematic',key:storylineKey(state,catalog,bank),core:bank.kind==='thematic'?chapters.map(c=>c.title).join(' → '):(bank.summary||catalog.title),chapters,createdAt:new Date().toISOString()};
}
export function selectApprovedStoryline(state,catalog,bank,story){
 if(story?.status!=='approved')throw Error('Geef eerst akkoord op de verhaallijn.');
 if(story.key!==storylineKey(state,catalog,bank))throw Error('Instellingen, sprekers of analyse zijn gewijzigd. Maak eerst een nieuw verhaallijnvoorstel.');
 if(!story.chapters?.length||new Set(story.chapters.map(c=>c.id)).size!==story.chapters.length)throw Error('Kies minstens één uniek onderwerp.');
 const ids=story.chapters.map(c=>c.id),chosen=new Set(ids),copy=structuredClone(bank);
 copy.units=copy.units.filter(u=>chosen.has(u.blockId));
 if(copy.quoteUnits)copy.quoteUnits=copy.quoteUnits.filter(u=>chosen.has(u.blockId));
 if(copy.teaserUnits)copy.teaserUnits=copy.teaserUnits.filter(u=>chosen.has(u.blockId)||copy.units.some(p=>p.id===u.parentId));
 if(copy.teaser)copy.teaser=copy.teaser.filter(t=>copy.units.some(u=>u.clips.some(c=>t.start>=c.start&&t.end<=c.end)));
 const montage=buildProposal(state,catalog,copy,state.target,state.modes[state.mode].selectionAngle||'');
 if(ids.some(id=>!montage.blocks.some(b=>b.id===id)))throw Error('Niet alle onderwerpen passen met complete passages binnen de tijdlimiet. Pas de verhaallijn aan of kies meer tijd; je montage blijft behouden.');
 montage.blocks.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
 montage.selectionAngle=state.modes[state.mode].selectionAngle||'';
 montage.storyline={...structuredClone(story),core:storylineCore(story),approvedAt:new Date().toISOString()};
 return montage;
}
