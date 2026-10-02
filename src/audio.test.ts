import {it,expect,vi} from 'vitest';
import {MotionAudio,frictionSamples,settleSamples,loadAudioSettings} from './audio';
class Param{value=0;calls:number[][]=[];setValueAtTime(v:number,t:number){this.calls.push([v,t,0]);this.value=v;}setTargetAtTime(v:number,t:number,c:number){this.calls.push([v,t,c]);this.value=v;}cancelScheduledValues(_t:number){}}
class Node{gain=new Param();frequency=new Param();Q=new Param();buffer:any;loop=false;onended:(()=>void)|null=null;starts=0;stops=0;type='';connect(_n:any){}disconnect(){}start(){this.starts++;}stop(){this.stops++;}}
function context(){const sources:Node[]=[],gains:Node[]=[];const ctx={state:'suspended',currentTime:1,sampleRate:8000,destination:{},resume:vi.fn(async()=>{ctx.state='running';}),suspend:vi.fn(async()=>{ctx.state='suspended';}),close:vi.fn(async()=>{ctx.state='closed';}),createBuffer:(_channels:number,length:number,_rate:number)=>{const data=new Float32Array(length);return{getChannelData:()=>data};},createBufferSource:()=>{const node=new Node();sources.push(node);return node;},createGain:()=>{const node=new Node();gains.push(node);return node;},createBiquadFilter:()=>new Node()};return{ctx,sources,gains};}
const flush=async()=>{for(let n=0;n<5;n++)await Promise.resolve();};
it('makes original smooth bounded material noise and a soft zero-ended alignment sound',()=>{
 const a=frictionSamples(8000,13),b=frictionSamples(8000,14),settle=settleSamples(8000,13);
 expect(a.length).toBe(9600);expect(a).not.toEqual(b);
 for(const samples of [a,settle]){expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(.55);expect(samples.every(Number.isFinite)).toBe(true);const energy=samples.reduce((sum,v)=>sum+v*v,0);const difference=samples.reduce((sum,v,i)=>sum+(i?(v-samples[i-1])**2:0),0);expect(energy/samples.length).toBeGreaterThan(.0001);expect(difference/energy).toBeLessThan(.8);}
 expect(settle[0]).toBe(0);expect(Math.abs(settle.at(-1)!)).toBeLessThan(.00001);
});
it('does not create or start audio until a user gesture unlocks it',async()=>{
 const {ctx,sources}=context();const create=vi.fn(()=>ctx as unknown as AudioContext);const sound=new MotionAudio(null,create);
 sound.beginMotion(0,0);sound.motion(.5,20);sound.settle();expect(create).not.toHaveBeenCalled();sound.unlock();await flush();expect(create).toHaveBeenCalledTimes(1);expect(ctx.resume).toHaveBeenCalledTimes(1);expect(sources).toHaveLength(1);expect(sources[0].loop).toBe(true);
});
it('uses one bounded friction voice for rapid motion, fades if movement stops, and never retriggers per frame',async()=>{
 const {ctx,sources,gains}=context();const sound=new MotionAudio(null,()=>ctx as unknown as AudioContext);sound.unlock();await flush();sound.beginMotion(0,0);
 for(let n=1;n<=500;n++){ctx.currentTime=1+n*.004;sound.motion(n*.02,n*4);}
 expect(sources).toHaveLength(1);expect(sources[0].starts).toBe(1);
 const motion=gains[1].gain;expect(Math.max(...motion.calls.map(c=>c[0]))).toBeLessThanOrEqual(.8);expect(motion.calls.some(c=>c[0]===0&&c[1]>ctx.currentTime)).toBe(true);expect(motion.calls.length).toBeLessThan(650);
 sound.motion(10,2100);expect(motion.calls.at(-1)![0]).toBe(0);sound.stopMotion();expect(sources).toHaveLength(1);
});
it('only explicit alignment adds one finite source and mute/zero volume prevent sound',async()=>{
 const {ctx,sources}=context();const sound=new MotionAudio(null,()=>ctx as unknown as AudioContext);sound.unlock();await flush();sound.settle();expect(sources).toHaveLength(2);expect(sources[1].loop).toBe(false);sound.stopMotion();expect(sources).toHaveLength(2);sound.setMuted(true);sound.settle();expect(sources).toHaveLength(2);sound.setMuted(false);sound.setVolume(0);sound.unlock();await flush();sound.settle();expect(sources).toHaveLength(2);
});
it('suspends while hidden, closes cleanly, and safely recreates after a fresh gesture',async()=>{
 const first=context(),second=context();const create=vi.fn().mockReturnValueOnce(first.ctx).mockReturnValueOnce(second.ctx);const sound=new MotionAudio(null,create);sound.unlock();await flush();sound.setHidden(true);await flush();expect(first.ctx.suspend).toHaveBeenCalled();sound.settle();expect(first.sources).toHaveLength(1);sound.setHidden(false);expect(first.ctx.resume).toHaveBeenCalledTimes(1);sound.close();await flush();expect(first.ctx.close).toHaveBeenCalled();expect(first.sources[0].stops).toBe(1);sound.unlock();await flush();expect(create).toHaveBeenCalledTimes(2);
});
it('does not resume audibly after an unlock races with hiding',async()=>{
 const {ctx,gains}=context();let resume!:()=>void;ctx.resume=vi.fn(()=>new Promise<void>(resolve=>{resume=()=>{ctx.state='running';resolve();};}));const sound=new MotionAudio(null,()=>ctx as unknown as AudioContext);sound.unlock();sound.setHidden(true);resume();await flush();expect(ctx.state).toBe('suspended');expect(gains[0].gain.calls.at(-1)![0]).toBe(0);
});
it('validates saved preferences and absorbs storage/context failures without game errors',async()=>{
 expect(loadAudioSettings({getItem:()=>'{bad'})).toEqual({volume:.45,muted:false});expect(loadAudioSettings({getItem:()=>JSON.stringify({version:1,volume:4,muted:'no'})})).toEqual({volume:.45,muted:false});
 let saved='';const store={getItem:()=>null,setItem:(_key:string,value:string)=>{saved=value;}};const sound=new MotionAudio(store,()=>{throw Error('unavailable');});sound.setVolume(.7);sound.setMuted(true);expect(JSON.parse(saved)).toMatchObject({version:1,volume:.7,muted:true});expect(()=>sound.unlock()).not.toThrow();await flush();const denied=new MotionAudio({getItem(){throw Error('denied');},setItem(){throw Error('denied');}},()=>null);expect(()=>{denied.setVolume(.3);denied.setMuted(true);denied.unlock();denied.close();}).not.toThrow();
});
it('drops stale alignment tails when suspended and caps alignment bursts',async()=>{
 const {ctx,sources,gains}=context();const sound=new MotionAudio(null,()=>ctx as unknown as AudioContext);sound.unlock();await flush();for(let i=0;i<20;i++)sound.settle();expect(sources.length).toBeLessThanOrEqual(2);sound.setHidden(true);expect(sources[1].stops).toBe(1);expect(gains[1].gain.calls.at(-1)![0]).toBe(0);
});
it('coalesces pending resumes and ignores a stale rejected resume after close',async()=>{
 const first=context(),second=context();let reject!:(reason:Error)=>void;first.ctx.resume=vi.fn(()=>new Promise<void>((_yes,no)=>{reject=no;}));const create=vi.fn().mockReturnValueOnce(first.ctx).mockReturnValueOnce(second.ctx);const sound=new MotionAudio(null,create);sound.unlock();sound.unlock();expect(first.ctx.resume).toHaveBeenCalledTimes(1);sound.close();sound.unlock();await flush();reject(Error('stale'));await flush();sound.settle();expect(second.sources).toHaveLength(2);
});
it('caps repeated stationary pointer updates while keeping explicit stop immediate',async()=>{
 const {ctx,gains}=context();const sound=new MotionAudio(null,()=>ctx as unknown as AudioContext);sound.unlock();await flush();sound.beginMotion(.5,0);
 for(let n=1;n<=250;n++){ctx.currentTime=1+n*.004;sound.motion(.5,n*4);}
 expect(gains[1].gain.calls.length).toBeLessThanOrEqual(190);const before=gains[1].gain.calls.length;sound.stopMotion();expect(gains[1].gain.calls.length).toBe(before+1);expect(gains[1].gain.calls.at(-1)![0]).toBe(0);
});
