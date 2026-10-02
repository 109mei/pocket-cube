/** Tests actual CubeView/CubeScene math with a controlled frame clock.
 * No WebGL context or browser is mocked as visually working.
 */
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]??resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const require=createRequire(resolve(root,'package.json'));
const {build}=require('esbuild');

const code=`
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CubeView} from './src/view';
import {CubeScene} from './src/scene';
import {CUBIE_STEP,STICKER_OFFSET} from './src/geometry';
import {createSolved,applyMove} from './src/model';
import {settleDuration} from './src/drag';

let now=0,callbacks=[],reduced=false;
globalThis.performance={now:()=>now};
globalThis.matchMedia=()=>({matches:reduced});
globalThis.requestAnimationFrame=fn=>{callbacks.push(fn);
return callbacks.length};

const scene=new CubeScene();
const view=Object.create(CubeView.prototype);
view.cube=scene;
view.lost=false;
view.preview=null;
view.selected=null;
view.abortAnimation=null;

const initial=createSolved();
function poses(){scene.updateMatrixWorld(true);
const result=[];
scene.traverse(o=>{if(o.userData.sticker)result.push({id:o.userData.sticker.id,p:o.getWorldPosition(new THREE.Vector3()).toArray(),n:new THREE.Vector3(0,0,1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).toArray()})});
return result.sort((a,b)=>a.id-b.id)}
function exact(state){const current=poses();
for(const sticker of state){const p=current[sticker.id];
for(let i=0;
i<3;
i++){assert(Math.abs(p.p[i]-(sticker.position[i]*CUBIE_STEP+sticker.normal[i]*STICKER_OFFSET))<1e-10);
assert(Math.abs(p.n[i]-sticker.normal[i])<1e-10)}}}
let cycles=0;
for(const axis of ['x','y','z'])for(const layer of [-1,0,1])for(const direction of [-1,1])for(const fraction of [.05,.55,1]){
 const move={axis,layer,direction};
view.sync(initial);
const from=direction*Math.PI/2*fraction;
view.previewMove(move,from);
const held=poses();
const framesBefore=callbacks.length;
const duration=settleDuration(from,direction*Math.PI/2,true,false);
let complete=false;
const animation=view.animate(move,{fromAngle:from,toAngle:direction*Math.PI/2,quick:true}).then(()=>complete=true);
assert.deepEqual(poses(),held,'release must start at held pose');

 if(duration===0){await animation;
assert.equal(callbacks.length,framesBefore,'already-complete turn needs no animation frame');
}else{assert(!complete);
now+=duration/2;
const step=callbacks;
callbacks=[];
for(const cb of step)cb(now);
assert(!complete);
now+=duration;
const end=callbacks;
callbacks=[];
for(const cb of end)cb(now);
await animation;
}
 exact(applyMove(initial,move));
view.sync(applyMove(initial,move));
exact(applyMove(initial,move));
cycles++;

 // A canceled partial drag settles to the unchanged exact position.
 view.sync(initial);
view.previewMove(move,from);
const cancel=view.animate(move,{fromAngle:from,toAngle:0,quick:true});
now+=100;
const pending=callbacks;
callbacks=[];
for(const cb of pending)cb(now);
await cancel;
exact(initial);
view.sync(initial);

}
reduced=true;
view.sync(initial);
const move={axis:'z',layer:0,direction:1};
view.previewMove(move,.9);
const count=callbacks.length;
await view.animate(move,{fromAngle:.9,quick:true});
assert.equal(callbacks.length,count);
exact(applyMove(initial,move));

console.log(JSON.stringify({actualCubeViewAnimatedCases:cycles,cancelCases:cycles,noZeroPoseJump:true,alreadyCompleteReleaseUsesNoFrame:true,reducedMotionUsesNoFrame:true,worldTransformsExact:true}));
scene.dispose();
`;

const out=await build({stdin:{contents:code,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));

