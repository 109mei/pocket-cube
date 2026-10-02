import { applyMove, isSolved, validMove, type Move } from './model';
import { MAX_ELAPSED_MS, MAX_MOVES, newSession, type Session } from './session';
export const STORAGE_KEY='pocket-cube:session:v1';
export function encodeSession(session:Session):string{return JSON.stringify({version:1,setup:session.setup,history:session.history,elapsedMs:session.elapsedMs,started:session.started});}
export function decodeSession(raw:string):Session|null{
 try{
  if(raw.length>2000000)return null;
  const v=JSON.parse(raw);
  if(!v||v.version!==1||!Array.isArray(v.setup)||!Array.isArray(v.history)||v.setup.length>MAX_MOVES||v.history.length>MAX_MOVES||![...v.setup,...v.history].every(validMove)||!Number.isFinite(v.elapsedMs)||v.elapsedMs<0||v.elapsedMs>MAX_ELAPSED_MS||typeof v.started!=='boolean')return null;
  // Copy only validated fields; extraneous serialized objects never become simulation state.
  const clean=(moves:Move[])=>moves.map(({axis,layer,direction})=>({axis,layer,direction}));
  const s=newSession(clean(v.setup));s.history=clean(v.history);s.cube=s.history.reduce(applyMove,s.cube);s.elapsedMs=v.elapsedMs;s.started=v.started&&s.history.length>0&&!isSolved(s.cube);return s;
 }catch{return null;}
}
type StoragePort=Pick<Storage,'getItem'|'setItem'>;
export function loadSession(storage:StoragePort):Session{try{return decodeSession(storage.getItem(STORAGE_KEY)??'')??newSession();}catch{return newSession();}}
export function saveSession(storage:StoragePort,session:Session):boolean{try{storage.setItem(STORAGE_KEY,encodeSession(session));return true;}catch{return false;}}
