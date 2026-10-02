import * as THREE from 'three';
import { CubeScene } from './scene';
import { projectedDragTangents } from './projection';
import { interpolateAngle, settleDuration } from './drag';
import { type CubeState, type Move, type Vec3i } from './model';
import type { Hit } from './input';
export class CubeView {
 readonly renderer:THREE.WebGLRenderer;
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(34,1,0.1,100);
 private cube=new CubeScene();
 private raycaster=new THREE.Raycaster();
 private orientation=new THREE.Quaternion();
 private distance=9.5;
 private lost=false;
 private abortAnimation:((reason:Error)=>void)|null=null;
 private selected:Vec3i|null=null;
 private preview:Move|null=null;
 private state:CubeState=[];
 private frame=0;
 private observer:ResizeObserver;
 constructor(private canvas:HTMLCanvasElement,private onContextLost:()=>void,onPlayfieldResize:()=>void=()=>{}){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.45;
  this.scene.add(this.cube);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0xc5cdc4,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3.6);key.position.set(-3,7,5);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xd4e7ff,1.2);fill.position.set(4,1,-3);this.scene.add(fill);
  this.observer=new ResizeObserver(()=>{onPlayfieldResize();this.resize();});this.observer.observe(canvas);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.abortAnimation?.(new Error('WebGL context lost'));this.onContextLost();});
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.sync(this.state);this.resize();});
  this.home();this.resize();this.loop();
 }
 sync(state:CubeState){this.preview=null;this.state=state;this.cube.sync(state);this.cube.highlight(this.selected);}
 previewMove(move:Move,angle:number){
  if(this.lost)return;
  if(!this.preview){this.preview=move;this.cube.beginTurn(move);}
  this.cube.setTurnAngle(angle);
 }
 async animate(move:Move,options:{fromAngle?:number;toAngle?:number;quick?:boolean;onProgress?:(angle:number)=>void}={}):Promise<void>{
  if(this.lost)throw new Error('WebGL context lost');
  this.preview=null;this.highlight(null);this.cube.beginTurn(move);
  const from=options.fromAngle??0,to=options.toAngle??move.direction*Math.PI/2;this.cube.setTurnAngle(from);
  const duration=settleDuration(from,to,options.quick,matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(duration===0){this.cube.setTurnAngle(to);return;}
  return new Promise((resolve,reject)=>{
   this.abortAnimation=reject;const start=performance.now();
   const step=(now:number)=>{if(this.lost)return;const t=Math.min(1,(now-start)/duration);const angle=interpolateAngle(from,to,t);this.cube.setTurnAngle(angle);try{options.onProgress?.(angle);}catch{/* Optional feedback must never interrupt a turn. */}
    if(t<1)requestAnimationFrame(step);else{this.abortAnimation=null;resolve();}};
   requestAnimationFrame(step);
  });
 }
 pick(clientX:number,clientY:number):Hit|null{
  const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
  return this.cube.pick(this.raycaster);
 }
 tangents(hit:Hit){const rect=this.canvas.getBoundingClientRect();return projectedDragTangents(hit,this.camera,{width:rect.width,height:rect.height});}

 highlight(normal:Vec3i|null){this.selected=normal;this.cube.highlight(normal);}
 /** Screen-relative quaternion orbit has no polar singularity or artificial clamp. */
 orbit(dx:number,dy:number){
  const length=Math.hypot(dx,dy);if(!Number.isFinite(length)||length===0)return;
  const axis=new THREE.Vector3(-dy,-dx,0).divideScalar(length);
  this.orientation.multiply(new THREE.Quaternion().setFromAxisAngle(axis,length*.009)).normalize();this.updateCamera();
 }
 home(){
  this.camera.up.set(0,1,0);this.camera.position.setFromSphericalCoords(1,1.05,.62);this.camera.lookAt(0,0,0);
  this.orientation=this.camera.quaternion.clone();this.updateCamera();
 }
 private updateCamera(){
  this.camera.quaternion.copy(this.orientation);
  this.camera.position.set(0,0,this.distance??9.5).applyQuaternion(this.orientation);
  this.camera.up.set(0,1,0).applyQuaternion(this.orientation);this.camera.updateMatrixWorld();
 }
 resize(){
  const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  this.renderer.setSize(rect.width,rect.height,false);this.camera.aspect=rect.width/rect.height;this.camera.fov=34;
  const padding=Math.min(14,rect.width*.04,rect.height*.04),tanHalf=Math.tan(this.camera.fov*Math.PI/360);
  const vertical=Math.atan(tanHalf*(1-2*padding/rect.height));
  const horizontal=Math.atan(tanHalf*this.camera.aspect*(1-2*padding/rect.width));
  // Fit the entire swept sphere, including perspective depth, not just a flat face.
  const radius=this.cube.boundingRadius();
  this.distance=radius/Math.sin(Math.min(vertical,horizontal));
  this.camera.near=Math.max(.1,this.distance-radius*1.1);this.camera.far=this.distance+radius*1.1;
  this.camera.updateProjectionMatrix();this.updateCamera();
 }
 private loop=()=>{this.frame=requestAnimationFrame(this.loop);if(!this.lost)this.renderer.render(this.scene,this.camera);};
 /** A read-only consistency probe for deterministic view/model verification. */
 snapshot(){return this.cube.snapshot();}
 dispose(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.cube.dispose();this.renderer.dispose();}
}
