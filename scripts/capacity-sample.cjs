'use strict';

const healthUrl=String(process.env.HEALTH_URL||process.argv[2]||'http://127.0.0.1:3000/health');
const durationSec=Math.max(5,Math.min(600,Number(process.env.CAPACITY_SAMPLE_SECONDS||process.argv[3]||60)));
const intervalMs=Math.max(250,Math.min(5000,Number(process.env.CAPACITY_SAMPLE_INTERVAL_MS||1000)));

const samples=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percentile=(values,p)=>{
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!sorted.length)return 0;
 const index=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));
 return sorted[index];
};
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;

async function readHealth(){
 const response=await fetch(healthUrl,{headers:{accept:'application/json'},signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw new Error(`HTTP ${response.status}`);
 return response.json();
}

async function main(){
 const started=Date.now(),deadline=started+durationSec*1000;
 console.log(`[capacity] amostrando ${healthUrl} por ${durationSec}s a cada ${intervalMs}ms`);
 while(Date.now()<deadline){
  const at=Date.now();
  try{
   const health=await readHealth();
   samples.push({
    at,
    cpu:finite(health?.resources?.cpu?.processPercent),
    hostCpu:finite(health?.resources?.cpu?.hostCapacityPercent),
    rss:finite(health?.resources?.memory?.rssMB),
    heap:finite(health?.resources?.memory?.heapUsedMB),
    elu:finite(health?.resources?.eventLoopUtilization),
    lagP95:finite(health?.eventLoopLag?.p95Ms),
    tickLast:finite(health?.simulation?.tickProcessing?.lastMs),
    tickAvg:finite(health?.simulation?.tickProcessing?.avgMs),
    tickMax:finite(health?.simulation?.tickProcessing?.maxMs),
    players:finite(health?.activePlayers),
    enemies:finite(health?.simulation?.totalEnemies),
    rooms:finite(health?.activeRooms),
    roomTicks:Array.isArray(health?.simulation?.activeRoomDetails)
      ? health.simulation.activeRoomDetails.map(room=>({
        id:String(room.id),
        players:finite(room.players),
        enemies:finite(room.enemies),
        tickAvg:finite(room?.tickProcessing?.avgMs),
        tickMax:finite(room?.tickProcessing?.maxMs)
       }))
      :[]
   });
  }catch(error){
   console.warn('[capacity] amostra falhou:',error.message);
  }
  const delay=Math.max(0,intervalMs-(Date.now()-at));
  if(delay)await sleep(delay);
 }
 if(!samples.length)throw new Error('Nenhuma amostra válida recebida.');

 const cpu=samples.map(x=>x.cpu),hostCpu=samples.map(x=>x.hostCpu),rss=samples.map(x=>x.rss);
 const lag=samples.map(x=>x.lagP95),tick=samples.map(x=>x.tickAvg);
 const summary={
  samples:samples.length,
  durationSec:Number(((Date.now()-started)/1000).toFixed(1)),
  cpu:{avgPercent:Number(average(cpu).toFixed(2)),p95Percent:Number(percentile(cpu,95).toFixed(2)),maxPercent:Number(Math.max(...cpu).toFixed(2)),hostCapacityP95Percent:Number(percentile(hostCpu,95).toFixed(2))},
  memory:{avgRssMB:Number(average(rss).toFixed(1)),maxRssMB:Number(Math.max(...rss).toFixed(1))},
  eventLoop:{p95LagMs:Number(percentile(lag,95).toFixed(2)),maxLagP95Ms:Number(Math.max(...lag).toFixed(2)),utilizationAvg:Number(average(samples.map(x=>x.elu)).toFixed(4))},
  simulation:{avgTickMs:Number(average(tick).toFixed(3)),p95TickMs:Number(percentile(tick,95).toFixed(3)),maxObservedTickMs:Number(Math.max(...samples.map(x=>x.tickMax)).toFixed(3)),maxPlayers:Math.max(...samples.map(x=>x.players)),maxEnemies:Math.max(...samples.map(x=>x.enemies)),maxActiveRooms:Math.max(...samples.map(x=>x.rooms))}
 };
 summary.headroom={
  tickBudgetMs:50,
  p95TickBudgetUsedPercent:Number((summary.simulation.p95TickMs/50*100).toFixed(1)),
  verdict:summary.simulation.p95TickMs<=10&&summary.eventLoop.p95LagMs<=20?'excellent':summary.simulation.p95TickMs<=20&&summary.eventLoop.p95LagMs<=35?'healthy':summary.simulation.p95TickMs<35?'warning':'critical'
 };
 console.log(JSON.stringify(summary,null,2));
}

main().catch(error=>{console.error('[capacity]',error.message);process.exit(1);});
