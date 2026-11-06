'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');

test('Royal skin remains a siphonophore colony instead of reusing the starter silhouette',()=>{
 const start=game.indexOf("else if(id==='royal')"),end=game.indexOf("else if(id==='toxic')",start);
 assert.ok(start>=0&&end>start);const royal=game.slice(start,end);
 assert.match(royal,/colonial siphonophore/);assert.match(royal,/pearl-chain spine/);assert.match(royal,/tentacle\(-\.52/);
});

test('skin rarity visuals and rarity filter are removed',()=>{
 assert.doesNotMatch(game,/SHOP_RARITY|skinShopRarity|shopRarityRank|RELIC_SKIN_IDS|ABYSSAL_SIGNATURE_IDS/);
 assert.doesNotMatch(game,/Rarity signatures distinguish collectible forms/);
 assert.doesNotMatch(html,/shopRarityFilter|Todas as raridades|class="skin-rarity/);
});

test('pelican eel skin and boss keep the mouth and gain a long eel body',()=>{
 const skinStart=game.indexOf("}else if(id==='maw'){"),skinEnd=game.indexOf("}else{",skinStart);
 const bossStart=game.indexOf(" } else if(kind==='maw'){"),bossEnd=game.indexOf(" } else if(kind==='whiteShark'",bossStart);
 const skin=game.slice(skinStart,skinEnd),boss=game.slice(bossStart,bossEnd);
 assert.ok(skinStart>0&&skinEnd>skinStart&&bossStart>0&&bossEnd>bossStart);
 assert.match(game,/const eelTail=\(\)=>/);
 assert.match(game,/-3\.12\*r/);
 assert.match(skin,/eelTail\(\)/);assert.match(boss,/eelTail\(\)/);
 assert.match(skin,/ellipse\(\.12\*r,0,\.56\*r,\.63\*r/);
 assert.match(boss,/ellipse\(\.2\*r,0,\.56\*r,\.63\*r/);

});

test('oarfish leviathan uses a ribbon body and continuous dorsal crest while preserving its palette',()=>{
 const skinStart=game.indexOf("} else if(id==='leviathan'){"),skinEnd=game.indexOf("} else if(id==='voidwing'){",skinStart);
 const bossStart=game.indexOf(" } else if(kind==='leviathan'){"),bossEnd=game.indexOf(" } else if(kind==='maw'){",bossStart);
 const skin=game.slice(skinStart,skinEnd),boss=game.slice(bossStart,bossEnd);
 assert.ok(skinStart>0&&skinEnd>skinStart&&bossStart>0&&bossEnd>bossStart);
 assert.match(game,/id:'leviathan',name:'Eco do Peixe-Remo Leviatã',color:'#ff668f'/);
 assert.match(game,/const oarfishRibbon=\(\)=>/);
 assert.match(game,/for\(let i=0;i<26;i\+\+\)/);assert.match(game,/#ff668f/);
 assert.match(skin,/oarfishRibbon\(\)/);assert.match(boss,/oarfishRibbon\(\)/);
 assert.match(game,/c\.moveTo\(-3\.25\*r,wave\*r\)/);
 assert.match(skin,/c\.moveTo\(\.50\*r,-\.29\*r\)/,'Leviathan forehead must now be a connected shape, not a detached ellipse');
 assert.match(game,/c\.ellipse\(\.88\*r,-\.015\*r,\.43\*r,\.3\*r/);

});

test('blue-ring octopus is blue with eight downward arms and black damaging ink',()=>{
 const skinStart=game.indexOf("if(id==='aberration'){"),skinEnd=game.indexOf("}else if(id==='angler'){",skinStart);
 const bossStart=game.indexOf(" } else if(kind==='boss'){"),bossEnd=game.indexOf(" } else if(kind==='devourer'){",bossStart);
 const skin=game.slice(skinStart,skinEnd),boss=game.slice(bossStart,bossEnd);
 const helperStart=game.indexOf("const blueRingOctopus="),helperEnd=game.indexOf("if(playerCreature){",helperStart);
 const helper=game.slice(helperStart,helperEnd);
 assert.ok(helperStart>0&&helperEnd>helperStart);
 assert.match(game,/id:'aberration',name:'Eco do Polvo-de-Anéis-Azuis',color:'#338cff'/);
 assert.match(skin,/blueRingOctopus\(\)/);assert.match(boss,/blueRingOctopus\(\)/);
 assert.match(helper,/for\(let arm=0;arm<8;arm\+\+\)/);
 assert.match(helper,/c2y:1\.5/);assert.match(helper,/ey:2\.22\+\(arm%3\)\*\.16/);
 assert.match(helper,/#348fe7/);assert.match(helper,/#67ddff/);
 assert.match(game,/type:'ink-trail'/);assert.match(game,/blue-ring-ink/);

});

test('anglerfish has a huge open mouth, luminous lure and exact camouflage cycle',()=>{
 const skinStart=game.indexOf("}else if(id==='angler'){"),skinEnd=game.indexOf("}else if(id==='maw'){",skinStart);
 const bossStart=game.indexOf(" } else if(kind==='angler'){"),bossEnd=game.indexOf("// Bioluminescent side line",bossStart);
 const skin=game.slice(skinStart,skinEnd),boss=game.slice(bossStart,bossEnd);
 const helperStart=game.indexOf('const drawAnglerAnatomy=');
 const helperEnd=game.indexOf('const blueRingOctopus=',helperStart);
 const drawing=game.slice(helperStart,helperEnd);
 assert.ok(helperStart>0&&helperEnd>helperStart);
 assert.match(skin,/drawAnglerAnatomy\(false\)/);assert.match(boss,/drawAnglerAnatomy\(true\)/);
 assert.match(drawing,/throat\.addColorStop\(0,'#a9475b'\)/);
 assert.match(drawing,/Upper jaw arches sharply upward/);
 assert.match(drawing,/lower jaw hangs down/);
 assert.match(drawing,/for\(let i=0;i<11;i\+\+\)/);
 assert.doesNotMatch(skin,/'#07101a'|'#050910'/);
 assert.doesNotMatch(boss,/'#050b13'|'#02070d'/);
 assert.match(drawing,/globalCompositeOperation='lighter'/);
 assert.match(game,/const lureOnly=/);assert.match(game,/lureOnly\(\.55,-1\.18\)/);
 assert.match(game,/phase<3000/);assert.match(game,/phase<13000/);assert.match(game,/phase<16000/);assert.match(game,/%26000/);
 assert.match(game,/anglerConcealed/);

});

test('Kraken identity and eight-arm silhouette remain untouched',()=>{
 const start=game.indexOf("if(id==='kraken')"),end=game.indexOf("else if(id==='default')",start),kraken=game.slice(start,end);
 assert.match(kraken,/for\(let arm=0;arm<8;arm\+\+\)/);assert.match(kraken,/Glass-octopus inspired Kraken/);
});
