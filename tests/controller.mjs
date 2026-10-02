/** Controller integration using fake DOM and CubeView ports.
 * These checks exercise application state/event wiring, not browser rendering,
 * native pointer dispatch, Safari behavior, WebGL, or perceived touch latency.
 * Run from repository: node tests/controller.mjs [projectRoot] [mode]
 * Modes: normal, storage-denied, webgl-unavailable, context-preview, limit, real-audio.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const mode = process.argv[3] ?? 'normal';
const require = createRequire(resolve(root, 'package.json'));
const { build } = require('esbuild');
const fakeView = `export class CubeView {
 constructor(canvas,onLost,onResize) {
  if(globalThis.auditMode==='webgl-unavailable') throw Error('WebGL unavailable');
  globalThis.auditView=this;this.onLost=onLost;this.onResize=onResize;this.pending=[];this.preview=null;
 }
 sync(state){this.current=structuredClone(state);this.preview=null;}
 previewMove(move,angle){this.preview={move:{...move},angle};}
 animate(move,options={}){
  this.preview={move:{...move},angle:options.fromAngle??0};
  return new Promise((resolve,reject)=>this.pending.push({move:{...move},options:{...options},resolve,reject}));
 }
 pick(x,y){return x<250?{position:[0,0,1],normal:[0,0,1],point:[0,0,1.571]}:null;}
 tangents(){return [{axis:'x',dx:0,dy:100,pixelsPerRadian:100},{axis:'y',dx:100,dy:0,pixelsPerRadian:100}];}
 highlight(normal){this.selected=normal;}
 home(){this.homeCount=(this.homeCount??0)+1;}
 orbit(x,y){this.orbitX=(this.orbitX??0)+x;this.orbitY=(this.orbitY??0)+y;}
 snapshot(){return {state:this.current,preview:this.preview};}
}`;
const compiled = await build({
 entryPoints: ['src/main.ts'], absWorkingDir: root, bundle: true,
 platform: 'node', format: 'esm', write: false,
 define: { 'import.meta.env.DEV': 'true' },
 plugins: [{ name: 'controller-test-ports', setup(builder) {
  builder.onLoad({ filter: /\/view\.ts$/ }, () => ({ contents: fakeView, loader: 'ts' }));
  if(mode!=='real-audio')builder.onLoad({filter:/\/audio\.ts$/},()=>({loader:'ts',contents:`export class MotionAudio {constructor(){globalThis.auditAudio=this;this.alignments=0;this.movements=[];this.stops=0;this.unlocks=0;this.preferences={volume:.45,muted:false};this.status='idle';}unlock(force){this.lastUnlockForce=force;this.unlocks++;return Promise.resolve(true);}audition(){this.auditions=(this.auditions??0)+1;return Promise.resolve(true);}beginMotion(angle){this.begin=angle;}motion(angle){this.movements.push(angle);}stopMotion(){this.stops++;}settle(){this.alignments++;}setHidden(hidden){this.hidden=hidden;}close(){this.closed=true;}setMuted(muted){this.preferences.muted=muted;}setVolume(volume){this.preferences.volume=volume;}}` }));
  builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
 }}],
});
let now = 0, frames = [], reloads = 0, prevented = 0;
const elements = new Map(), faceButtons = [], closeButtons = [];
const windowEvents = {}, documentEvents = {}, viewportEvents = {}, writes = [], storage = new Map();
class Element {
 constructor(id) {
  this.id=id;this.disabled=false;this.open=false;this.events={};this.dataset={};
  this.textContent='';this.captured=new Set();this.style={values:{},setProperty(name,value){this.values[name]=value;},getPropertyValue(name){return this.values[name]??'';}};
  this.classList={add(){},remove(){},toggle(){}};
 }
 set innerHTML(html) {
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g)) elements.set(id,new Element(id));
  for(let index=0;index<6;index++) {const element=new Element('face'+index);element.dataset.face=String(index);faceButtons.push(element);}
  closeButtons.push(new Element('close-help'),new Element('close-solved'));
 }
 addEventListener(type,handler){(this.events[type]??=[]).push(handler);}
 dispatch(type,fields={}) {
  for(const handler of this.events[type]??[]) handler({pointerId:1,isPrimary:true,button:0,clientX:100,clientY:100,preventDefault(){prevented++;},...fields});
 }
 click(){if(!this.disabled)this.onclick?.();}
 setAttribute(name,value){this[name]=value;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 hasPointerCapture(id){return this.captured.has(id);}
 setPointerCapture(id){this.captured.add(id);}
 releasePointerCapture(id){this.captured.delete(id);}
}
const app = new Element('app'), footer = new Element('footer');
globalThis.auditMode=mode;
globalThis.window=globalThis;
globalThis.document={hidden:false,getElementById:id=>id==='app'?app:elements.get(id),querySelector:selector=>selector==='#app'?app:selector==='.footer'?footer:null,querySelectorAll:selector=>selector==='[data-close]'?closeButtons:selector==='[data-face]'?faceButtons:[],addEventListener:(type,handler)=>(documentEvents[type]??=[]).push(handler)};
globalThis.addEventListener=(type,handler)=>(windowEvents[type]??=[]).push(handler);
globalThis.visualViewport={height:568,scale:1,addEventListener:(type,handler)=>(viewportEvents[type]??=[]).push(handler)};
globalThis.requestAnimationFrame=handler=>{frames.push(handler);return frames.length;};
globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
globalThis.location={reload(){reloads++;}};
globalThis.performance={now:()=>now};
if(mode==='limit')storage.set('pocket-cube:session:v1',JSON.stringify({version:1,setup:[],history:Array.from({length:10000},()=>({axis:'x',layer:1,direction:1})),elapsedMs:0,started:false}));
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(mode==='storage-denied')throw Error('Storage denied');storage.set(key,value);writes.push(JSON.parse(value));}};
let trustedActivation=false,contexts=[];
class AudioParamPort { constructor(){this.calls=[];}setValueAtTime(v,t){this.calls.push([v,t,0]);}setTargetAtTime(v,t,k){this.calls.push([v,t,k]);}cancelScheduledValues(){} }
class AudioNodePort {constructor(){this.gain=new AudioParamPort();this.frequency=new AudioParamPort();this.Q=new AudioParamPort();this.playbackRate=new AudioParamPort();this.edges=[];this.started=0;}connect(n){this.edges.push(n);return n;}disconnect(){this.edges=[];}start(){this.started++;}stop(){this.stopped=true;} }
class AudioContextPort {constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.destination={};this.gains=[];this.sources=[];this.filters=[];this.resumeCalls=0;this.pending=[];contexts.push(this);}createGain(){const n=new AudioNodePort();this.gains.push(n);return n;}createBufferSource(){const n=new AudioNodePort();this.sources.push(n);return n;}createBiquadFilter(){const n=new AudioNodePort();this.filters.push(n);return n;}createBuffer(c,l,r){const a=new Float32Array(l);return{getChannelData:()=>a};}resume(){this.resumeCalls++;if(!trustedActivation)return new Promise(r=>this.pending.push(r));this.state='running';for(const r of this.pending.splice(0))r();return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
globalThis.AudioContext=AudioContextPort;

await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const element=id=>elements.get(id), canvas=element('cube'), snapshot=()=>globalThis.__cube.snapshot();
async function flush(){for(let index=0;index<8;index++)await Promise.resolve();}
async function settle(){assert(auditView.pending.length>0,'expected an animation');auditView.pending.shift().resolve();await flush();}
function frame(delta){now+=delta;const pending=frames;frames=[];for(const callback of pending)callback(now);}
function windowEvent(type){for(const callback of windowEvents[type]??[])callback();}
function visibility(hidden){document.hidden=hidden;for(const callback of documentEvents.visibilitychange??[])callback();}
function grab(dx,dy=0){canvas.dispatch('pointerdown');canvas.dispatch('pointermove',{clientX:100+dx,clientY:100+dy});}
function release(dx,dy=0){canvas.dispatch('pointerup',{clientX:100+dx,clientY:100+dy});}
function assertGated(){for(const id of ['cw','ccw','scramble','reset','undo','home'])assert(element(id).disabled,id+' must be disabled while grabbed');assert(faceButtons.every(button=>button.disabled));}
if(mode==='real-audio'){
canvas.dispatch('pointerdown',{pointerType:'touch'});
canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:77}],changedTouches:[{identifier:77}]});
canvas.dispatch('pointermove',{pointerType:'touch',clientX:195});
canvas.dispatch('pointerup',{pointerType:'touch',clientX:195});
assert.equal(contexts.length,1);const ctx=contexts[0];assert.equal(ctx.resumeCalls,1);assert.equal(ctx.state,'suspended');assert.equal(auditView.pending.length,1);
trustedActivation=true;
canvas.dispatch('touchend',{isTrusted:true,touches:[],changedTouches:[{identifier:77}]});await flush();
assert.equal(ctx.resumeCalls,2);assert.equal(ctx.state,'running');assert(ctx.gains[0].gain.calls.some(c=>c[0]===.081));assert.equal(ctx.sources.length,1);assert(ctx.sources[0].buffer.getChannelData(0).some(v=>v!==0));
assert.equal(ctx.sources[0].edges[0],ctx.filters[0]);assert.equal(ctx.filters[0].edges[0],ctx.gains[1]);assert.equal(ctx.gains[1].edges[0],ctx.gains[0]);assert.equal(ctx.gains[0].edges[0],ctx.destination);
canvas.dispatch('click',{isTrusted:true});assert.equal(auditView.pending.length,1);assert.equal(element('sound-dialog').open,false);
await settle();assert.equal(snapshot().session.history.length,1);assert.equal(ctx.sources.length,2);
console.log('PASS: actual MotionAudio + actual controller, blocked pointerup resume recovered by eligible touchend while queue busy; graph and PCM connected; one commit and one alignment.');process.exit(0);

}
if(mode==='webgl-unavailable') {
 assert.equal(element('recovery').hidden,false);element('sound-settings').click();assert(element('sound-dialog').open);element('sound-test').click();assert.equal(auditAudio.auditions,1);assert.match(element('recovery-copy').textContent,/開始できません/);assertGated();element('reload').click();assert.equal(reloads,1);
 console.log('PASS: WebGL startup failure retains recovery controls.');process.exit(0);
}
if(mode==='limit') {
 const before=snapshot().session;grab(95);release(95);await flush();assert.deepEqual(snapshot().session,before);assert.equal(auditView.preview,null,'rejected move must roll preview back');assert.equal(snapshot().busy,false);
 grab(0,95);assert.equal(auditView.preview.move.axis,'x');release(0,95);await flush();assert.equal(auditView.preview,null);assert.deepEqual(snapshot().session,before);
 assert.equal(auditAudio.alignments,0);assert(auditAudio.stops>0);
 console.log('PASS: move-limit rejection rolls preview back exactly and permits safe re-grab on another axis.');process.exit(0);
}
if(mode==='context-preview') {
 const before=snapshot().session;grab(120);assert(auditView.preview);auditView.onLost();assert.equal(auditView.preview,null,'context loss must discard held preview immediately');canvas.dispatch('pointermove',{clientX:240});assert.equal(auditView.preview,null,'stale held pointer must not re-preview after recovery');release(120);await flush();assert.deepEqual(snapshot().session,before);assert.equal(auditView.preview,null);assert.equal(auditView.pending.length,0);assert.equal(snapshot().busy,false);assert.equal(element('recovery').hidden,false);assert.equal(writes.at(-1).history.length,before.history.length);grab(120);assert.equal(auditView.preview,null);element('reload').click();assert.equal(reloads,1);
 assert.equal(auditAudio.alignments,0);assert(auditAudio.closed);
 console.log('PASS: context loss while holding rolls back, never commits, and gates new gestures until reload.');process.exit(0);
}
if(mode==='storage-denied') {
 assert.match(footer.textContent,/保存できません/);grab(95);release(95);await settle();assert.equal(snapshot().session.history.length,1);
 const before=snapshot().session;grab(95);release(95);auditView.onLost();auditView.pending.shift().reject(Error('WebGL context lost'));await flush();assert.deepEqual(snapshot().session,before);assert.equal(element('recovery').hidden,false);assert(!element('recovery-copy').textContent.includes('保存されています'));
 element('reload').click();assert.equal(reloads,0);assert(element('confirm-dialog').open);assert.match(element('confirm-copy').textContent,/失|消/);element('confirm-no').click();assert.equal(reloads,0);assert.deepEqual(snapshot().session,before);
 element('reload').click();element('confirm-yes').click();assert.equal(reloads,1);
 console.log('PASS: denied storage preserves committed state and requires loss confirmation before reload.');process.exit(0);
}
assert(!elements.has('gesture'),'no intrusive gesture-text overlay');
assert(globalThis.auditAudio,'motion audio adapter must be wired');assert.equal(auditAudio.alignments,0);assert.equal(auditAudio.unlocks,0);
assert.equal(app.style.getPropertyValue('--app-height'),'568px','use the actual visible viewport height');
visualViewport.scale=2;visualViewport.height=284;for(const callback of viewportEvents.resize??[])callback();assert.equal(app.style.getPropertyValue('--app-height'),'568px','pinch zoom must not reflow the game smaller');visualViewport.scale=1;visualViewport.height=568;
const style=readFileSync(resolve(root,'src/style.css'),'utf8');
assert.match(style,/-webkit-user-select\s*:\s*none/);assert.match(style,/-webkit-touch-callout\s*:\s*none/);assert.match(style,/touch-action\s*:\s*none/);
canvas.dispatch('contextmenu');assert.equal(prevented,1);
const initial=snapshot().session;
// Touch activation belongs to release, not pointerdown, according to the platform activation model.
const unlocksBeforeTouch=auditAudio.unlocks;canvas.dispatch('pointerdown',{pointerType:'touch'});assert.equal(auditAudio.unlocks,unlocksBeforeTouch,'touch-down must not leave an ineligible resume pending');canvas.dispatch('pointerup',{pointerType:'touch'});assert.equal(auditAudio.unlocks,unlocksBeforeTouch+1,'touch-up must synchronously unlock audio');assert.equal(auditAudio.lastUnlockForce,true);
for(const pointerType of ['touch','pen']){const before=auditAudio.unlocks;canvas.dispatch('pointerdown',{pointerType});canvas.dispatch('pointercancel',{pointerType});assert.equal(auditAudio.unlocks,before,'canceled nonmouse gesture does not unlock');canvas.dispatch('pointerdown',{pointerType});canvas.dispatch('pointerup',{pointerType});assert.equal(auditAudio.unlocks,before+1,'nonmouse release unlocks');}
// Safari's native touchend and a canvas tap retry directly without opening settings.
for(const type of ['touchend','click']){const before=auditAudio.unlocks;if(type==='touchend')canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:1}],changedTouches:[{identifier:1}]});canvas.dispatch(type,{isTrusted:true,touches:[],changedTouches:[{identifier:1}]});assert.equal(auditAudio.unlocks,before+1,type+' on the cube must directly retry audio');assert.equal(auditAudio.lastUnlockForce,true);assert.equal(element('sound-dialog').open,false);}
const beforeSynthetic=auditAudio.unlocks;canvas.dispatch('click',{isTrusted:false});canvas.dispatch('touchend',{isTrusted:false,touches:[]});canvas.dispatch('touchcancel',{isTrusted:true});assert.equal(auditAudio.unlocks,beforeSynthetic,'synthetic and canceled touch events must not unlock');
canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:1}],changedTouches:[{identifier:1}]});canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:1},{identifier:2}],changedTouches:[{identifier:2}]});canvas.dispatch('touchend',{isTrusted:true,touches:[{identifier:1}],changedTouches:[{identifier:2}]});assert.equal(auditAudio.unlocks,beforeSynthetic,'second-finger release must not unlock the active first touch');canvas.dispatch('touchcancel',{isTrusted:true,changedTouches:[{identifier:1}]});canvas.dispatch('touchend',{isTrusted:true,touches:[],changedTouches:[{identifier:1}]});assert.equal(auditAudio.unlocks,beforeSynthetic,'canceled first touch stays canceled');
canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:1}],changedTouches:[{identifier:1}]});canvas.dispatch('touchcancel',{isTrusted:true,changedTouches:[{identifier:2}]});canvas.dispatch('touchend',{isTrusted:true,touches:[],changedTouches:[{identifier:1}]});assert.equal(auditAudio.unlocks,beforeSynthetic+1,'canceling a secondary touch must not discard the primary activation');
// Motion appears before release; competing controls and partial state saves are gated.
grab(3);assert.equal(auditView.preview,null);assert.equal(auditAudio.movements.length,0);canvas.dispatch('pointermove',{clientX:140});assert.equal(auditView.preview.angle,.4);assert.equal(auditAudio.movements.at(-1),.4);assert.equal(auditAudio.alignments,0);assert.deepEqual(snapshot().session,initial);assertGated();
assert(element('help').disabled);const blockedToggle=prevented;element('helper-toggle').dispatch('click');assert.equal(prevented,blockedToggle+1,'helper expansion must be blocked during a held layer');for(const id of ['cw','reset','undo','home','help'])element(id).click();assert.equal(auditView.pending.length,0);frame(6000);assert.equal(writes.at(-1).history.length,0);
release(95);assert.equal(auditView.pending[0].options.fromAngle,.95);assert.equal(auditView.pending[0].options.toAngle,Math.PI/2);assert.equal(auditView.pending[0].options.quick,true);assert.equal(typeof auditView.pending[0].options.onProgress,'function');assert.equal(snapshot().session.history.length,0);await settle();assert.equal(auditAudio.alignments,1);assert.equal(snapshot().session.history.length,1);assert.deepEqual(snapshot().session.history[0],{axis:'y',layer:0,direction:1});
// Axis stays locked while the finger reverses or moves perpendicularly.
grab(6);canvas.dispatch('pointermove',{clientX:5,clientY:240});assert.equal(auditView.preview.move.axis,'y');assert.equal(auditView.preview.angle,-.95);release(-95,140);assert.equal(auditView.pending[0].move.direction,-1);await settle();assert.deepEqual(snapshot().session.cube,initial.cube);element('solved-dialog').close();
// Small drag returns without a logical move.
let committed=snapshot().session;const accentsBeforeCancel=auditAudio.alignments;grab(40);release(40);assert.equal(auditView.pending[0].options.toAngle,0);await settle();assert.deepEqual(snapshot().session,committed);
// The native fallback still runs after pointerup has started a settling queue.
const beforeNativeDrag=auditAudio.unlocks,alignmentsBeforeNativeDrag=auditAudio.alignments;canvas.dispatch('pointerdown',{pointerType:'touch'});canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:1}],changedTouches:[{identifier:1}]});canvas.dispatch('pointermove',{pointerType:'touch',clientX:140});canvas.dispatch('pointerup',{pointerType:'touch',clientX:140});assert(snapshot().busy);canvas.dispatch('touchend',{isTrusted:true,touches:[],changedTouches:[{identifier:1}]});canvas.dispatch('click',{isTrusted:true});assert.equal(auditAudio.unlocks,beforeNativeDrag+3);assert.equal(auditAudio.alignments,alignmentsBeforeNativeDrag,'activation events alone never add sound accents');assert.equal(auditView.pending.length,1,'fallback events never duplicate turns');await settle();assert.deepEqual(snapshot().session,committed);
// Cancellation paths retain exact state, ignore stale release, and do not unlock another pointer.
for(const cancel of ['pointercancel','lostpointercapture','resize','blur','visibilitychange','playfieldresize','visualviewport']) {
 committed=snapshot().session;grab(120);canvas.dispatch('pointercancel',{pointerId:2});assert.equal(auditView.pending.length,0);
 canvas.dispatch('touchstart',{isTrusted:true,touches:[{identifier:1}],changedTouches:[{identifier:1}]});const beforeInterruptedTouch=auditAudio.unlocks;
 if(cancel==='visualviewport'){visualViewport.height=460;for(const callback of viewportEvents.resize??[])callback();assert.equal(app.style.getPropertyValue('--app-height'),'460px');}else if(cancel==='playfieldresize')auditView.onResize();else if(cancel==='resize'||cancel==='blur')windowEvent(cancel);else if(cancel==='visibilitychange')visibility(true);else canvas.dispatch(cancel);
 assert.equal(auditView.pending[0].options.toAngle,0,cancel);await settle();release(120);canvas.dispatch('touchend',{isTrusted:true,touches:[],changedTouches:[{identifier:1}]});assert.equal(auditAudio.unlocks,beforeInterruptedTouch,cancel+' must discard stale native-touch activation');assert.equal(auditView.pending.length,0);assert.deepEqual(snapshot().session,committed);if(cancel==='visibilitychange')visibility(false);
}
assert.equal(auditAudio.alignments,accentsBeforeCancel,'all small/canceled gestures stay free of alignment accents');
canvas.dispatch('pointerdown');canvas.dispatch('pointerdown',{pointerId:2,isPrimary:false});canvas.dispatch('pointermove',{pointerId:2,clientX:230});canvas.dispatch('pointerup',{pointerId:2,clientX:230});assert.equal(auditView.preview,null);canvas.dispatch('pointercancel');
// Recoverable animation failure clears preview and permits a fresh axis.
committed=snapshot().session;grab(95);release(95);auditView.pending.shift().reject(Error('interrupted animation'));await flush();assert.deepEqual(snapshot().session,committed);assert.equal(auditView.preview,null);assert.equal(snapshot().busy,false);grab(0,95);assert.equal(auditView.preview.move.axis,'x');release(0,95);await settle();
// Orbit remains separate and does not turn a layer.
const beforeOrbitAudio=auditAudio.alignments;const beforeOrbitMotion=auditAudio.movements.length;
canvas.dispatch('pointerdown',{clientX:300});canvas.dispatch('pointermove',{clientX:330,clientY:110});canvas.dispatch('pointerup',{clientX:330,clientY:110});assert.equal(auditView.orbitX,30);assert.equal(auditView.orbitY,10);assert.equal(auditView.pending.length,0);assert.equal(auditAudio.alignments,beforeOrbitAudio);assert.equal(auditAudio.movements.length,beforeOrbitMotion);
// A coalesced gesture with no move event still uses its final displacement.
canvas.dispatch('pointerdown');release(95);assert.equal(auditView.pending[0].options.fromAngle,.95);await settle();
// Undo restores the last committed state and queue capacity remains bounded.
const beforeUndo=snapshot().session.history.length;element('undo').click();await settle();assert.equal(snapshot().session.history.length,beforeUndo-1);
for(let i=0;i<9;i++)element('cw').click();assert.equal(snapshot().queueSize,8);for(let i=0;i<8;i++)await settle();
// Long hold and app backgrounding never persist a partial geometry state.
grab(120);committed=snapshot().session;windowEvent('pagehide');assert.equal(writes.at(-1).history.length,committed.history.length);assert.equal(canvas.hasPointerCapture(1),false,'pagehide cancels held pointer immediately');assert(auditAudio.closed);canvas.dispatch('pointercancel');await settle();assert.deepEqual(snapshot().session,committed);
// Active play clock pauses in background.
if(!snapshot().session.started){element('cw').click();await settle();}
const elapsed=snapshot().session.elapsedMs;frame(1000);assert.equal(snapshot().session.elapsedMs,elapsed+1000);visibility(true);frame(60000);assert.equal(snapshot().session.elapsedMs,elapsed+1000);visibility(false);
// Loss during a release animation retains committed state and offers durable recovery.
committed=snapshot().session;grab(95);release(95);auditView.onLost();auditView.pending.shift().reject(Error('WebGL context lost'));await flush();assert.deepEqual(snapshot().session,committed);assert.equal(snapshot().queueSize,0);assert.equal(element('recovery').hidden,false);assertGated();visibility(true);visibility(false);frame(6000);assert.equal(snapshot().session.elapsedMs,committed.elapsedMs);element('reload').click();assert.equal(reloads,1);assert.equal(writes.at(-1).history.length,committed.history.length);
assert(auditAudio.hidden===false);assert(auditAudio.stops>0);
console.log('PASS: continuous preview, axis lock/reversal, small drag, cancellation, capture loss, second pointer, resize/blur/visibility, helper gating, queue cap, undo, saves, timer, selection suppression and WebGL recovery.');
