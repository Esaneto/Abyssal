'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('source PNG has nine-frame shark strips, blue octopus row, valid alpha atlas signature',()=>{
 const data=fs.readFileSync(path.join(root,'public/abyssal-eco-sprites.png'));
 assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(data.readUInt32BE(16),576);
 assert.equal(data.readUInt32BE(20),512);
 assert.ok(data.length>10000&&data.length<90000,'mobile sprite atlas should stay lightweight');
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),'9ab72212628d1cc55edb93deb63eea21596b3cc7bc8c8a906fdf9deea82de95f');
 assert.equal(data.subarray(-8,-4).toString('ascii'),'IEND');
});
test('animated atlas supports all shark Ecos, hostile sharks and boss octopus',()=>{
 const sprite=read('public/abyssal-animated-sprites.js');
 new vm.Script(sprite,{filename:'abyssal-animated-sprites.js'});
 const api=require('../public/abyssal-animated-sprites.js');
 const keys=['reefshark','hammerhead','tigershark','abysscroc','greenland','aberration','whiteShark','whiteSharkBoss','boss'];
 for(const key of keys)assert.equal(api.has(key),true,key);
 assert.equal(api.SPECIES.hammerhead.moveRow,2);
 assert.equal(api.SPECIES.hammerhead.attackRow,3);
 assert.equal(api.SPECIES.tigershark.moveRow,4);
 assert.equal(api.SPECIES.tigershark.attackRow,5);
 assert.equal(api.SPECIES.aberration.cell,128);
 assert.equal(api.SPECIES.aberration.count,4);
 assert.equal(api.SPECIES.abysscroc.palette,'red');
 assert.equal(api.SPECIES.greenland.palette,'green');
 assert.match(sprite,/imageSmoothingEnabled=true/);
 assert.match(sprite,/ready=image\.naturalWidth===576&&image\.naturalHeight===512/);
 assert.match(sprite,/const frame=selectFrame/);
 assert.match(sprite,/const side=cfg\.span\*r/);
});
test('existing active abilities and attack/collision systems remain preserved',()=>{
 const skin=require('../public/skin-standard.js');
 assert.equal(skin.profile('reefshark').active,'trail');
 assert.equal(skin.profile('hammerhead').active,'pulse');
 assert.equal(skin.profile('abysscroc').active,'dash');
 assert.equal(skin.profile('greenland').active,'push');
 assert.equal(skin.profile('aberration').active,'trail');
 assert.equal(skin.profile('tigershark').active,'slowShot');
 assert.equal(skin.activeSpec('tigershark').name,'Projétil Hipotérmico');
 assert.equal(skin.profile('tigershark').tier,'coins');
 const game=read('public/game.js');
 assert.match(game,/const atlas=window\.AbyssalAnimatedSprites/);
 assert.match(game,/const spriteId=playerCreature\?skin\?\.id/);
 assert.match(game,/atlas\.drawAtOrigin\(c,spriteId,r,animationTime,attacking,hit,enemyState\)/);
 assert.match(game,/drawRiftShopSpecimen\(e,specimenSkin,t\)/);
 const scale=require('../public/creature-scale.js');
 assert.ok(scale.companionCollisionRadius('tigershark')>0);
 assert.ok(scale.companionCollisionRadius('tigershark')<scale.visualRadius('tigershark'));
});
test('tiger-shark metadata and palette integrate into existing Echo catalog and offline game',()=>{
 const game=read('public/game.js'),curated=read('public/abyssal-curated-skins.js');
 const sw=read('public/offline-sw.js'),html=read('public/index.html');
 const fauna=read('public/abyssal-open-sea-ecology.js');
 assert.match(game,/id:'tigershark',name:'Tubarão-Tigre'/);
 assert.match(game,/id:'abysscroc',name:'Tubarão-Touro Estuarino',color:'#bb4651'/);
 assert.match(curated,/"id": "greenland"[\s\S]*?"color": "#36ac70"/);
 assert.match(fauna,/tigershark/);
 assert.match(html,/abyssal-animated-sprites\.js\?v=2026\.11\.20\.2/);
 assert.match(sw,/'abyssal-eco-sprites\.png'/);
 assert.ok(sw.includes("'abyssal-sharks-2.5d.webp'"));
 assert.match(sw,/'abyssal-animated-sprites\.js'/);
 assert.match(sw,/2026-11-20-animated-ecos-v306/);
});

test('sprite renderer advances nado and ataque frames for hammerhead, tiger and octopus',()=>{
 const recorded=[];
 const painter={save(){},restore(){},drawImage(...args){recorded.push(args);},transform(){},translate(){},rotate(){},beginPath(){},rect(){},clip(){},imageSmoothingEnabled:true};
 const base={drawImage(){},getImageData(){return {data:new Uint8ClampedArray(576*128*4)};},putImageData(){}};
 class SpriteImage{
  constructor(){this.naturalWidth=576;this.naturalHeight=512;}
  set src(value){this.path=value;if(this.onload)this.onload();}
 }
 const win={
  Image:SpriteImage,
  document:{createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext(){return base;}};}}
 };
 vm.runInNewContext(read('public/abyssal-animated-sprites.js'),win);
 const sprites=win.AbyssalAnimatedSprites;
 assert.ok(sprites.status().ready);
 const render=(id,t,attack)=>{
  recorded.length=0;assert.equal(sprites.drawAtOrigin(painter,id,18,t,attack),true,id);
  assert.equal(recorded.length,2);return recorded[0].slice(1,5);
 };
 assert.deepEqual(render('reefshark',110,false),[64,0,64,64]);
 assert.deepEqual(render('reefshark',54,true),[64,64,64,64]);
 assert.deepEqual(render('hammerhead',110,false),[64,128,64,64]);
 assert.deepEqual(render('hammerhead',54,true),[64,192,64,64]);
 assert.deepEqual(render('tigershark',110,false),[64,256,64,64]);
 assert.deepEqual(render('tigershark',54,true),[64,320,64,64]);
 assert.deepEqual(render('aberration',175,false),[128,384,128,128]);
 assert.deepEqual(render('boss',350,true),[384,384,128,128]);
 assert.deepEqual(render('abysscroc',110,false),[64,0,64,64]);
 assert.deepEqual(render('greenland',54,true),[64,64,64,64]);
});

test('attack-only frames do not trigger for pursuing, charging or merely aggressive fauna',()=>{
 const src=read('public/game.js');
 assert.match(src,/const attacking=atlas\.isBiting\?\.\(enemyState,performance\.now\(\)\)===true/);
 const pos=src.indexOf('const attacking=atlas.isBiting?.(enemyState,performance.now())');
 assert.ok(pos>=0);
 const detector=src.slice(pos,src.indexOf('c.save();c.translate(x,y);',pos));
 assert.doesNotMatch(detector,/openSeaWantsAttack|sharkCharging|attackCd/);
 assert.match(src,/e\.visualBiteStartedAt=performance\.now\(\)/);
 const sprites=require('../public/abyssal-animated-sprites.js');
 assert.equal(sprites.biteProgress(null,100,false),-1);
 assert.equal(sprites.selectFrame('reefshark',330,false,null,true),2);
 assert.ok(sprites.selectFrame('reefshark',100,true,{biteAnimation:{startedAt:0,duration:350}},true)>=3);
 assert.equal(sprites.selectFrame('reefshark',100,true,{biteAnimation:{startedAt:0,duration:350}},true)<=8,true);
 assert.match(read('public/abyssal-animated-sprites.js'),/c\.transform\(/);
 assert.match(read('public/game.js'),/const swimHeading=Number\.isFinite/);
});

test('refined 2.5D atlas contains five distinct 3x3 sheets in verified WebP container',()=>{
 const b=fs.readFileSync(path.join(root,'public/abyssal-sharks-2.5d.webp'));
 assert.equal(b.subarray(0,4).toString('ascii'),'RIFF');
 assert.equal(b.subarray(8,12).toString('ascii'),'WEBP');
 assert.equal(b.subarray(12,16).toString('ascii'),'VP8X');
 const width=1+b[24]+(b[25]<<8)+(b[26]<<16);
 const height=1+b[27]+(b[28]<<8)+(b[29]<<16);
 assert.equal(width,576);
 assert.equal(height,2880);
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'c743dc557c86c40ab646956b724ca71cfd52e12da217a8d6c1bf687a48880951');
 const src=read('public/abyssal-animated-sprites.js');
 assert.ok(src.includes("hdSourceName='abyssal-sharks-2.5d.webp"));
 for(const [id,art] of [['reefshark',0],['tigershark',1],['abysscroc',2],['greenland',3],['hammerhead',4]]){
  assert.equal(require('../public/abyssal-animated-sprites.js').SPECIES[id].art,art,id);
 }
});

test('monotonic bite event clock ignores per-entity swimming offset',()=>{
 const api=require('../public/abyssal-animated-sprites.js'),event={hostileBite:{startedAt:1000,duration:400}};
 assert.equal(api.isBiting(event,1100),true);
 assert.equal(api.isBiting(event,1401),false);
 assert.equal(api.selectFrame('reefshark',6200,true,event,true,1100),4);
 assert.equal(api.selectFrame('reefshark',6200,true,event,true,1401),2);
 assert.equal(api.selectFrame('reefshark',6200,false,event,true,1100),2);
});
test('wild 2.5D species use individual animated rendering before shared cache',()=>{
 const src=read('public/game.js'),p=src.indexOf('function drawRiftShopSpecimen(');
 const block=src.slice(p,src.indexOf('function drawSpecimenBite(',p));
 assert.match(block,/if\(atlas\?\.has\(skin\.id\)\)/);
 assert.match(block,/atlas\.isBiting\?\.\(enemy,performance\.now\(\)\)/);
 assert.match(block,/atlas\.drawAtOrigin\(ctx,skin\.id,radius,/);
 assert.ok(block.indexOf('if(painted)return;')<block.indexOf('const key=skin.id+'));
 assert.match(block,/Number\.isFinite\(motion\?\.heading\)/);
});
