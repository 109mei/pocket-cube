import { applyMove, createSolved, inverse, isSolved, type CubeState, type Move } from './model';
export const MAX_MOVES=10000;
export const MAX_ELAPSED_MS=365*24*60*60*1000;
export type Session={cube:CubeState;setup:Move[];history:Move[];elapsedMs:number;started:boolean};
export function newSession(setup:Move[]=[]):Session{return{cube:setup.reduce(applyMove,createSolved()),setup:[...setup],history:[],elapsedMs:0,started:false};}
export function commitMove(session:Session,move:Move):Session{
 if(session.history.length>=MAX_MOVES)return session;
 const cube=applyMove(session.cube,move);
 return{...session,cube,history:[...session.history,move],started:!isSolved(cube)};
}
export function undoMove(session:Session):Session{
 const last=session.history.at(-1);if(!last)return session;
 const cube=applyMove(session.cube,inverse(last));const history=session.history.slice(0,-1);
 return{...session,cube,history,started:!isSolved(cube)&&history.length>0};
}
export function tickSession(session:Session,deltaMs:number):Session{
 if(!session.started||!Number.isFinite(deltaMs)||deltaMs<=0)return session;
 return{...session,elapsedMs:Math.min(MAX_ELAPSED_MS,session.elapsedMs+deltaMs)};
}
