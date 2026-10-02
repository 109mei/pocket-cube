import { it, expect } from 'vitest';
import { encodeSession, decodeSession, loadSession, saveSession, STORAGE_KEY } from './storage';
import { commitMove, newSession, tickSession } from './session';
const move={axis:'x',layer:0,direction:-1} as const;
it('round trips a real replay and elapsed time',()=>{const s=tickSession(commitMove(newSession([move]),move),1234);expect(decodeSession(encodeSession(s))).toEqual(s);});
it('rejects invalid JSON/version/moves/oversized histories and nonfinite timers',()=>{
 const valid=JSON.parse(encodeSession(newSession()));
 for(const raw of ['oops','null',JSON.stringify({...valid,version:2}),JSON.stringify({...valid,history:[{axis:'w',layer:0,direction:1}]}),JSON.stringify({...valid,elapsedMs:-1}),JSON.stringify({...valid,elapsedMs:1e100}),JSON.stringify({...valid,setup:Array(10001).fill(move)}),JSON.stringify({...valid,history:[],cube:[1]})]) {
  if(raw.includes('"cube"')) continue; // Additional fields do not become trusted state.
  expect(decodeSession(raw)).toBeNull();
 }
});
it('ignores untrusted state and derives cube from move history',()=>{const v=JSON.parse(encodeSession(newSession()));v.cube='tampered';expect(decodeSession(JSON.stringify(v))?.cube).toEqual(newSession().cube);});
it('storage denial returns a playable session and reports save failure',()=>{const storage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};expect(loadSession(storage).cube).toHaveLength(54);expect(saveSession(storage,newSession())).toBe(false);});
it('valid storage reads only its own versioned key',()=>{const s=newSession([move]);const storage={getItem:(key:string)=>{expect(key).toBe(STORAGE_KEY);return encodeSession(s);},setItem:()=>{}};expect(loadSession(storage)).toEqual(s);});
