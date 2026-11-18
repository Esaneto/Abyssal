'use strict';
// One-off read of a PUBLIC GameMaster HUD profile, without credentials or writes.
(async()=>{
 const root='https://abyssalgame.duckdns.org/socket.io/?EIO=4&transport=polling';
 const get=async url=>(await fetch(url,{signal:AbortSignal.timeout(12000)})).text();
 const post=async(url,body)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('post '+r.status)};
 const start=await get(root+'&t='+Date.now());
 const packet=start.split('\x1e').find(s=>s.startsWith('0{'));
 if(!packet)throw Error('No Engine.IO open packet: '+start.slice(0,100));
 const sid=JSON.parse(packet.slice(1)).sid,url=root+'&sid='+encodeURIComponent(sid);
 await post(url,'40');await get(url);
 await post(url,'42'+JSON.stringify(['get-public-profile',{nickname:'GameMaster'}]));
 for(let i=0;i<5;i++){
  const reply=await get(url);
  for(const msg of reply.split('\x1e')){if(msg==='2'){await post(url,'3');continue;}if(!msg.startsWith('42'))continue;const data=JSON.parse(msg.slice(2));if(data[0]==='public-profile-result'){if(!data[1].ok)throw Error('Public profile: '+data[1].message);console.log('PUBLIC_GAMEMASTER_DESKTOP='+JSON.stringify(data[1].profile?.hudLayout?.desktop||{}));console.log('PUBLIC_GAMEMASTER_LANDSCAPE='+JSON.stringify(data[1].profile?.hudLayout?.landscape||{}));console.log('PUBLIC_GAMEMASTER_PORTRAIT='+JSON.stringify(data[1].profile?.hudLayout?.portrait||{}));return;}}
 }
 throw Error('Public profile response not available');
})().catch(e=>{console.log('PUBLIC_GAMEMASTER_PROBE_UNAVAILABLE='+String(e.message));});
