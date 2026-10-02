import * as THREE from 'three';
import { AXIS_INDEX, type Axis } from './model';
import type { Hit } from './input';
import type { DragProjection } from './drag';
import { CUBIE_STEP, STICKER_OFFSET } from './geometry';
/** Screen-space derivative of rotation around each eligible layer axis at the actual grab point. */
export function projectedDragTangents(hit:Hit,camera:THREE.Camera,viewport:{width:number;height:number}):DragProjection[]{
 const point=hit.point?new THREE.Vector3(...hit.point):new THREE.Vector3(...hit.position).multiplyScalar(CUBIE_STEP).addScaledVector(new THREE.Vector3(...hit.normal),STICKER_OFFSET);
 const start=point.clone().project(camera),epsilon=.0001;
 return(['x','y','z'] as Axis[]).filter(axis=>hit.normal[AXIS_INDEX[axis]]===0).map(axis=>{
  const unit=new THREE.Vector3();unit.setComponent(AXIS_INDEX[axis],1);
  const velocity=unit.cross(point);const end=point.clone().addScaledVector(velocity,epsilon).project(camera);
  const dx=(end.x-start.x)*viewport.width/2/epsilon,dy=-(end.y-start.y)*viewport.height/2/epsilon;
  return{axis,dx,dy,pixelsPerRadian:Math.hypot(dx,dy)};
 });
}
