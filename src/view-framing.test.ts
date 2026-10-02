import {it,expect} from 'vitest';
import * as THREE from 'three';
import {CubeView} from './view';
import {CubeScene} from './scene';
import {createSolved,type Axis} from './model';

// Real camera/view methods and actual scene geometry; renderer construction is omitted.
function fixture(width=390,height=300){
 const cube=new CubeScene();cube.sync(createSolved());
 const camera=new THREE.PerspectiveCamera(34,1,.1,100);
 const view=Object.assign(Object.create(CubeView.prototype),{cube,camera,canvas:{getBoundingClientRect:()=>({width,height})},renderer:{setSize(){}}}) as CubeView;
 view.home();view.resize();return{view,cube,camera};
}
function corners(scene:CubeScene){
 scene.updateMatrixWorld(true);const points:THREE.Vector3[]=[];
 scene.traverse(object=>{if(!(object instanceof THREE.Mesh))return;if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();const box=object.geometry.boundingBox!;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(object.matrixWorld));});return points;
}
it('keeps every real mesh bound inside the canvas for every layer mid-turn and camera orientation',()=>{
 let worst=0,minDepth=1,maxDepth=-1;
 for(const [width,height] of [[390,180],[390,420],[320,220],[844,220],[120,380],[390,650]]){
  const {view,cube,camera}=fixture(width,height);
  for(let pose=0;pose<24;pose++){
   view.orbit(51,39);
   for(const axis of ['x','y','z'] as Axis[])for(const layer of [-1,0,1] as const)for(const angle of [-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2]){
    cube.sync(createSolved());cube.beginTurn({axis,layer,direction:1});cube.setTurnAngle(angle);
    for(const point of corners(cube)){const ndc=point.project(camera);worst=Math.max(worst,Math.abs(ndc.x),Math.abs(ndc.y));minDepth=Math.min(minDepth,ndc.z);maxDepth=Math.max(maxDepth,ndc.z);}
   }
  }
  cube.dispose();
 }
 expect(worst).toBeLessThan(.97);expect(minDepth).toBeGreaterThan(-1);expect(maxDepth).toBeLessThan(1);
},30000);
it('orbits continuously over both poles and completes a full vertical circle without a clamp or flip',()=>{
 const {view,cube,camera}=fixture();const start=camera.position.clone().normalize(),orientation=camera.quaternion.clone();
 const step=2*Math.PI/(.009*160);let previous=camera.quaternion.clone();
 for(let i=0;i<160;i++){
  view.orbit(0,step);expect(previous.angleTo(camera.quaternion)).toBeLessThan(.041);previous.copy(camera.quaternion);
  if(i===79)expect(camera.position.clone().normalize().dot(start)).toBeLessThan(-.999999);
 }
 expect(camera.position.clone().normalize().dot(start)).toBeGreaterThan(.999999);expect(orientation.angleTo(camera.quaternion)).toBeLessThan(1e-6);
 cube.dispose();
});
it('keeps camera basis normalized and home exact after mixed full rotations',()=>{
 const {view,cube,camera}=fixture();const home=camera.quaternion.clone();
 for(let i=0;i<5000;i++)view.orbit(Math.sin(i)*17,Math.cos(i)*19);
 expect(camera.quaternion.length()).toBeCloseTo(1,12);
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion),toward=camera.position.clone().negate().normalize();expect(forward.dot(toward)).toBeCloseTo(1,10);
 view.home();expect(home.angleTo(camera.quaternion)).toBeLessThan(1e-7);cube.dispose();
});
it('narrows body seams and sticker borders while keeping sticker fronts outside the body',()=>{
 const {cube}=fixture();const meshes:THREE.Mesh[]=[];cube.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 const center=meshes.find(m=>m.userData.position?.join(',')==='0,0,1')!;
 const right=meshes.find(m=>m.userData.position?.join(',')==='1,0,1')!;
 center.geometry.computeBoundingBox();const body=center.geometry.boundingBox!;
 const seam=right.position.x-center.position.x-body.getSize(new THREE.Vector3()).x;
 expect(seam).toBeGreaterThan(.005);expect(seam).toBeLessThan(.025);
 const sticker=meshes.find(m=>m.userData.sticker?.position.join(',')==='0,0,1'&&m.userData.sticker.normal.join(',')==='0,0,1')!;
 sticker.geometry.computeBoundingBox();const shape=sticker.geometry.boundingBox!;
 expect(shape.getSize(new THREE.Vector3()).x).toBeGreaterThan(.95);
 const front=sticker.position.z+shape.max.z-(center.position.z+body.max.z);expect(front).toBeGreaterThan(.006);expect(front).toBeLessThan(.025);cube.dispose();
});
it('preserves a clear depth-buffer separation between sticker and body in narrow viewports',()=>{
 const {view,cube,camera}=fixture(120,380);view.home();
 const body=new THREE.Vector3(0,0,0).project(camera);
 const front=camera.position.clone().normalize().multiplyScalar(.015).project(camera);
 const depthSteps=Math.abs(front.z-body.z)/2*65535;
 expect(depthSteps).toBeGreaterThan(8);cube.dispose();
});
