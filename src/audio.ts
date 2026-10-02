type Settings={volume:number;muted:boolean};
type SettingsStore=Pick<Storage,'getItem'> & Partial<Pick<Storage,'setItem'>>;
const KEY='pocket-cube:audio:v1';
const DEFAULT:Settings={volume:.45,muted:false};
export function loadAudioSettings(storage:SettingsStore|null):Settings{
 try{const raw=storage?.getItem(KEY);if(!raw||raw.length>256)return{...DEFAULT};const value=JSON.parse(raw);if(value.version===1&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1&&typeof value.muted==='boolean')return{volume:value.volume,muted:value.muted};}catch{/* Sound is optional. */}
 return{...DEFAULT};
}
/** Original band-limited material noise. Circular filter warm-up avoids a loop seam. */
export function frictionSamples(rate:number,seed:number):Float32Array{
 const length=Math.round(rate*1.2),noise=new Float32Array(length),result=new Float32Array(length);let state=seed>>>0;
 for(let i=0;i<length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;noise[i]=state/2147483648-1;}
 const low=1-Math.exp(-2*Math.PI*900/rate),high=1-Math.exp(-2*Math.PI*90/rate);let a=0,b=0,dc=0;
 for(let pass=0;pass<3;pass++)for(let i=0;i<length;i++){a+=low*(noise[i]-a);b+=low*(a-b);dc+=high*(b-dc);result[i]=b-dc;}
 let peak=0;for(const value of result)peak=Math.max(peak,Math.abs(value));for(let i=0;i<length;i++)result[i]*=.5/(peak||1);return result;
}
/** A short rounded settling breath, with no impulse or sharp attack. */
export function settleSamples(rate:number,seed:number):Float32Array{
 const noise=frictionSamples(rate,seed),length=Math.round(rate*.16),result=new Float32Array(length);
 for(let i=0;i<length;i++){const t=i/rate,phase=i/(length-1),envelope=Math.sin(Math.PI*phase)**2*Math.exp(-phase*2);const body=Math.sin(2*Math.PI*(145*t-90*t*t));result[i]=(noise[i]*.7+body*.12)*envelope;}
 result[0]=0;result[length-1]=0;return result;
}
/** Optional audio adapter. One looping friction voice, bounded automation and finite accents. */
export class MotionAudio{
 private settings:Settings;
 private context:AudioContext|null=null;
 private master:GainNode|null=null;private motionGain:GainNode|null=null;private filter:BiquadFilterNode|null=null;
 private source:AudioBufferSourceNode|null=null;private accents=new Set<AudioBufferSourceNode>();
 private last:{angle:number;time:number}|null=null;private lastAutomation=-Infinity;
 private hidden=false;private ready=false;private variation=1;private resuming:AudioContext|null=null;private lastSettle=-Infinity;
 constructor(private storage:SettingsStore|null,private create:()=>AudioContext|null=()=>new AudioContext()) {this.settings=loadAudioSettings(storage);}
 get preferences():Settings{return{...this.settings};}
 private save(){try{this.storage?.setItem?.(KEY,JSON.stringify({version:1,...this.settings}));}catch{/* Game progress is independent. */}}
 private gain(){return !this.hidden&&!this.settings.muted ? .18*this.settings.volume : 0;}
 private applyMaster(){if(!this.context||!this.master)return;this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(this.gain(),this.context.currentTime,.025);}
 private suspend(){this.ready=false;this.stopMotion();for(const source of this.accents){try{source.stop();source.disconnect();}catch{}}this.accents.clear();if(this.context&&this.context.state!=='closed'){this.motionGain?.gain.setValueAtTime(0,this.context.currentTime);void this.context.suspend().catch(()=>{});}}
 unlock(){
  if(this.hidden||this.settings.muted||this.settings.volume===0)return;
  try{
   if(!this.context||this.context.state==='closed'){
    const context=this.create();if(!context)return;this.context=context;
    this.master=context.createGain();this.master.gain.setValueAtTime(0,context.currentTime);this.master.connect(context.destination);
    this.motionGain=context.createGain();this.motionGain.gain.setValueAtTime(0,context.currentTime);this.motionGain.connect(this.master);
    this.filter=context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.setValueAtTime(1100,context.currentTime);this.filter.Q.setValueAtTime(.5,context.currentTime);this.filter.connect(this.motionGain);
    this.source=context.createBufferSource();this.source.buffer=this.buffer(frictionSamples(context.sampleRate,317));this.source.loop=true;this.source.connect(this.filter);this.source.start();
   }
   const context=this.context;if(this.resuming===context)return;this.resuming=context;void context.resume().then(()=>{if(context!==this.context)return;this.resuming=null;if(this.hidden||this.settings.muted||this.settings.volume===0){this.suspend();return;}this.ready=context.state==='running';this.applyMaster();}).catch(()=>{if(context===this.context){this.ready=false;this.resuming=null;}});
  }catch{this.ready=false;this.close();}
 }
 private buffer(samples:Float32Array){const context=this.context!;const buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);return buffer;}
 beginMotion(angle:number,time=performance.now()){this.last={angle,time};}
 motion(angle:number,time=performance.now()){
  const previous=this.last;this.last={angle,time};if(!previous||!Number.isFinite(angle)||!Number.isFinite(time)||!this.ready||!this.context||!this.motionGain||!this.filter||!this.gain())return;
  const speed=Math.min(12,Math.abs(angle-previous.angle)/Math.max(.008,(time-previous.time)/1000));const level=.8*Math.sqrt(Math.min(1,speed/8)),now=this.context.currentTime;
  if(now-this.lastAutomation<1/90)return;this.lastAutomation=now;
  const gain=this.motionGain.gain;gain.cancelScheduledValues(now);gain.setTargetAtTime(level,now,.02);
  // No further input means no movement: fade even without a pointerup event.
  gain.setTargetAtTime(0,now+.075,.03);this.filter.frequency.setTargetAtTime(650+speed*55,now,.035);
 }
 stopMotion(){this.last=null;if(!this.context||!this.motionGain)return;const now=this.context.currentTime;this.motionGain.gain.cancelScheduledValues(now);this.motionGain.gain.setTargetAtTime(0,now,.02);}
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
  this.ready=false;this.last=null;this.lastAutomation=-Infinity;this.lastSettle=-Infinity;this.resuming=null;
  for(const source of [this.source,...this.accents]){try{source?.stop();source?.disconnect();}catch{/* Already ended. */}}
  this.accents.clear();const context=this.context;this.context=null;this.source=null;this.master=null;this.motionGain=null;this.filter=null;if(context&&context.state!=='closed')void context.close().catch(()=>{});
 }
}
