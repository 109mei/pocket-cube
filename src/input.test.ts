import { it, expect } from 'vitest';
import { resolveSwipe, beginPointer, type Hit } from './input';
const hit:Hit={position:[1,0,1],normal:[0,0,1]};
const tangents=[{axis:'x' as const,dx:0,dy:1},{axis:'y' as const,dx:1,dy:0}];
it('short and diagonal ambiguous gestures do not turn',()=>{expect(resolveSwipe(hit,{x:8,y:4},tangents)).toBeNull();expect(resolveSwipe(hit,{x:40,y:40},tangents)).toBeNull();});
it('right drag on front turns the matching middle y layer positive',()=>expect(resolveSwipe(hit,{x:40,y:1},tangents)).toEqual({axis:'y',layer:0,direction:1}));
it('opposite swipe inverts direction',()=>expect(resolveSwipe(hit,{x:-40,y:0},tangents)).toEqual({axis:'y',layer:0,direction:-1}));
it('camera projection, not a fixed screen direction, decides the turn',()=>expect(resolveSwipe(hit,{x:0,y:-40},[{axis:'y',dx:0,dy:-1},{axis:'x',dx:1,dy:0}])).toEqual({axis:'y',layer:0,direction:1}));
it('right and upper face layers map through exact hit coordinates',()=>{expect(resolveSwipe({position:[1,-1,0],normal:[1,0,0]},{x:30,y:0},[{axis:'z',dx:1,dy:0},{axis:'y',dx:0,dy:1}])).toEqual({axis:'z',layer:0,direction:1});expect(resolveSwipe({position:[-1,1,0],normal:[0,1,0]},{x:0,y:30},[{axis:'z',dx:1,dy:0},{axis:'x',dx:0,dy:1}])).toEqual({axis:'x',layer:-1,direction:1});});
it('second pointer and non-primary pointers cannot start another gesture',()=>{expect(beginPointer(true,true)).toBe(false);expect(beginPointer(false,false)).toBe(false);expect(beginPointer(false,true)).toBe(true);});
it('tap selects actual logical face but drags and invalid normals do not',async()=>{
 const {resolveTapFace}=await import('./input');
 expect(resolveTapFace(hit,{x:0,y:0})).toBe(4);
 expect(resolveTapFace({position:[1,0,0],normal:[1,0,0]},{x:3,y:2})).toBe(0);
 expect(resolveTapFace(hit,{x:40,y:40})).toBeNull();
 expect(resolveTapFace({position:[1,0,0],normal:[1,1,0]},{x:0,y:0})).toBeNull();
});
it('feedback arrows follow the screen swipe rather than signed world axes',async()=>{
 const {swipeArrow}=await import('./input');
 expect(swipeArrow({x:2,y:30})).toBe('↓');expect(swipeArrow({x:-2,y:-30})).toBe('↑');
 expect(swipeArrow({x:30,y:2})).toBe('→');expect(swipeArrow({x:-30,y:2})).toBe('←');
});
