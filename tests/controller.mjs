/** Controller integration using fake DOM and CubeView ports.
 * These checks exercise application state/event wiring, not browser rendering,
 * native pointer dispatch, Safari behavior, WebGL, or perceived touch latency.
 * Run from repository: node tests/controller.mjs [projectRoot] [mode]
 * Modes: normal, storage-denied, webgl-unavailable, context-preview, limit.
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
  builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
 }}],
});
let now = 0, frames = [], reloads = 0, prevented = 0;
const elements = new Map(), faceButtons = [], closeButtons = [];
const windowEvents = {}, documentEvents = {}, writes = [], storage = new Map();
class Element {
 constructor(id) {
  this.id=id;this.disabled=false;this.open=false;this.events={};this.dataset={};
  this.textContent='';this.captured=new Set();
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
globalThis.document={hidden:false,getElementById:id=>elements.get(id),querySelector:selector=>selector==='#app'?app:selector==='.footer'?footer:null,querySelectorAll:selector=>selector==='[data-close]'?closeButtons:selector==='[data-face]'?faceButtons:[],addEventListener:(type,handler)=>(documentEvents[type]??=[]).push(handler)};
globalThis.addEventListener=(type,handler)=>(windowEvents[type]??=[]).push(handler);
globalThis.requestAnimationFrame=handler=>{frames.push(handler);return frames.length;};
globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
globalThis.location={reload(){reloads++;}};
globalThis.performance={now:()=>now};
if(mode==='limit')storage.set('pocket-cube:session:v1',JSON.stringify({version:1,setup:[],history:Array.from({length:10000},()=>({axis:'x',layer:1,direction:1})),elapsedMs:0,started:false}));
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(mode==='storage-denied')throw Error('Storage denied');storage.set(key,value);writes.push(JSON.parse(value));}};
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
if(mode==='webgl-unavailable') {
 assert.equal(element('recovery').hidden,false);assert.match(element('recovery-copy').textContent,/開始できません/);assertGated();element('reload').click();assert.equal(reloads,1);
 console.log('PASS: WebGL startup failure retains recovery controls.');process.exit(0);
}
if(mode==='limit') {
 const before=snapshot().session;grab(95);release(95);await flush();assert.deepEqual(snapshot().session,before);assert.equal(auditView.preview,null,'rejected move must roll preview back');assert.equal(snapshot().busy,false);
 grab(0,95);assert.equal(auditView.preview.move.axis,'x');release(0,95);await flush();assert.equal(auditView.preview,null);assert.deepEqual(snapshot().session,before);
 console.log('PASS: move-limit rejection rolls preview back exactly and permits safe re-grab on another axis.');process.exit(0);
}
if(mode==='context-preview') {
 const before=snapshot().session;grab(120);assert(auditView.preview);auditView.onLost();assert.equal(auditView.preview,null,'context loss must discard held preview immediately');canvas.dispatch('pointermove',{clientX:240});assert.equal(auditView.preview,null,'stale held pointer must not re-preview after recovery');release(120);await flush();assert.deepEqual(snapshot().session,before);assert.equal(auditView.preview,null);assert.equal(auditView.pending.length,0);assert.equal(snapshot().busy,false);assert.equal(element('recovery').hidden,false);assert.equal(writes.at(-1).history.length,before.history.length);grab(120);assert.equal(auditView.preview,null);element('reload').click();assert.equal(reloads,1);
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
const style=readFileSync(resolve(root,'src/style.css'),'utf8');
assert.match(style,/-webkit-user-select\s*:\s*none/);assert.match(style,/-webkit-touch-callout\s*:\s*none/);assert.match(style,/touch-action\s*:\s*none/);
canvas.dispatch('contextmenu');assert.equal(prevented,1);
const initial=snapshot().session;
// Motion appears before release; competing controls and partial state saves are gated.
grab(3);assert.equal(auditView.preview,null);canvas.dispatch('pointermove',{clientX:140});assert.equal(auditView.preview.angle,.4);assert.deepEqual(snapshot().session,initial);assertGated();
assert(element('help').disabled);const blockedToggle=prevented;element('helper-toggle').dispatch('click');assert.equal(prevented,blockedToggle+1,'helper expansion must be blocked during a held layer');for(const id of ['cw','reset','undo','home','help'])element(id).click();assert.equal(auditView.pending.length,0);frame(6000);assert.equal(writes.at(-1).history.length,0);
release(95);assert.equal(auditView.pending[0].options.fromAngle,.95);assert.equal(auditView.pending[0].options.toAngle,Math.PI/2);assert.equal(auditView.pending[0].options.quick,true);assert.equal(snapshot().session.history.length,0);await settle();assert.equal(snapshot().session.history.length,1);assert.deepEqual(snapshot().session.history[0],{axis:'y',layer:0,direction:1});
// Axis stays locked while the finger reverses or moves perpendicularly.
grab(6);canvas.dispatch('pointermove',{clientX:5,clientY:240});assert.equal(auditView.preview.move.axis,'y');assert.equal(auditView.preview.angle,-.95);release(-95,140);assert.equal(auditView.pending[0].move.direction,-1);await settle();assert.deepEqual(snapshot().session.cube,initial.cube);element('solved-dialog').close();
// Small drag returns without a logical move.
let committed=snapshot().session;grab(40);release(40);assert.equal(auditView.pending[0].options.toAngle,0);await settle();assert.deepEqual(snapshot().session,committed);
// Cancellation paths retain exact state, ignore stale release, and do not unlock another pointer.
for(const cancel of ['pointercancel','lostpointercapture','resize','blur','visibilitychange','playfieldresize']) {
 committed=snapshot().session;grab(120);canvas.dispatch('pointercancel',{pointerId:2});assert.equal(auditView.pending.length,0);
 if(cancel==='playfieldresize')auditView.onResize();else if(cancel==='resize'||cancel==='blur')windowEvent(cancel);else if(cancel==='visibilitychange')visibility(true);else canvas.dispatch(cancel);
 assert.equal(auditView.pending[0].options.toAngle,0,cancel);await settle();release(120);assert.equal(auditView.pending.length,0);assert.deepEqual(snapshot().session,committed);if(cancel==='visibilitychange')visibility(false);
}
canvas.dispatch('pointerdown');canvas.dispatch('pointerdown',{pointerId:2,isPrimary:false});canvas.dispatch('pointermove',{pointerId:2,clientX:230});canvas.dispatch('pointerup',{pointerId:2,clientX:230});assert.equal(auditView.preview,null);canvas.dispatch('pointercancel');
// Recoverable animation failure clears preview and permits a fresh axis.
committed=snapshot().session;grab(95);release(95);auditView.pending.shift().reject(Error('interrupted animation'));await flush();assert.deepEqual(snapshot().session,committed);assert.equal(auditView.preview,null);assert.equal(snapshot().busy,false);grab(0,95);assert.equal(auditView.preview.move.axis,'x');release(0,95);await settle();
// Orbit remains separate and does not turn a layer.
canvas.dispatch('pointerdown',{clientX:300});canvas.dispatch('pointermove',{clientX:330,clientY:110});canvas.dispatch('pointerup',{clientX:330,clientY:110});assert.equal(auditView.orbitX,30);assert.equal(auditView.orbitY,10);assert.equal(auditView.pending.length,0);
// A coalesced gesture with no move event still uses its final displacement.
canvas.dispatch('pointerdown');release(95);assert.equal(auditView.pending[0].options.fromAngle,.95);await settle();
// Undo restores the last committed state and queue capacity remains bounded.
const beforeUndo=snapshot().session.history.length;element('undo').click();await settle();assert.equal(snapshot().session.history.length,beforeUndo-1);
for(let i=0;i<9;i++)element('cw').click();assert.equal(snapshot().queueSize,8);for(let i=0;i<8;i++)await settle();
// Long hold and app backgrounding never persist a partial geometry state.
grab(120);committed=snapshot().session;windowEvent('pagehide');assert.equal(writes.at(-1).history.length,committed.history.length);canvas.dispatch('pointercancel');await settle();assert.deepEqual(snapshot().session,committed);
// Active play clock pauses in background.
if(!snapshot().session.started){element('cw').click();await settle();}
const elapsed=snapshot().session.elapsedMs;frame(1000);assert.equal(snapshot().session.elapsedMs,elapsed+1000);visibility(true);frame(60000);assert.equal(snapshot().session.elapsedMs,elapsed+1000);visibility(false);
// Loss during a release animation retains committed state and offers durable recovery.
committed=snapshot().session;grab(95);release(95);auditView.onLost();auditView.pending.shift().reject(Error('WebGL context lost'));await flush();assert.deepEqual(snapshot().session,committed);assert.equal(snapshot().queueSize,0);assert.equal(element('recovery').hidden,false);assertGated();visibility(true);visibility(false);frame(6000);assert.equal(snapshot().session.elapsedMs,committed.elapsedMs);element('reload').click();assert.equal(reloads,1);assert.equal(writes.at(-1).history.length,committed.history.length);
console.log('PASS: continuous preview, axis lock/reversal, small drag, cancellation, capture loss, second pointer, resize/blur/visibility, helper gating, queue cap, undo, saves, timer, selection suppression and WebGL recovery.');
