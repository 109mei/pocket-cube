import { AXIS_INDEX, FACE_NORMALS, type Axis, type Move, type Vec3i } from './model';
export type Hit={position:Vec3i;normal:Vec3i};
export type ProjectedTangent={axis:Axis;dx:number;dy:number};
export function beginPointer(hasActive:boolean,isPrimary:boolean){return !hasActive&&isPrimary;}
export function resolveSwipe(hit:Hit,delta:{x:number;y:number},tangents:ProjectedTangent[]):Move|null{
 const length=Math.hypot(delta.x,delta.y);if(length<14)return null;
 const scored=tangents.map(t=>({...t,dot:(t.dx*delta.x+t.dy*delta.y)/(Math.hypot(t.dx,t.dy)*length)})).filter(t=>Number.isFinite(t.dot)).sort((a,b)=>Math.abs(b.dot)-Math.abs(a.dot));
 if(!scored.length||Math.abs(scored[0].dot)<0.7||(scored[1]&&Math.abs(scored[0].dot)-Math.abs(scored[1].dot)<0.18))return null;
 const best=scored[0];return{axis:best.axis,layer:hit.position[AXIS_INDEX[best.axis]] as Move['layer'],direction:best.dot>0?1:-1};
}

export function resolveTapFace(hit:Hit,delta:{x:number;y:number}):number|null{
 if(Math.hypot(delta.x,delta.y)>=14)return null;
 const index=FACE_NORMALS.findIndex(n=>n.every((v,i)=>v===hit.normal[i]));return index<0?null:index;
}
export function swipeArrow(delta:{x:number;y:number}):'↑'|'↓'|'←'|'→'{
 return Math.abs(delta.x)>Math.abs(delta.y)?(delta.x>0?'→':'←'):(delta.y>0?'↓':'↑');
}
