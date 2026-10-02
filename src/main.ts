import './style.css';
import { FACE_NORMALS, inverse, isSolved, makeScramble, type Move, type Vec3i } from './model';
import { newSession, commitMove, undoMove, tickSession, MAX_MOVES } from './session';
import { loadSession, saveSession } from './storage';
import { TurnQueue } from './queue';
import { beginPointer, resolveTapFace, type Hit } from './input';
import { inferDrag, dragAngle, releaseDrag, type DragLock, type DragProjection } from './drag';
import { CubeView } from './view';
const icons={shuffle:'<path d="m3 4 3 0 10 12h3m-4-3 4 3-4 3M3 16h3l3-4m3-4 4-4h3m-4-3 4 3-4 3"/>',undo:'<path d="M7 5 3 9l4 4M3 9h9a5 5 0 0 1 0 10h-2"/>',reset:'<path d="M4 7a8 8 0 1 1-1 8M4 2v5h5"/>',view:'<path d="m11 2 8 5v9l-8 5-8-5V7zM3 7l8 5 8-5m-8 5v9"/>'};
const svg=(name:keyof typeof icons)=>`<svg viewBox="0 0 22 22" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`<main class="app">
 <header class="topbar"><div class="brand"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><h1>ポケットキューブ</h1></div><button id="help" class="icon-button" aria-label="遊び方">?</button></header>
 <section class="stats" aria-label="プレイ記録"><div class="stat"><div id="moves" class="stat-value">0</div><div class="stat-label">手数</div></div><div class="stat-divider"></div><div class="stat"><div id="timer" class="stat-value">00:00</div><div class="stat-label">時間</div></div></section>
 <section class="playfield" aria-label="3Dキューブ"><canvas id="cube" draggable="false" aria-label="面をスワイプして回転。余白をドラッグして視点を変更。補助ボタンでも回転できます。"></canvas><div id="recovery" class="recovery" role="alert" hidden><p id="recovery-copy"></p><button id="reload">再読み込み</button></div><button id="home" class="icon-button view-reset" aria-label="視点を元に戻す">${svg('view')}</button></section>
 <p id="hint" class="hint">面で回す · 余白で360°見渡す</p>
 <section class="actions" aria-label="ゲーム操作"><button id="scramble" class="primary">${svg('shuffle')}スクランブル</button><div class="secondary-row"><button id="undo" class="secondary">${svg('undo')}1手戻す</button><button id="reset" class="secondary">${svg('reset')}リセット</button></div></section>
 <details class="helper"><summary id="helper-toggle">ボタンで回す</summary><div class="helper-panel"><div class="faces" aria-label="回す面">${['右','左','上','下','前','奥'].map((label,i)=>`<button class="face ${i===4?'active':''}" data-face="${i}" aria-pressed="${i===4}"><span>${['R','L','U','D','F','B'][i]}</span>${label}</button>`).join('')}</div><div class="turns"><button id="ccw">↶ 反時計回り</button><button id="cw">↷ 時計回り</button></div><p class="helper-note">基準の面を選択 · その面を正面から見た回転方向</p></div></details>
 <footer class="footer"><i></i> YOUR PROGRESS IS SAVED</footer>
 </main><div id="toast" class="toast" role="status"></div>
 <dialog id="help-dialog"><h2>指先で、ひとひねり。</h2><ul><li>スクランブルで、色をシャッフル。</li><li>色の面を上下・左右にスワイプすると、その列や行が回ります。</li><li>キューブのない余白をドラッグすると、上下も裏側も360°見渡せます。</li><li>操作に迷ったら「ボタンで回す」。</li></ul><p>6つの面を、それぞれ同じ色にそろえよう。時間は最初の1手から。画面を離れると一時停止します。</p><button class="primary" data-close>やってみる</button></dialog>
 <dialog id="confirm-dialog"><h2 id="confirm-title"></h2><p id="confirm-copy"></p><div class="dialog-actions"><button id="confirm-no">キャンセル</button><button id="confirm-yes">続ける</button></div></dialog>
 <dialog id="solved-dialog"><div class="celebration-icon">✦</div><h2>きれいに、そろった！</h2><p id="solved-copy"></p><button class="primary" data-close>いい気分。</button></dialog>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
// Safari's visible area can shrink independently of CSS layout viewport chrome.
function refreshViewport(){const viewport=window.visualViewport;if(viewport&&viewport.scale===1&&Number.isFinite(viewport.height)&&viewport.height>0)$('app').style.setProperty('--app-height',`${viewport.height}px`);}
refreshViewport();
let session=newSession();let storage:Storage|null=null;try{storage=localStorage;session=loadSession(storage);}catch{/* Private/storage-restricted browsers remain playable. */}
let storageWarning=false;let toastTimeout=0;
function toast(message:string){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>$('toast').classList.remove('show'),2800);}
function persist():boolean{if(!storage||!saveSession(storage,session)){document.querySelector('.footer')!.textContent='このブラウザでは保存できません';if(!storageWarning){storageWarning=true;toast('保存が使えません。この画面では続けて遊べます。');}return false;}return true;}
const formatTime=(milliseconds:number)=>{const seconds=Math.floor(milliseconds/1000),minutes=Math.floor(seconds/60);return`${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
let selectedFace=4;let disabled=false;let isHolding=false;let view:CubeView;
function showRecovery(message:string){$('recovery-copy').textContent=message;$('recovery').hidden=false;}
$('reload').onclick=()=>{if(persist())window.location.reload();else confirm('保存できませんでした','再読み込みすると今の状態が失われます。それでも再読み込みしますか？',()=>window.location.reload());};
try{view=new CubeView($<HTMLCanvasElement>('cube'),()=>{disabled=true;finishGesture(true);const saved=persist();update();showRecovery(saved?'3D表示が中断されました。最後に確定した状態は保存されています。再読み込みして続けてください。':'3D表示が中断され、保存もできませんでした。再読み込みすると、今の状態が失われます。');},()=>finishGesture(true));view.sync(session.cube);}catch{showRecovery('このブラウザでは3D表示を開始できませんでした。再読み込みするか、WebGL対応ブラウザで開いてください。');disabled=true;}
type Action={move:Move;undo?:boolean;fromAngle?:number;cancel?:boolean};
const queue=new TurnQueue<Action>(async action=>{
 if(session.history.length>=MAX_MOVES&&!action.undo&&!action.cancel){view.sync(session.cube);toast('手数の上限です。スクランブルで新しく始めよう。');return;}
 await view.animate(action.move,{fromAngle:action.fromAngle??0,toAngle:action.cancel?0:action.move.direction*Math.PI/2,quick:action.fromAngle!==undefined});
 if(action.cancel){view.sync(session.cube);update();return;}
 session=action.undo?undoMove(session):commitMove(session,action.move);view.sync(session.cube);persist();update();
 if(isSolved(session.cube)&&session.history.length>0&&queue.size<=1&&!action.undo){$('solved-copy').textContent=`${session.history.length}手、${formatTime(session.elapsedMs)}。指先の集中に、拍手。`;$<HTMLDialogElement>('solved-dialog').showModal();}
},()=>{view.sync(session.cube);if(!disabled)toast('回転を中断しました。最後の確定状態を保っています。');},()=>update());
function update(){
 $('moves').textContent=String(session.history.length);$('timer').textContent=formatTime(session.elapsedMs);
 $<HTMLButtonElement>('undo').disabled=disabled||queue.busy||isHolding||session.history.length===0;
 for(const id of ['scramble','reset'])$<HTMLButtonElement>(id).disabled=disabled||queue.busy||isHolding;
 for(const id of ['cw','ccw'])$<HTMLButtonElement>(id).disabled=disabled||isHolding;
 $<HTMLButtonElement>('home').disabled=disabled||queue.busy||isHolding;
 $<HTMLButtonElement>('help').disabled=queue.busy||isHolding;
 $('helper-toggle').setAttribute('aria-disabled',String(queue.busy||isHolding));
 document.querySelectorAll<HTMLButtonElement>('[data-face]').forEach(button=>button.disabled=disabled||isHolding);
}
function enqueue(move:Move){if(disabled||isHolding)return;if(!queue.enqueue({move}))toast('回転が終わってから、もう一度。');}
let confirmAction:(()=>void)|null=null;
function confirm(title:string,copy:string,action:()=>void){$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;confirmAction=action;$<HTMLDialogElement>('confirm-dialog').showModal();}
$('confirm-no').onclick=()=>{$<HTMLDialogElement>('confirm-dialog').close();confirmAction=null;};
$('confirm-yes').onclick=()=>{$<HTMLDialogElement>('confirm-dialog').close();const action=confirmAction;confirmAction=null;action?.();};
$<HTMLDialogElement>('confirm-dialog').addEventListener('cancel',()=>{confirmAction=null;});
$('scramble').onclick=()=>{const go=()=>{session=newSession(makeScramble());view.sync(session.cube);persist();update();toast('準備完了。最初の1手で、計測スタート。');};if(session.history.length>0&&!isSolved(session.cube))confirm('新しく、始める？','今のキューブをシャッフルして、手数と時間をリセットします。',go);else go();};
$('reset').onclick=()=>confirm('最初の状態に戻す？','6面の色をそろえて、手数と時間をリセットします。',()=>{session=newSession();view.sync(session.cube);persist();update();toast('また、ひとひねり。');});
$('undo').onclick=()=>{const last=session.history.at(-1);if(last&&!queue.busy)queue.enqueue({move:inverse(last),undo:true});};
$('helper-toggle').addEventListener('click',event=>{if(isHolding||queue.busy)event.preventDefault();});
$('home').onclick=()=>view?.home();$('help').onclick=()=>$<HTMLDialogElement>('help-dialog').showModal();
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog')!.close());
function selectFace(index:number){
 if(isHolding||disabled)return;
 selectedFace=index;
 document.querySelectorAll<HTMLButtonElement>('[data-face]').forEach(button=>{const active=Number(button.dataset.face)===index;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 if(!queue.busy)view?.highlight(FACE_NORMALS[index]);
}
document.querySelectorAll<HTMLButtonElement>('[data-face]').forEach(button=>button.onclick=()=>selectFace(Number(button.dataset.face)));
for(const [id,sign] of [['cw',-1],['ccw',1]] as const)$(id).onclick=()=>{const normal=FACE_NORMALS[selectedFace],index=normal.findIndex(n=>n!==0);enqueue({axis:(['x','y','z'] as const)[index],layer:normal[index] as -1|1,direction:sign*normal[index] as -1|1});};
const canvas=$<HTMLCanvasElement>('cube');
type Gesture={id:number;startX:number;startY:number;x:number;y:number;hit:Hit|null;projections:DragProjection[];lock:DragLock|null;angle:number};
let gesture:Gesture|null=null;
function clearGesture(){
 const previous=gesture;gesture=null;isHolding=false;
 if(previous&&canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);
 view?.highlight(null);update();
}
function updateDrag(g:Gesture,x:number,y:number){
 if(!g.hit)return;
 const delta={x:x-g.startX,y:y-g.startY};
 g.lock??=inferDrag(g.hit,delta,g.projections);
 if(g.lock){g.angle=dragAngle(g.lock,delta);view.previewMove(g.lock.move,g.angle);}
}
function finishGesture(canceled:boolean,x?:number,y?:number){
 const current=gesture;if(!current)return;
 if(!canceled&&x!==undefined&&y!==undefined&&current.hit)updateDrag(current,x,y);
 const release=current.lock?releaseDrag(current.lock,current.angle,canceled):null;
 const face=!canceled&&current.hit&&!current.lock?resolveTapFace(current.hit,{x:(x??current.x)-current.startX,y:(y??current.y)-current.startY}):null;
 clearGesture();
 if(disabled){view?.sync(session.cube);return;}
 if(release)queue.enqueue(release);else if(face!==null)selectFace(face);
}
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',event=>{
 if(disabled||queue.busy||!beginPointer(!!gesture,event.isPrimary)||event.button!==0)return;
 const hit=view.pick(event.clientX,event.clientY);
 gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,hit,projections:hit?view.tangents(hit):[],lock:null,angle:0};
 isHolding=!!hit;canvas.setPointerCapture(event.pointerId);if(hit)view.highlight(hit.normal);update();
});
canvas.addEventListener('pointermove',event=>{
 if(disabled||!gesture||gesture.id!==event.pointerId)return;
 if(gesture.hit)updateDrag(gesture,event.clientX,event.clientY);else view.orbit(event.clientX-gesture.x,event.clientY-gesture.y);
 gesture.x=event.clientX;gesture.y=event.clientY;
});
canvas.addEventListener('pointerup',event=>{if(gesture?.id===event.pointerId)finishGesture(false,event.clientX,event.clientY);});
canvas.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId)finishGesture(true);});
canvas.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)finishGesture(true);});
window.addEventListener('resize',()=>{finishGesture(true);refreshViewport();});
window.visualViewport?.addEventListener('resize',()=>{finishGesture(true);refreshViewport();});
window.addEventListener('blur',()=>finishGesture(true));
let last=performance.now(),lastSaved=last;
function clock(now:number){const delta=now-last;last=now;if(!document.hidden&&!disabled)session=tickSession(session,delta);$('timer').textContent=formatTime(session.elapsedMs);if(now-lastSaved>5000){persist();lastSaved=now;}requestAnimationFrame(clock);}
document.addEventListener('visibilitychange',()=>{last=performance.now();finishGesture(true);persist();});
window.addEventListener('pagehide',persist);
update();persist();requestAnimationFrame(clock);
// Read-only diagnostics exist in the development build only, never mutate live sessions.
if(import.meta.env.DEV)(window as unknown as {__cube:unknown}).__cube={snapshot:()=>({session:structuredClone(session),view:view.snapshot(),busy:queue.busy,queueSize:queue.size})};
