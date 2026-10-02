import { it, expect } from 'vitest';
import { inferDrag, dragAngle, releaseDrag, interpolateAngle } from './drag';
import type { Hit } from './input';
const hit:Hit={position:[1,0,1],normal:[0,0,1]};
const projections=[{axis:'x' as const,dx:0,dy:1,pixelsPerRadian:100},{axis:'y' as const,dx:1,dy:0,pixelsPerRadian:100}];
it('grabs a layer after four pixels and does not wait for release',()=>{expect(inferDrag(hit,{x:3,y:0},projections)).toBeNull();expect(inferDrag(hit,{x:5,y:0},projections)?.move).toEqual({axis:'y',layer:0,direction:1});});
it('waits out a tiny ambiguous diagonal then predicts the closest stable axis',()=>{expect(inferDrag(hit,{x:4,y:4},projections)).toBeNull();expect(inferDrag(hit,{x:11,y:10},projections)?.move.axis).toBe('y');});
it('partial rotation tracks projected displacement proportionally in both directions',()=>{const lock=inferDrag(hit,{x:6,y:0},projections)!;expect(dragAngle(lock,{x:50,y:4})).toBeCloseTo(.5);expect(dragAngle(lock,{x:-30,y:60})).toBeCloseTo(-.3);expect(dragAngle(lock,{x:1000,y:0})).toBeCloseTo(Math.PI/2);});
it('keeps the acquired axis while the finger changes direction',()=>{const lock=inferDrag(hit,{x:6,y:0},projections)!;expect(dragAngle(lock,{x:0,y:90})).toBe(0);expect(lock.move.axis).toBe('y');});
it('accounts for camera projection and the grabbed point scale',()=>{const lock=inferDrag(hit,{x:0,y:-8},[{axis:'y',dx:0,dy:-1,pixelsPerRadian:50},{axis:'x',dx:1,dy:0,pixelsPerRadian:90}])!;expect(dragAngle(lock,{x:0,y:-25})).toBeCloseTo(.5);expect(lock.move.layer).toBe(0);});
it('cancels small rotations and snaps larger ones to the nearest signed quarter turn',()=>{const lock=inferDrag(hit,{x:6,y:0},projections)!;expect(releaseDrag(lock,.6).cancel).toBe(true);expect(releaseDrag(lock,.9)).toEqual({move:{axis:'y',layer:0,direction:1},fromAngle:.9,cancel:false});expect(releaseDrag(lock,-.9).move.direction).toBe(-1);expect(releaseDrag(lock,1.4,true).cancel).toBe(true);});
it('settling starts at the held angle without jumping back to zero',()=>{expect(interpolateAngle(.8,Math.PI/2,0)).toBe(.8);expect(interpolateAngle(.8,Math.PI/2,1)).toBeCloseTo(Math.PI/2);expect(interpolateAngle(.8,0,.5)).toBeLessThan(.8);});
it('does not lock input after a fully reached snap angle and scales remaining settle time',async()=>{
 const {settleDuration}=await import('./drag');
 expect(settleDuration(Math.PI/2,Math.PI/2,true)).toBe(0);
 expect(settleDuration(Math.PI/4,Math.PI/2,true)).toBeCloseTo(45);
 expect(settleDuration(.001,0,true)).toBeLessThan(1);
 expect(settleDuration(0,Math.PI/2,true,true)).toBe(0);
});
