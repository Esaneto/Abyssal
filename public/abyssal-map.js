(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AbyssalMap=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const WORLD_WIDTH=4800;
  const WORLD_HEIGHT=3000;
  const VERSION=1;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  function seedValue(input){
    const text=String(input??'abyssal');
    let h=2166136261>>>0;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }

  function rngFromSeed(seed){
    let state=seedValue(seed)||0x9e3779b9;
    return function(){
      state=(state+0x6D2B79F5)>>>0;
      let t=state;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  const ROOM_BLUEPRINTS=Object.freeze([
    Object.freeze({id:'start',type:'start',x:620,y:260,rx:320,ry:215,depth:0}),
    Object.freeze({id:'shoal',type:'common',x:1250,y:560,rx:355,ry:225,depth:1}),
    Object.freeze({id:'trench',type:'common',x:2150,y:880,rx:390,ry:235,depth:2}),
    Object.freeze({id:'lantern',type:'common',x:3340,y:1120,rx:390,ry:245,depth:3}),
    Object.freeze({id:'junction',type:'common',x:2550,y:1430,rx:360,ry:225,depth:4}),
    Object.freeze({id:'elite',type:'elite',x:1100,y:1700,rx:335,ry:220,depth:5,optional:true}),
    Object.freeze({id:'event',type:'event',x:4050,y:1550,rx:300,ry:210,depth:5,optional:true}),
    Object.freeze({id:'hub',type:'hub',x:2520,y:1950,rx:445,ry:280,depth:6}),
    Object.freeze({id:'landing',type:'landing',x:3050,y:2390,rx:335,ry:210,depth:7}),
    Object.freeze({id:'boss',type:'boss',x:3850,y:2680,rx:520,ry:250,depth:8})
  ]);

  const EDGE_BLUEPRINTS=Object.freeze([
    Object.freeze({a:'start',b:'shoal',width:185}),
    Object.freeze({a:'shoal',b:'trench',width:175}),
    Object.freeze({a:'trench',b:'lantern',width:175}),
    Object.freeze({a:'lantern',b:'junction',width:175}),
    Object.freeze({a:'junction',b:'hub',width:195}),
    Object.freeze({a:'junction',b:'elite',width:135,optional:true}),
    Object.freeze({a:'lantern',b:'event',width:135,optional:true}),
    Object.freeze({a:'landing',b:'boss',width:220})
  ]);

  function createLayout(seed='abyssal',tier=0){
    const random=rngFromSeed(seed);
    const tierNumber=Math.max(0,Math.floor(Number(tier)||0));
    const roomOffsets=new Map();
    for(const base of ROOM_BLUEPRINTS){
      if(base.id==='start'||base.id==='hub'||base.id==='landing'||base.id==='boss'){
        roomOffsets.set(base.id,0);
      }else{
        roomOffsets.set(base.id,(random()-.5)*(base.optional?260:220));
      }
    }
    const rooms=ROOM_BLUEPRINTS.map(base=>{
      let x=base.x+(roomOffsets.get(base.id)||0);
      if(base.id==='elite')x=clamp(x,760,1450);
      if(base.id==='event')x=clamp(x,3650,4250);
      x=clamp(x,base.rx+80,WORLD_WIDTH-base.rx-80);
      const scale=1+Math.min(.08,tierNumber*.008);
      return Object.freeze({...base,x:Math.round(x),rx:Math.round(base.rx*scale),ry:Math.round(base.ry*scale)});
    });
    const byId=id=>rooms.find(room=>room.id===id);
    const corridors=EDGE_BLUEPRINTS.map(edge=>{
      const a=byId(edge.a),b=byId(edge.b);
      return Object.freeze({...edge,x1:a.x,y1:a.y,x2:b.x,y2:b.y});
    });
    const hub=byId('hub'),landing=byId('landing'),start=byId('start'),boss=byId('boss');
    const portals=Object.freeze({
      start:Object.freeze({id:'start-vortex',type:'start',x:start.x-120,y:start.y-20,r:72}),
      surface:Object.freeze({id:'surface-vortex',type:'surface',x:hub.x-155,y:hub.y+20,r:78}),
      descent:Object.freeze({id:'descent-hole',type:'descent',x:hub.x+175,y:hub.y+22,r:84,targetX:landing.x,targetY:landing.y-40}),
      landing:Object.freeze({id:'descent-landing',type:'landing',x:landing.x,y:landing.y-40,r:88,targetX:hub.x+175,targetY:hub.y+22}),
      boss:Object.freeze({id:'boss-sigil',type:'boss',x:boss.x,y:boss.y,r:110})
    });
    return Object.freeze({
      version:VERSION,
      seed:seedValue(seed),
      tier:tierNumber,
      width:WORLD_WIDTH,
      height:WORLD_HEIGHT,
      rooms:Object.freeze(rooms),
      corridors:Object.freeze(corridors),
      portals,
      bossRoomId:'boss',
      startRoomId:'start',
      hubRoomId:'hub'
    });
  }

  function pointSegmentDistance(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
    if(len<=1e-9)return Math.hypot(px-ax,py-ay);
    const t=clamp(((px-ax)*dx+(py-ay)*dy)/len,0,1);
    return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
  }

  function pointInRoom(room,x,y,padding=0){
    if(!room)return false;
    const rx=Math.max(16,Number(room.rx)-padding),ry=Math.max(16,Number(room.ry)-padding);
    const nx=(x-room.x)/rx,ny=(y-room.y)/ry;
    return nx*nx+ny*ny<=1;
  }

  function pointInCorridor(corridor,x,y,padding=0){
    if(!corridor)return false;
    const radius=Math.max(20,Number(corridor.width)-padding);
    return pointSegmentDistance(x,y,corridor.x1,corridor.y1,corridor.x2,corridor.y2)<=radius;
  }

  function isWalkable(layout,x,y,padding=0){
    if(!layout||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return false;
    const px=Number(x),py=Number(y),pad=Math.max(0,Number(padding)||0);
    if(px<0||py<0||px>layout.width||py>layout.height)return false;
    for(const room of layout.rooms)if(pointInRoom(room,px,py,pad))return true;
    for(const corridor of layout.corridors)if(pointInCorridor(corridor,px,py,pad))return true;
    return false;
  }

  function segmentWalkable(layout,x1,y1,x2,y2,padding=0){
    const distance=Math.hypot(x2-x1,y2-y1);
    const steps=Math.max(1,Math.ceil(distance/55));
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      if(!isWalkable(layout,x1+(x2-x1)*t,y1+(y2-y1)*t,padding))return false;
    }
    return true;
  }

  function resolveMove(layout,fromX,fromY,toX,toY,padding=0){
    const fx=Number(fromX),fy=Number(fromY),tx=Number(toX),ty=Number(toY);
    if(!layout||![fx,fy,tx,ty].every(Number.isFinite))return {x:fx||0,y:fy||0,blocked:true};
    if(isWalkable(layout,tx,ty,padding))return {x:tx,y:ty,blocked:false};
    if(isWalkable(layout,tx,fy,padding))return {x:tx,y:fy,blocked:true,slid:true};
    if(isWalkable(layout,fx,ty,padding))return {x:fx,y:ty,blocked:true,slid:true};
    let low=0,high=1;
    for(let i=0;i<10;i++){
      const mid=(low+high)/2,mx=fx+(tx-fx)*mid,my=fy+(ty-fy)*mid;
      if(isWalkable(layout,mx,my,padding))low=mid;else high=mid;
    }
    return {x:fx+(tx-fx)*low,y:fy+(ty-fy)*low,blocked:true};
  }

  function roomAt(layout,x,y,padding=0){
    if(!layout)return null;
    let best=null,bestScore=Infinity;
    for(const room of layout.rooms){
      if(!pointInRoom(room,x,y,padding))continue;
      const nx=(x-room.x)/Math.max(1,room.rx),ny=(y-room.y)/Math.max(1,room.ry),score=nx*nx+ny*ny;
      if(score<bestScore){best=room;bestScore=score;}
    }
    return best;
  }

  function nearestRoom(layout,x,y,allowedIds=null){
    if(!layout)return null;
    const allowed=allowedIds?new Set(allowedIds):null;
    let best=null,distance=Infinity;
    for(const room of layout.rooms){
      if(allowed&&!allowed.has(room.id))continue;
      const d=Math.hypot(Number(x)-room.x,Number(y)-room.y);
      if(d<distance){best=room;distance=d;}
    }
    return best;
  }

  function adjacency(layout,includePortal=false){
    const graph=new Map(layout.rooms.map(room=>[room.id,[]]));
    for(const edge of layout.corridors){
      graph.get(edge.a)?.push(edge.b);
      graph.get(edge.b)?.push(edge.a);
    }
    if(includePortal){
      graph.get('hub')?.push('landing');
      graph.get('landing')?.push('hub');
    }
    return graph;
  }

  function roomPath(layout,fromId,toId,includePortal=false){
    if(!fromId||!toId)return [];
    if(fromId===toId)return [fromId];
    const graph=adjacency(layout,includePortal),queue=[fromId],previous=new Map([[fromId,null]]);
    while(queue.length){
      const current=queue.shift();
      for(const next of graph.get(current)||[]){
        if(previous.has(next))continue;
        previous.set(next,current);
        if(next===toId){
          const path=[toId];let cursor=current;
          while(cursor){path.push(cursor);cursor=previous.get(cursor);}
          return path.reverse();
        }
        queue.push(next);
      }
    }
    return [];
  }

  function navigationTarget(layout,fromX,fromY,toX,toY,options={}){
    if(!layout)return {x:toX,y:toY,direct:true};
    const padding=Math.max(0,Number(options.padding)||0);
    if(segmentWalkable(layout,fromX,fromY,toX,toY,padding))return {x:toX,y:toY,direct:true};
    const fromRoom=roomAt(layout,fromX,fromY)||nearestRoom(layout,fromX,fromY);
    const toRoom=roomAt(layout,toX,toY)||nearestRoom(layout,toX,toY);
    if(!fromRoom||!toRoom)return {x:toX,y:toY,direct:true};
    const path=roomPath(layout,fromRoom.id,toRoom.id,Boolean(options.includePortal));
    if(path.length<2)return {x:fromRoom.x,y:fromRoom.y,direct:false,blocked:true};
    const next=layout.rooms.find(room=>room.id===path[1]);
    return next?{x:next.x,y:next.y,direct:false,roomId:next.id}:{x:toX,y:toY,direct:true};
  }

  function pointInPortal(portal,x,y,padding=0){
    if(!portal)return false;
    return Math.hypot(Number(x)-portal.x,Number(y)-portal.y)<=Math.max(8,portal.r-padding);
  }

  function spawnPoint(layout,options={}){
    if(!layout)return {x:WORLD_WIDTH*.5,y:WORLD_HEIGHT*.5,roomId:null};
    const random=typeof options.random==='function'?options.random:Math.random;
    const type=String(options.type||'common');
    const bosses=Math.max(0,Math.floor(Number(options.bossesDefeated)||0));
    let candidates;
    if(type==='boss')candidates=['boss'];
    else if(type==='elite')candidates=['elite'];
    else if(options.initial)candidates=['shoal','trench'];
    else if(bosses>=5)candidates=['junction','lantern','event','elite','hub'];
    else if(bosses>=3)candidates=['trench','lantern','junction','event'];
    else if(bosses>=1)candidates=['shoal','trench','lantern','junction'];
    else candidates=['shoal','trench','lantern'];
    const room=nearestRoom(layout,0,0,[candidates[Math.floor(random()*candidates.length)]])||layout.rooms[0];
    const angle=random()*Math.PI*2,radial=Math.sqrt(random())*.56;
    return {
      x:room.x+Math.cos(angle)*room.rx*radial,
      y:room.y+Math.sin(angle)*room.ry*radial,
      roomId:room.id
    };
  }

  function startSpawn(layout,index=0,count=1){
    const room=layout?.rooms?.find(item=>item.id==='start');
    if(!room)return {x:WORLD_WIDTH*.5,y:WORLD_HEIGHT*.5};
    const safeCount=Math.max(1,Math.floor(Number(count)||1)),slot=Math.max(0,Math.floor(Number(index)||0));
    const angle=(Math.PI*2*slot)/safeCount;
    const radius=Math.min(room.rx,room.ry)*.22;
    return {x:room.x+Math.cos(angle)*radius,y:room.y+Math.sin(angle)*radius};
  }

  return Object.freeze({
    VERSION,WORLD_WIDTH,WORLD_HEIGHT,ROOM_BLUEPRINTS,EDGE_BLUEPRINTS,
    seedValue,rngFromSeed,createLayout,pointSegmentDistance,pointInRoom,pointInCorridor,
    isWalkable,segmentWalkable,resolveMove,roomAt,nearestRoom,roomPath,navigationTarget,
    pointInPortal,spawnPoint,startSpawn
  });
});
