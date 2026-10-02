import { it, expect } from 'vitest';
import { TurnQueue } from './queue';
it('serializes eight accepted turns and rejects overflow without dropping committed turns',async()=>{
 const commits:number[]=[];const releases:(()=>void)[]=[];
 const q=new TurnQueue<number>(async v=>{await new Promise<void>(r=>releases.push(r));commits.push(v);});
 for(let i=0;i<8;i++)expect(q.enqueue(i)).toBe(true);
 expect(q.enqueue(8)).toBe(false);expect(q.busy).toBe(true);expect(commits).toEqual([]);
 for(let i=0;i<8;i++){releases.shift()!();await new Promise(r=>setTimeout(r,0));expect(commits).toEqual(Array.from({length:i+1},(_,j)=>j));}
 expect(q.busy).toBe(false);
});
it('surfaces a failed animation and clears queued actions instead of committing later guesses',async()=>{let error:unknown;const q=new TurnQueue<number>(async()=>{throw Error('lost context')},e=>error=e);q.enqueue(1);q.enqueue(2);await new Promise(r=>setTimeout(r,0));expect(error).toBeInstanceOf(Error);expect(q.busy).toBe(false);});
