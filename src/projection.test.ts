import { it, expect } from 'vitest';
import * as THREE from 'three';
import { projectedDragTangents } from './projection';
import type { Hit } from './input';
it('uses the actual grab point and matches projected infinitesimal rotation',()=>{
 const camera=new THREE.PerspectiveCamera(34,390/420,.1,100);camera.position.set(5,4,7);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const hit:Hit={position:[1,1,1],normal:[0,0,1],point:[1.35,.81,1.57]};
 const result=projectedDragTangents(hit,camera,{width:390,height:420});const p=new THREE.Vector3(...hit.point!);const base=p.clone().project(camera),epsilon=.0001;
 for(const t of result){const axis=new THREE.Vector3(t.axis==='x'?1:0,t.axis==='y'?1:0,t.axis==='z'?1:0);const end=p.clone().applyAxisAngle(axis,epsilon).project(camera);expect(t.dx).toBeCloseTo((end.x-base.x)*390/2/epsilon,1);expect(t.dy).toBeCloseTo(-(end.y-base.y)*420/2/epsilon,1);expect(t.pixelsPerRadian).toBeCloseTo(Math.hypot(t.dx,t.dy));}
 const center=projectedDragTangents({...hit,point:[0,0,1.57]},camera,{width:390,height:420});expect(result[0].pixelsPerRadian).not.toBeCloseTo(center[0].pixelsPerRadian,0);
});
