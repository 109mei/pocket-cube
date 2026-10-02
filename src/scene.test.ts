import { it, expect } from 'vitest';
import * as THREE from 'three';
import { CubeScene } from './scene';
import {CUBIE_STEP,STICKER_OFFSET} from './geometry';
import { applyMove, createSolved, makeScramble, type Move } from './model';
it('keeps 54 exact sticker transforms after animated turn commits without pose drift',()=>{
 const scene=new CubeScene();let state=createSolved();scene.sync(state);
 for(const move of makeScramble(80,()=>.32)){
  scene.beginTurn(move);scene.setTurnAngle(move.direction*Math.PI/2);state=applyMove(state,move);scene.sync(state);
  const snapshot=scene.snapshot();expect(snapshot).toHaveLength(54);
  for(const s of state){const pose=snapshot.find(p=>p.id===s.id)!;expect(pose.parent).toBe('root');for(let i=0;i<3;i++){expect(pose.position[i]).toBeCloseTo(s.position[i]*CUBIE_STEP+s.normal[i]*STICKER_OFFSET,10);expect(pose.normal[i]).toBeCloseTo(s.normal[i],10);}}
 }
 scene.dispose();
});
it('temporary pivot contains exactly one layer and snaps back on canceled animation',()=>{
 const scene=new CubeScene();const state=createSolved();scene.sync(state);const move:Move={axis:'x',layer:0,direction:1};scene.beginTurn(move);scene.setTurnAngle(.43);
 expect(scene.pivot.children).toHaveLength(20);scene.sync(state);expect(scene.pivot.children).toHaveLength(0);expect(scene.snapshot().every(p=>p.parent==='root')).toBe(true);scene.dispose();
});
it('ray on plastic border selects the visible front cell instead of a hidden back sticker',()=>{
 const scene=new CubeScene();scene.sync(createSolved());scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(.48,0,10),new THREE.Vector3(0,0,-1));
 expect(scene.pick(ray)).toMatchObject({position:[0,0,1],normal:[0,0,1]});expect(scene.pick(ray)!.point![0]).toBeCloseTo(.48);scene.dispose();
});
it('empty background has no cube hit',()=>{const scene=new CubeScene();scene.sync(createSolved());scene.updateMatrixWorld(true);expect(scene.pick(new THREE.Raycaster(new THREE.Vector3(8,0,10),new THREE.Vector3(0,0,-1)))).toBeNull();scene.dispose();});
