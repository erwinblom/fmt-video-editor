import {elementLayout,imageElement,validateElement} from './elements.mjs';

// The saved transparent PNG is shared by fragment preview and every video export.
export function wrapText(ctx,value,size,font,width){
 ctx.font=`${size}px ${font}`;const rows=[];
 for(const para of value.split('\n')){let line='';for(const word of para.split(/\s+/)){if(ctx.measureText(word).width>width)return null;const next=(line+' '+word).trim();if(ctx.measureText(next).width>width&&line){rows.push(line);line=word;}else line=next;}rows.push(line);}
 return rows;
}
export function fitText(ctx,value,{width,maxSize=64,minSize=28,maxLines=3,font='Head',maxHeight=Infinity}){
 for(let size=maxSize;size>=minSize;size-=2){const rows=wrapText(ctx,value,size,font,width);if(rows&&rows.length<=maxLines&&rows.length*size*1.13<=maxHeight)return {rows,size,height:rows.length*size*1.13};}
 throw Error('Deze tekst past niet. Maak hem korter.');
}
export function imagePlacement(image,box,crop={x:0,y:0,width:1,height:1}){
 const sw=image.width*crop.width,sh=image.height*crop.height,factor=Math.min(box.w/sw,box.h/sh);
 return {sx:image.width*crop.x,sy:image.height*crop.y,sw,sh,x:box.x+(box.w-sw*factor)/2,y:box.y+(box.h-sh*factor)/2,w:sw*factor,h:sh*factor};
}
export function annotationPlacement(annotation,crop,placed){return {x:placed.x+(annotation.x-crop.x)/crop.width*placed.w,y:placed.y+(annotation.y-crop.y)/crop.height*placed.h,w:annotation.width/crop.width*placed.w,h:annotation.height/crop.height*placed.h};}
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Afbeelding kan niet worden geladen'));i.src=src;});
export async function artwork(e,{assetURL=id=>'/api/element-assets/'+id,canvas,load=loadImage,fonts=globalThis.document?.fonts}={}){
 validateElement({...e,artworkId:e.artworkId||'0'.repeat(64)});
 if(fonts)await Promise.all([fonts.load('84px Head'),fonts.load('32px Body')]);
 const c=canvas||document.createElement('canvas');c.width=1920;c.height=900;const x=c.getContext('2d');
 x.fillStyle='#F5F3EE';x.fillRect(0,0,1920,900);
 const g=elementLayout(e);x.fillStyle='#111';x.fillRect(g.x+8,g.y+8,g.width+4,g.height+4);x.fillRect(g.x-4,g.y-4,g.width+8,g.height+8);x.clearRect(g.x,g.y,g.width,g.height);
 x.drawImage(await load('/target.svg'),1746,48,116,116);
 const side=e.layout==='side',left=side?1100:90,width=side?700:1200;
 const text=(value,left,top,width,maxSize=64,minSize=28,maxLines=3,font='Head',color='#111',maxHeight=Infinity)=>{
  const fitted=fitText(x,value,{width,maxSize,minSize,maxLines,font,maxHeight});x.font=`${fitted.size}px ${font}`;x.fillStyle=color;x.textBaseline='top';fitted.rows.forEach((line,i)=>x.fillText(line,left,top+i*fitted.size*1.13));return fitted.height;
 };
 const rule=(x1,y1,x2,y2,color='#E10600',width=4)=>{x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.strokeStyle=color;x.lineWidth=width;x.stroke();};
 const box=(left,top,w,h)=>{x.fillStyle='#111';x.fillRect(left+5,top+5,w,h);x.fillStyle='#fff';x.fillRect(left,top,w,h);x.strokeStyle='#111';x.lineWidth=3;x.strokeRect(left,top,w,h);};
 if(imageElement(e)){
  const im=await load(assetURL(e.assetId)),annotated=e.type==='annotatedProof',b=side?{x:1060,y:245,w:755,h:425}:{x:90,y:170,w:1244,h:650};
  text(e.text,90,45,1560,48,28,2);
  box(b.x,b.y,b.w,b.h);const crop=e.crop||{x:0,y:0,width:1,height:1},p=imagePlacement(im,b,crop);x.drawImage(im,p.sx,p.sy,p.sw,p.sh,p.x,p.y,p.w,p.h);
  if(annotated){const a=annotationPlacement(e.annotation,crop,p);x.strokeStyle='#E10600';x.lineWidth=6;x.strokeRect(a.x,a.y,a.w,a.h);
   if(side){rule(1100,720,1140,720);text(e.annotation.text,1160,694,650,34,26,3);}
   else {text(e.annotation.text,1390,230,440,44,28,4);rule(1360,270,1360,420);rule(1360,420,Math.min(1334,a.x+a.w),Math.min(810,a.y+a.h/2));}
  }
 }else if(e.type==='comparison'){
  text(e.text,1060,175,755,62,34,2);const startY=320,columns=[1060,1450],columnWidth=365;
  text(e.comparison.leftTitle,columns[0],startY,columnWidth,38,28,2);text(e.comparison.rightTitle,columns[1],startY,columnWidth,38,28,2);
  const rowTop=425,rowHeight=Math.min(145,400/e.comparison.rows.length);
  e.comparison.rows.forEach((r,i)=>{const y=rowTop+i*rowHeight;rule(1060,y-16,1815,y-16,'#999',1);text(r.left,columns[0],y,columnWidth,36,26,3,'Body','#111',rowHeight-28);text(r.right,columns[1],y,columnWidth,36,26,3,'Body','#111',rowHeight-28);});
  rule(1431,315,1431,Math.min(822,rowTop+e.comparison.rows.length*rowHeight-20),'#E10600',3);
 }else if(e.type==='diagram'){
  text(e.text,1060,165,755,62,34,2);const steps=e.diagram.steps,h=steps.length>3?91:112,gap=30,start=320;
  steps.forEach((label,i)=>{const top=start+i*(h+gap);box(1080,top,710,h);text(label,1110,top+20,650,42,24,2,'Head','#111',h-30);if(i<steps.length-1){const mid=1435,y=top+h+5;rule(mid,y,mid,y+gap-8);rule(mid,y+gap-8,mid-8,y+gap-16);rule(mid,y+gap-8,mid+8,y+gap-16);}});
  if(e.diagram.feedback){rule(1060,360,1040,360);rule(1040,360,1040,810);rule(1040,810,1080,810);text(e.diagram.feedback,1095,796,690,28,24,1,'Body','#B90500');}
 }else{
  x.fillStyle='#E10600';x.fillRect(left-40,215,10,520);
  if(e.type==='number'){const used=text(e.value,left,220,width,240,64,1,'Head','#E10600');text(e.label,left,240+used,width,72,42,3);}else text(e.text,left,250,width,84,48,5);
 }
 if(e.source.trim())text(e.source,imageElement(e)?90:left,imageElement(e)||['comparison','diagram'].includes(e.type)?850:810,imageElement(e)?1650:width,26,18,imageElement(e)||['comparison','diagram'].includes(e.type)?1:2,'Body','#333');
 return c.toDataURL('image/png');
}
