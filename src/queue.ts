/** Eight accepted actions including the active animation. Commits belong to the supplied atomic step. */
export class TurnQueue<T>{
 private pending:T[]=[];private running=false;
 constructor(private step:(value:T)=>Promise<void>,private onError:(error:unknown)=>void=()=>{},private onChange:()=>void=()=>{}){}
 get busy(){return this.running;}
 get size(){return this.pending.length+(this.running?1:0);}
 enqueue(value:T):boolean{
  if(this.size>=8)return false;
  this.pending.push(value);if(!this.running)void this.pump();this.onChange();return true;
 }
 private async pump(){
  this.running=true;
  try{while(this.pending.length){const value=this.pending.shift()!;this.onChange();await this.step(value);}}
  catch(error){this.pending=[];this.onError(error);}
  finally{this.running=false;this.onChange();}
 }
}
