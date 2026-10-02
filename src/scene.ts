import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { AXIS_INDEX, FACE_COLORS, type CubeState, type Move, type Vec3i } from './model';
import type { Hit } from './input';
import { CUBIE_STEP as STEP, BODY_SIZE, BODY_RADIUS, STICKER_SIZE, STICKER_DEPTH, STICKER_OFFSET, STICKER_RADIUS } from './geometry';
const vector=(v:Vec3i)=>new THREE.Vector3(...v);
/** Pure Three.js scene graph: testable without WebGL, canvas, clocks or browser state. */
export class CubeScene extends THREE.Group{
 readonly root=new THREE.Group();readonly pivot=new THREE.Group();
 private bodies:THREE.Mesh[]=[];
 private stickers:THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>[]=[];
 private bodyGeometry=new RoundedBoxGeometry(BODY_SIZE,BODY_SIZE,BODY_SIZE,3,BODY_RADIUS);
 private stickerGeometry=new RoundedBoxGeometry(STICKER_SIZE,STICKER_SIZE,STICKER_DEPTH,3,STICKER_RADIUS);
 private bodyMaterial=new THREE.MeshStandardMaterial({color:0x253633,roughness:.62,metalness:.04});
 private currentMove:Move|null=null;
 constructor(){
  super();this.add(this.root,this.pivot);
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   if(x===0&&y===0&&z===0)continue;
   const mesh=new THREE.Mesh(this.bodyGeometry,this.bodyMaterial);mesh.userData.position=[x,y,z];mesh.position.set(x*STEP,y*STEP,z*STEP);this.bodies.push(mesh);this.root.add(mesh);
  }
 }
 sync(state:CubeState){
  for(const mesh of this.bodies){this.root.add(mesh);mesh.rotation.set(0,0,0);mesh.position.copy(vector(mesh.userData.position).multiplyScalar(STEP));}
  if(!this.stickers.length){for(const sticker of state){const mesh=new THREE.Mesh(this.stickerGeometry,new THREE.MeshStandardMaterial({color:FACE_COLORS[sticker.color],roughness:.36,metalness:.02}));this.stickers.push(mesh);}}
  for(const sticker of state){const mesh=this.stickers[sticker.id];this.root.add(mesh);mesh.userData.sticker=sticker;mesh.position.copy(vector(sticker.position).multiplyScalar(STEP).addScaledVector(vector(sticker.normal),STICKER_OFFSET));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),vector(sticker.normal));}
  this.pivot.rotation.set(0,0,0);this.currentMove=null;this.highlight(null);this.updateMatrixWorld(true);
 }
 beginTurn(move:Move){
  this.currentMove=move;this.highlight(null);const index=AXIS_INDEX[move.axis];this.pivot.rotation.set(0,0,0);
  for(const mesh of this.bodies)if(mesh.userData.position[index]===move.layer)this.pivot.add(mesh);
  for(const mesh of this.stickers)if(mesh.userData.sticker.position[index]===move.layer)this.pivot.add(mesh);
 }
 setTurnAngle(angle:number){if(this.currentMove)this.pivot.rotation[this.currentMove.axis]=angle;}
 pick(raycaster:THREE.Raycaster):Hit|null{
  // The plastic body participates in occlusion: a seam must never select a hidden sticker.
  const hit=raycaster.intersectObjects([...this.stickers,...this.bodies],false)[0];if(!hit)return null;
  const s=hit.object.userData.sticker;if(s)return{position:[...s.position] as Vec3i,normal:[...s.normal] as Vec3i,point:hit.point.toArray() as Vec3i};
  // Rounded plastic normals bend toward neighboring cubies. The logical exterior
  // face instead follows the furthest coordinate of the actual hit point.
  const normal:Vec3i=[0,0,0],components=hit.point.toArray();const index=components.map(Math.abs).indexOf(Math.max(...components.map(Math.abs)));normal[index]=Math.sign(components[index]);
  return{position:[...hit.object.userData.position] as Vec3i,normal,point:hit.point.toArray() as Vec3i};
 }
 highlight(normal:Vec3i|null){for(const mesh of this.stickers){const s=mesh.userData.sticker;if(!s)continue;const active=normal&&s.normal.every((n:number,i:number)=>n===normal[i]);mesh.material.emissive.set(active?'#f7e9c9':'#000000');mesh.material.emissiveIntensity=active?.16:0;}}
 /** A layer pivot rotates around the origin, so every vertex radius is invariant.
  * Actual geometry bounding-box corners conservatively enclose all intermediate poses. */
 boundingRadius(){
  this.updateMatrixWorld(true);let radius=0;const point=new THREE.Vector3();
  for(const mesh of [...this.bodies,...this.stickers]){
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox!;
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    point.set(x,y,z).applyMatrix4(mesh.matrixWorld);radius=Math.max(radius,point.length());
   }
  }
  return radius;
 }
 snapshot(){return this.stickers.map(m=>({id:m.userData.sticker.id,position:m.position.toArray(),normal:new THREE.Vector3(0,0,1).applyQuaternion(m.quaternion).toArray(),parent:m.parent===this.root?'root':'pivot'}));}
 dispose(){this.bodyGeometry.dispose();this.stickerGeometry.dispose();this.bodyMaterial.dispose();for(const m of this.stickers)m.material.dispose();}
}
