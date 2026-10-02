import * as THREE from 'three';
import { CubeScene } from './scene';
import { projectedDragTangents } from './projection';
import { interpolateAngle, settleDuration } from './drag';
import { AXIS_INDEX, type Axis, type CubeState, type Move, type Vec3i } from './model';
import type { Hit, ProjectedTangent } from './input';
const STEP=1.055;
const vector=(v:Vec3i)=>new THREE.Vector3(...v);
export class CubeView {
 readonly renderer:THREE.WebGLRenderer;
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(34,1,0.1,100);
 private cube=new CubeScene();
 private raycaster=new THREE.Raycaster();
 private theta=0.62;private phi=1.05;
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
  this.resize();this.loop();
 }
 sync(state:CubeState){this.preview=null;this.state=state;this.cube.sync(state);this.cube.highlight(this.selected);}
 previewMove(move:Move,angle:number){
  if(this.lost)return;
  if(!this.preview){this.preview=move;this.cube.beginTurn(move);}
  this.cube.setTurnAngle(angle);
 }
 async animate(move:Move,options:{fromAngle?:number;toAngle?:number;quick?:boolean}={}):Promise<void>{
  if(this.lost)throw new Error('WebGL context lost');
  this.preview=null;this.highlight(null);this.cube.beginTurn(move);
  const from=options.fromAngle??0,to=options.toAngle??move.direction*Math.PI/2;this.cube.setTurnAngle(from);
  const duration=settleDuration(from,to,options.quick,matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(duration===0){this.cube.setTurnAngle(to);return;}
  return new Promise((resolve,reject)=>{
   this.abortAnimation=reject;const start=performance.now();
   const step=(now:number)=>{if(this.lost)return;const t=Math.min(1,(now-start)/duration);this.cube.setTurnAngle(interpolateAngle(from,to,t));
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
 orbit(dx:number,dy:number){this.theta-=dx*.009;this.phi=Math.max(.25,Math.min(Math.PI-.25,this.phi-dy*.009));this.updateCamera();}
 home(){this.theta=.62;this.phi=1.05;this.updateCamera();}
 private updateCamera(){const distance=8.5;this.camera.position.setFromSphericalCoords(distance,this.phi,this.theta);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();}
 resize(){const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.renderer.setSize(rect.width,rect.height,false);this.camera.aspect=rect.width/rect.height;this.camera.fov=this.camera.aspect<.8?2*Math.atan(Math.tan(34*Math.PI/360)/this.camera.aspect*.8)*180/Math.PI:34;this.camera.updateProjectionMatrix();this.updateCamera();}
 private loop=()=>{this.frame=requestAnimationFrame(this.loop);if(!this.lost)this.renderer.render(this.scene,this.camera);};
 /** A read-only consistency probe for deterministic view/model verification. */
 snapshot(){return this.cube.snapshot();}
 dispose(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.cube.dispose();this.renderer.dispose();}
}
