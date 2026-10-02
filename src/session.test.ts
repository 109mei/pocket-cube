import { it, expect } from 'vitest';
import { newSession, commitMove, undoMove, tickSession, MAX_MOVES } from './session';
import { isSolved, inverse } from './model';
const move = {axis:'z',layer:1,direction:1} as const;
it('scramble is setup and does not count as player moves',()=>{const s=newSession([move]);expect(s.history).toHaveLength(0);expect(s.started).toBe(false);expect(isSolved(s.cube)).toBe(false);});
it('move starts clock, undo recovers exact state and move count',()=>{const s=newSession([move]);const next=tickSession(commitMove(s,move),1350);expect(next.elapsedMs).toBe(1350);expect(next.started).toBe(true);const undone=undoMove(next);expect(undone.cube).toEqual(s.cube);expect(undone.history).toHaveLength(0);});
it('solving stops time and further tick does not change it',()=>{let s=commitMove(newSession(),move);s=tickSession(s,900);s=commitMove(s,inverse(move));expect(isSolved(s.cube)).toBe(true);expect(s.started).toBe(false);expect(tickSession(s,1000).elapsedMs).toBe(900);});
it('fresh solved session and empty undo remain unchanged',()=>{const s=newSession();expect(undoMove(s)).toEqual(s);expect(tickSession(s,900)).toEqual(s);});
it('invalid deltas and max history cannot corrupt a session',()=>{const s=commitMove(newSession(),move);expect(tickSession(s,NaN)).toEqual(s);expect(tickSession(s,-1)).toEqual(s);const full={...s,history:Array(MAX_MOVES).fill(move)};expect(commitMove(full,move)).toBe(full);});
