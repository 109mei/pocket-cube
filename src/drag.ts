import { AXIS_INDEX, type Move } from './model';
import type { Hit } from './input';
export type DragProjection={axis:Move['axis'];dx:number;dy:number;pixelsPerRadian:number};
export type DragLock={move:Move;unit:{x:number;y:number};pixelsPerRadian:number};
export type DragRelease={move:Move;fromAngle:number;cancel:boolean};
export function inferDrag(hit:Hit,delta:{x:number;y:number},projections:DragProjection[]):DragLock|null{
 const distance=Math.hypot(delta.x,delta.y);if(distance<4)return null;
 const candidates=projections.filter(p=>p.pixelsPerRadian>=6).map(p=>({...p,score:(p.dx*delta.x+p.dy*delta.y)/(Math.hypot(p.dx,p.dy)*distance)})).filter(p=>Number.isFinite(p.score)).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));
 if(!candidates.length||Math.abs(candidates[0].score)<.6)return null;
 if(distance<10&&candidates[1]&&Math.abs(candidates[0].score)-Math.abs(candidates[1].score)<.1)return null;
 const best=candidates[0],length=Math.hypot(best.dx,best.dy);
 return{move:{axis:best.axis,layer:hit.position[AXIS_INDEX[best.axis]] as Move['layer'],direction:1},unit:{x:best.dx/length,y:best.dy/length},pixelsPerRadian:Math.max(35,best.pixelsPerRadian)};
}
export function dragAngle(lock:DragLock,delta:{x:number;y:number}):number{
 const angle=(delta.x*lock.unit.x+delta.y*lock.unit.y)/lock.pixelsPerRadian;
 return Math.max(-Math.PI/2,Math.min(Math.PI/2,angle));
}
export function releaseDrag(lock:DragLock,angle:number,canceled=false):DragRelease{
 return{move:{...lock.move,direction:angle>=0?1:-1},fromAngle:angle,cancel:canceled||Math.abs(angle)<Math.PI/4};
}
export function interpolateAngle(from:number,to:number,progress:number):number{
 const t=Math.max(0,Math.min(1,progress));return from+(to-from)*(1-(1-t)**3);
}
export function settleDuration(from:number,to:number,quick=false,reducedMotion=false):number{
 const remaining=Math.abs(to-from);
 if(reducedMotion||remaining<.001)return 0;
 return(quick?90:180)*Math.min(1,remaining/(Math.PI/2));
}
