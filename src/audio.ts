type Settings={volume:number;muted:boolean};
export type AudioStatus='idle'|'waiting'|'running'|'paused'|'hidden'|'muted'|'zero'|'unavailable';
type SettingsStore=Pick<Storage,'getItem'> & Partial<Pick<Storage,'setItem'>>;
const KEY='pocket-cube:audio:v1';
const DEFAULT:Settings={volume:.45,muted:false};
export function loadAudioSettings(storage:SettingsStore|null):Settings{
 try{const raw=storage?.getItem(KEY);if(!raw||raw.length>256)return{...DEFAULT};const value=JSON.parse(raw);if(value.version===1&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1&&typeof value.muted==='boolean')return{volume:value.volume,muted:value.muted};}catch{/* Sound is optional. */}
 return{...DEFAULT};
}
/** Seeded, band-limited plastic texture; circular warm-up avoids a filter seam. */
function materialNoise(rate:number,seed:number):Float32Array{
 const length=Math.round(rate*1.2),noise=new Float32Array(length),result=new Float32Array(length);let state=seed>>>0;
 for(let i=0;i<length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;noise[i]=state/2147483648-1;}
 const low=1-Math.exp(-2*Math.PI*1100/rate),high=1-Math.exp(-2*Math.PI*220/rate);let a=0,b=0,dc=0;
 for(let pass=0;pass<3;pass++)for(let i=0;i<length;i++){a+=low*(noise[i]-a);b+=low*(a-b);dc+=high*(b-dc);result[i]=b-dc;}
 let peak=0;for(const value of result)peak=Math.max(peak,Math.abs(value));for(let i=0;i<length;i++)result[i]*=.5/(peak||1);return result;
}
/** Dry, irregular contacts over a low rubbing bed, never a continuous pitched tone. */
export function frictionSamples(rate:number,seed:number):Float32Array{
 const noise=materialNoise(rate,seed),result=new Float32Array(noise.length),envelope=new Float32Array(noise.length).fill(.09);let state=(seed^0x9e3779b9)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let time=.015;time<1.2;time+=.025+random()*.062){const length=Math.round(rate*(.008+random()*.015)),start=Math.round(time*rate),strength=.45+random()*.55;for(let i=0;i<length;i++){const phase=i/(length-1),shape=Math.sin(Math.PI*phase)**2*Math.exp(-phase*3);envelope[(start+i)%noise.length]+=strength*shape;}}
 let peak=0;for(let i=0;i<noise.length;i++){result[i]=noise[i]*envelope[i];peak=Math.max(peak,Math.abs(result[i]));}
 for(let i=0;i<result.length;i++){const edge=Math.min(1,i/(rate*.003),(result.length-1-i)/(rate*.003));result[i]*=.5/(peak||1)*edge;}return result;
}
/** Two short, damped plastic contacts at alignment. Noise-only: no synthesized note. */
export function settleSamples(rate:number,seed:number):Float32Array{
 const noise=materialNoise(rate,seed),length=Math.round(rate*.075),result=new Float32Array(length);
 for(const [start,duration,strength] of [[.002,.027,.95],[.031,.034,.5]])for(let i=0;i<Math.round(duration*rate);i++){const index=Math.round(start*rate)+i,phase=i/(duration*rate),envelope=Math.sin(Math.PI*phase)**2*Math.exp(-phase*4);result[index]+=noise[index]*envelope*strength;}
 result[0]=0;result[length-1]=0;return result;
}
/** Optional audio adapter. One looping friction voice, bounded automation and finite accents. */
export class MotionAudio{
 private settings:Settings;
 private context:AudioContext|null=null;
 private master:GainNode|null=null;private motionGain:GainNode|null=null;private filter:BiquadFilterNode|null=null;
 private source:AudioBufferSourceNode|null=null;private accents=new Set<AudioBufferSourceNode>();
 private last:{angle:number;time:number}|null=null;private lastAutomation=-Infinity;
 private hidden=false;private ready=false;private variation=1;private resuming:AudioContext|null=null;private lastSettle=-Infinity;private resumeAttempt=0;private pending:Promise<boolean>|null=null;private failed=false;private auditionAttempt=0;
 constructor(private storage:SettingsStore|null,private create:()=>AudioContext|null=()=>new AudioContext()) {this.settings=loadAudioSettings(storage);}
 get preferences():Settings{return{...this.settings};}
 get status():AudioStatus{
  if(this.settings.muted)return'muted';if(this.settings.volume===0)return'zero';if(this.hidden)return'hidden';if(this.failed)return'unavailable';
  if(!this.context||this.context.state==='closed')return'idle';if(this.context.state==='running'&&this.ready)return'running';return this.resuming===this.context?'waiting':'paused';
 }
 private save(){try{this.storage?.setItem?.(KEY,JSON.stringify({version:1,...this.settings}));}catch{/* Game progress is independent. */}}
 private gain(){return !this.hidden&&!this.settings.muted ? .18*this.settings.volume : 0;}
 private applyMaster(){if(!this.context||!this.master)return;this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(this.gain(),this.context.currentTime,.025);}
 private suspend(){this.ready=false;this.stopMotion();for(const source of this.accents){try{source.stop();source.disconnect();}catch{}}this.accents.clear();if(this.context&&this.context.state!=='closed'){this.motionGain?.gain.setValueAtTime(0,this.context.currentTime);void this.context.suspend().catch(()=>{});}}
 unlock(fromGesture=false):Promise<boolean>{
  if(this.hidden||this.settings.muted||this.settings.volume===0)return Promise.resolve(false);
  try{
   if(!this.context||this.context.state==='closed'){
    const context=this.create();if(!context){this.failed=true;return Promise.resolve(false);}this.context=context;this.failed=false;
    this.master=context.createGain();this.master.gain.setValueAtTime(0,context.currentTime);this.master.connect(context.destination);
    this.motionGain=context.createGain();this.motionGain.gain.setValueAtTime(0,context.currentTime);this.motionGain.connect(this.master);
    this.filter=context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.setValueAtTime(1800,context.currentTime);this.filter.Q.setValueAtTime(.5,context.currentTime);this.filter.connect(this.motionGain);
    this.source=context.createBufferSource();this.source.buffer=this.buffer(frictionSamples(context.sampleRate,317));this.source.loop=true;this.source.connect(this.filter);this.source.start();
   }
   const context=this.context;
   if(context.state==='running'){this.resumeAttempt++;this.ready=true;this.failed=false;this.resuming=null;this.pending=null;this.applyMaster();return Promise.resolve(true);}
   // An autoplay-blocked resume may remain pending indefinitely. A later real
   // gesture must be able to retry instead of being trapped behind that promise.
   if(this.resuming===context&&!fromGesture)return this.pending??Promise.resolve(false);
   const attempt=++this.resumeAttempt;this.resuming=context;this.failed=false;
   this.pending=context.resume().then(()=>{
    if(context!==this.context)return false;
    if(this.hidden||this.settings.muted||this.settings.volume===0){this.suspend();return false;}
    if(attempt!==this.resumeAttempt)return false;
    this.resuming=null;this.pending=null;this.ready=context.state==='running';this.applyMaster();return this.ready;
   }).catch(()=>{if(context===this.context&&attempt===this.resumeAttempt){this.ready=false;this.resuming=null;this.pending=null;this.failed=true;}return false;});
   return this.pending;
  }catch{this.ready=false;this.close();this.failed=true;return Promise.resolve(false);}
 }
 async audition():Promise<boolean>{
  const attempt=++this.auditionAttempt;
  if(!await this.unlock(true)||attempt!==this.auditionAttempt||!this.context||!this.motionGain||!this.gain())return false;
  this.stopMotion();const now=this.context.currentTime;this.motionGain.gain.setTargetAtTime(.65,now,.025);this.motionGain.gain.setTargetAtTime(0,now+.7,.08);return true;
 }
 private buffer(samples:Float32Array){const context=this.context!;const buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);return buffer;}
 beginMotion(angle:number,time=performance.now()){this.auditionAttempt++;this.last={angle,time};}
 motion(angle:number,time=performance.now()){
  const previous=this.last;this.last={angle,time};if(!previous||!Number.isFinite(angle)||!Number.isFinite(time)||!this.ready||!this.context||!this.motionGain||!this.filter||!this.gain())return;
  const speed=Math.min(12,Math.abs(angle-previous.angle)/Math.max(.008,(time-previous.time)/1000));const level=.8*Math.sqrt(Math.min(1,speed/8)),now=this.context.currentTime;
  if(now-this.lastAutomation<1/90)return;this.lastAutomation=now;
  const gain=this.motionGain.gain;gain.cancelScheduledValues(now);gain.setTargetAtTime(level,now,.02);
  // No further input means no movement: fade even without a pointerup event.
  gain.setTargetAtTime(0,now+.075,.03);this.filter.frequency.setTargetAtTime(1450+speed*35,now,.035);this.source?.playbackRate.setTargetAtTime(Math.min(1.5,.55+speed*.08),now,.04);
 }
 stopMotion(){this.auditionAttempt++;this.last=null;if(!this.context||!this.motionGain)return;const now=this.context.currentTime;this.motionGain.gain.cancelScheduledValues(now);this.motionGain.gain.setTargetAtTime(0,now,.02);}
 settle(){
  this.stopMotion();if(!this.ready||!this.context||!this.master||!this.gain())return;
  try{
   // Bound rapid/reduced-motion alignment bursts without chopping an existing tail.
   if(this.context.currentTime-this.lastSettle<.08||this.accents.size>=2)return;this.lastSettle=this.context.currentTime;
   const source=this.context.createBufferSource();source.buffer=this.buffer(settleSamples(this.context.sampleRate,101+this.variation++));source.connect(this.master);this.accents.add(source);source.onended=()=>{source.disconnect();this.accents.delete(source);};source.start();
  }catch{/* Audio failure never invalidates a turn. */}
 }
 setMuted(muted:boolean){this.settings.muted=muted;this.save();this.applyMaster();if(muted)this.suspend();}
 setVolume(volume:number){if(!Number.isFinite(volume))return;this.settings.volume=Math.max(0,Math.min(1,volume));this.save();this.applyMaster();if(this.settings.volume===0)this.suspend();}
 setHidden(hidden:boolean){this.hidden=hidden;this.applyMaster();if(hidden)this.suspend();}
 close(){
  this.ready=false;this.last=null;this.lastAutomation=-Infinity;this.lastSettle=-Infinity;this.resuming=null;this.pending=null;this.resumeAttempt++;this.auditionAttempt++;
  for(const source of [this.source,...this.accents]){try{source?.stop();source?.disconnect();}catch{/* Already ended. */}}
  this.accents.clear();const context=this.context;this.context=null;this.source=null;this.master=null;this.motionGain=null;this.filter=null;if(context&&context.state!=='closed')void context.close().catch(()=>{});
 }
}
