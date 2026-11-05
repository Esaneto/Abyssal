'use strict';

const DEFAULT_RATE=900;
const DEFAULT_CAPACITY=420;

function consumeMovementBudget(state,displacement,now=Date.now(),options={}){
 if(!state||typeof state!=='object')return {allowed:false,budget:0,allowance:0};
 const distance=Math.max(0,Number(displacement)||0);
 const rate=Math.max(1,Number(options.rate)||DEFAULT_RATE);
 const capacity=Math.max(1,Number(options.capacity)||DEFAULT_CAPACITY);
 const timestamp=Math.max(0,Number(now)||Date.now());
 const previousAt=Number(state.movementBudgetAt);
 const elapsed=Number.isFinite(previousAt)&&previousAt>0?Math.max(0,Math.min(2,(timestamp-previousAt)/1000)):0;
 const previousBudget=Number.isFinite(Number(state.movementBudget))?Math.max(0,Math.min(capacity,Number(state.movementBudget))):capacity;
 const allowance=Math.min(capacity,previousBudget+elapsed*rate);
 const allowed=distance<=allowance+1;
 state.movementBudgetAt=timestamp;
 state.movementBudget=allowed?Math.max(0,allowance-distance):allowance;
 return {allowed,budget:state.movementBudget,allowance,rate,capacity,distance};
}

module.exports={DEFAULT_RATE,DEFAULT_CAPACITY,consumeMovementBudget};
