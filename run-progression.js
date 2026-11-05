'use strict';

function ensureRunProgression(run){
 if(!run||typeof run!=='object')return null;
 run.authoritativeXp=Math.max(0,Number(run.authoritativeXp)||0);
 run.authoritativeXpNeed=Math.max(1,Math.floor(Number(run.authoritativeXpNeed)||10));
 run.pendingUpgradeCredits=Math.max(0,Math.min(64,Math.floor(Number(run.pendingUpgradeCredits)||0)));
 return run;
}

function creditRunXp(run,value){
 const state=ensureRunProgression(run),amount=Math.max(0,Number(value)||0);
 if(!state||amount<=0)return 0;
 state.authoritativeXp+=amount;
 let credits=0;
 while(state.authoritativeXp>=state.authoritativeXpNeed&&credits<16){
  state.authoritativeXp-=state.authoritativeXpNeed;
  state.authoritativeXpNeed=Math.floor(state.authoritativeXpNeed*1.34+3);
  state.pendingUpgradeCredits=Math.min(64,state.pendingUpgradeCredits+1);
  credits++;
 }
 return credits;
}

module.exports={ensureRunProgression,creditRunXp};
