import { describe, it, expect } from 'vitest';
import { applyMove, createSolved, inverse, isSolved, makeScramble, type Move, type CubeState } from './model';
const axes = ['x','y','z'] as const;
const layers = [-1,0,1] as const;
const moves: Move[] = axes.flatMap(axis => layers.flatMap(layer => ([-1,1] as const).map(direction => ({axis,layer,direction}))));
const replay = (sequence: Move[], cube = createSolved()) => sequence.reduce(applyMove, cube);
function rng(seed:number) { return () => ((seed = (seed*1664525+1013904223)>>>0)/2**32); }
function invariant(cube: CubeState) {
 expect(cube).toHaveLength(54); expect(new Set(cube.map(s=>s.id)).size).toBe(54);
 expect(new Set(cube.map(s=>`${s.position}/${s.normal}`)).size).toBe(54);
 for(let c=0;c<6;c++) expect(cube.filter(s=>s.color===c)).toHaveLength(9);
 for(const s of cube) { for(const n of [...s.position,...s.normal]) expect([-1,0,1]).toContain(n); expect(s.normal.reduce((a,n)=>a+Math.abs(n),0)).toBe(1); }
}
describe('integer cube', () => {
 it.each(moves)('four quarter turns restore $axis/$layer/$direction', move=>expect(replay([move,move,move,move])).toEqual(createSolved()));
 it.each(moves)('inverse restores $axis/$layer/$direction', move=>expect(replay([move,inverse(move)])).toEqual(createSolved()));
 it('preserves all sticker invariants and recovers 100 seeded scrambles',()=>{
  for(let seed=1;seed<=100;seed++) { const sequence=makeScramble(100,rng(seed)); const cube=replay(sequence); invariant(cube); expect(replay([...sequence].reverse().map(inverse),cube)).toEqual(createSolved()); }
 });
 it('uses right handed positive x rotation, not an internally consistent wrong convention',()=>{
  const before=createSolved(); const sticker=before.find(s=>s.position.join()==='1,1,1' && s.normal.join()==='0,1,0')!;
  const after=applyMove(before,{axis:'x',layer:1,direction:1}).find(s=>s.id===sticker.id)!;
  expect(after.position).toEqual([1,-1,1]); expect(after.normal).toEqual([0,0,1]); expect(before).toEqual(createSolved());
 });
 it('recognizes solved state in any global orientation but not a turn',()=>{
  expect(isSolved(createSolved())).toBe(true);
  expect(isSolved(replay([{axis:'x',layer:1,direction:1}]))).toBe(false);
  let cube=createSolved(); for(const axis of axes) for(const layer of layers) cube=applyMove(cube,{axis,layer,direction:1});
  expect(isSolved(cube)).toBe(true);
 });
 it('scramble has 25 moves and avoids consecutive parallel axes',()=>{const s=makeScramble(25,rng(42)); expect(s).toHaveLength(25); for(let i=1;i<s.length;i++) expect(s[i].axis).not.toBe(s[i-1].axis);});
});
