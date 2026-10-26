export const ELEMENT_TYPES={statement:'Kernzin',number:'Cijferkaart',proof:'Bewijsbeeld',annotatedProof:'Bewijsbeeld met annotatie',comparison:'Vergelijking',diagram:'Uitlegschema'};
export const assetId=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
export const imageElement=e=>['proof','annotatedProof'].includes(e.type);
export function elementLayout(e){return e.layout==='inset'?{x:1410,y:500,width:420,height:236}:{x:90,y:215,width:900,height:506};}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function text(v,max,required=false){return typeof v==='string'&&v.length<=max&&(!required||!!v.trim());}
function keys(o,allowed){return object(o)&&Object.keys(o).every(k=>allowed.includes(k));}
export function validateElementRect(rect,name='Uitsnede'){
 if(!keys(rect,['x','y','width','height'])||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.x<0||rect.y<0||rect.width<=0||rect.height<=0||rect.x+rect.width>1+1e-6||rect.y+rect.height>1+1e-6)throw Error(`${name} moet binnen de afbeelding vallen`);
}
export function validateElement(e){
 if(e==null)return;
 if(!object(e)||!Object.hasOwn(ELEMENT_TYPES,e.type)||!['side','inset'].includes(e.layout))throw Error('Ongeldig element');
 if(!keys(e,['type','layout','start','end','text','value','label','source','assetId','artworkId','sourceUrl','crop','annotation','comparison','diagram']))throw Error('Onbekende elementvelden');
 for(const [k,max]of Object.entries({text:120,value:16,label:80,source:180}))if(!text(e[k],max))throw Error('Elementtekst is te lang of ontbreekt');
 if(!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end-e.start<.04-1e-6||e.end>7200)throw Error('Kies een geldig begin en einde voor het element');
 if(!assetId(e.artworkId)||imageElement(e)&&!assetId(e.assetId)||e.assetId!==null&&!assetId(e.assetId))throw Error('Elementbeeld ontbreekt');
 if(e.type==='statement'&&!e.text.trim()||e.type==='number'&&(!e.value.trim()||!e.label.trim())||imageElement(e)&&(!e.text.trim()||!e.source.trim()))throw Error('Vul de tekst en bron van het element in');
 if(e.sourceUrl!==undefined){if(!text(e.sourceUrl,2000))throw Error('Ongeldige bronlink');if(e.sourceUrl){let u;try{u=new URL(e.sourceUrl);}catch{throw Error('Gebruik een volledige bronlink');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Gebruik een openbare http- of https-bronlink');}}
 if(e.crop!==undefined)validateElementRect(e.crop);
 if(e.annotation!==undefined){if(!keys(e.annotation,['x','y','width','height','text'])||!text(e.annotation.text,100,true))throw Error('Vul een korte annotatie in');const {text:_,...rect}=e.annotation;validateElementRect(rect,'Annotatie');}
 if(e.comparison!==undefined){const c=e.comparison;if(!keys(c,['leftTitle','rightTitle','rows'])||!text(c.leftTitle,50,true)||!text(c.rightTitle,50,true)||!Array.isArray(c.rows)||c.rows.length<1||c.rows.length>3||c.rows.some(r=>!keys(r,['left','right'])||!text(r.left,100,true)||!text(r.right,100,true)))throw Error('Vul twee kolomtitels en één tot drie vergelijkingsregels in');}
 if(e.diagram!==undefined){const d=e.diagram;if(!keys(d,['steps','feedback'])||!Array.isArray(d.steps)||d.steps.length<2||d.steps.length>4||d.steps.some(s=>!text(s,70,true))||!text(d.feedback,80))throw Error('Vul twee tot vier stappen en eventueel een terugkoppeling in');}
 if(e.type==='annotatedProof'&&(!e.crop||!e.annotation))throw Error('Kies een uitsnede en annotatie voor het bewijsbeeld');
 if(e.type==='comparison'&&(!e.text.trim()||!e.comparison)||e.type==='diagram'&&(!e.text.trim()||!e.diagram))throw Error('Vul de kop en inhoud van het element in');
 if(['comparison','diagram'].includes(e.type)&&e.layout!=='side')throw Error('Bij deze vorm staat de spreker naast het element');
 if(e.type==='annotatedProof'&&e.annotation&&e.crop){const a=e.annotation,c=e.crop;if(a.x<c.x-1e-6||a.y<c.y-1e-6||a.x+a.width>c.x+c.width+1e-6||a.y+a.height>c.y+c.height+1e-6)throw Error('De annotatie moet binnen de gekozen uitsnede liggen');}
}
export function resolveElement(e,duration){if(!e)return null;validateElement(e);const end=Math.min(e.end,duration),start=Math.min(e.start,Math.max(0,end-.04));return {...e,start,end,geometry:elementLayout(e)};}
export function elementActive(e,time){return !!e&&time+1e-5>=e.start&&time<e.end-1e-5;}
