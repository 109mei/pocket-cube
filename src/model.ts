/** Integer, right-handed cube coordinates. Colors are fixed to stickers, never to meshes. */
export type Vec3i = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type Move = { axis: Axis; layer: -1 | 0 | 1; direction: -1 | 1 };
export type Sticker = { id: number; color: number; position: Vec3i; normal: Vec3i };
export type CubeState = Sticker[];
export const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };
export const FACE_NORMALS: Vec3i[] = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const FACE_COLORS = ['#ed7253','#de4260','#fff5d4','#f3c443','#46b8a5','#5798dc'];
export function createSolved(): CubeState {
 const stickers: CubeState = [];
 FACE_NORMALS.forEach((normal,color)=>{
  const fixed = normal.findIndex(n=>n!==0), free=[0,1,2].filter(a=>a!==fixed);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
   const position:Vec3i=[0,0,0];position[fixed]=normal[fixed];position[free[0]]=a;position[free[1]]=b;
   stickers.push({id:stickers.length,color,position,normal:[...normal]});
  }
 });
 return stickers;
}
export function rotateVector(v: Vec3i, axis: Axis, direction: number): Vec3i {
 const [x,y,z]=v; const d=direction;
 const out:Vec3i=axis==='x'?[x,-d*z,d*y]:axis==='y'?[d*z,y,-d*x]:[-d*y,d*x,z];
 return out.map(n=>n===0?0:n) as Vec3i; // Normalize -0 for exact state equality.
}
export function applyMove(state: CubeState, move: Move): CubeState {
 const index=AXIS_INDEX[move.axis];
 return state.map(s=>s.position[index]!==move.layer?s:{...s,position:rotateVector(s.position,move.axis,move.direction),normal:rotateVector(s.normal,move.axis,move.direction)});
}
export function inverse(move: Move): Move { return {...move,direction:-move.direction as -1|1}; }
export function isSolved(state: CubeState): boolean {
 return FACE_NORMALS.every(n=>{const face=state.filter(s=>s.normal.every((v,i)=>v===n[i]));return face.length===9&&face.every(s=>s.color===face[0].color);});
}
export function makeScramble(count=25,rng:()=>number=Math.random): Move[] {
 const sequence:Move[]=[];const axes:Axis[]=['x','y','z'];
 for(let i=0;i<count;i++){
  const available=axes.filter(a=>a!==sequence[i-1]?.axis);const axis=available[Math.floor(rng()*available.length)];
  sequence.push({axis,layer:(rng()<0.5?-1:1),direction:(rng()<0.5?-1:1)});
 }
 return sequence;
}
export function validMove(value: unknown): value is Move {
 if(!value||typeof value!=='object')return false;
 const v=value as Move;return ['x','y','z'].includes(v.axis)&&[-1,0,1].includes(v.layer)&&[-1,1].includes(v.direction);
}
