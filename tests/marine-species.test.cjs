const test=require('node:test'),assert=require('node:assert/strict');
const {species}=require('../public/marine-species');
const abilities=require('../skin-abilities');
const {calculateOrder}=require('../payments');
test('100 marine additions have unique identities, applied traits and authoritative prices',()=>{
 assert.equal(species.length,100);assert.equal(new Set(species.map(s=>s.id)).size,100);assert.equal(new Set(species.map(s=>s.name)).size,100);
 const methods={damage:'damageMultiplier',defense:'incomingDamageMultiplier',movement:'movementMultiplier',range:'targetRangeMultiplier',fireRate:'fireRateMultiplier',experience:'orbExperienceMultiplier',magnet:'magnetRangeMultiplier'};
 for(const s of species){assert.notEqual(abilities[methods[s.stat]](s.id),1);assert.ok(s.price>0);if(s.paid)assert.doesNotThrow(()=>calculateOrder(s.id,[]));else assert.throws(()=>calculateOrder(s.id,[]));}
});

test('marine catalog does not collapse each family into one color and server preserves marine ownership',()=>{
 const sharks=species.filter(s=>s.family==='shark');
 assert.ok(new Set(sharks.map(s=>s.color)).size>=8);
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/filter\(x => allowedSkinIds\.has\(x\)\)/);
 assert.doesNotMatch(server,/const allowed = new Set\(\['default','violet','solar','toxic'/);
});


test('all 100 marine species have unique art identities, not generic family recolors',()=>{
 assert.equal(new Set(species.map(s=>s.art?.key)).size,100);
 for(const family of new Set(species.map(s=>s.family))){
  const rows=species.filter(s=>s.family===family);
  assert.equal(new Set(rows.map(s=>s.art?.key)).size,rows.length,family);
  assert.ok(new Set(rows.map(s=>s.art?.tone)).size>=8,family);
 }
});


test('rarity is canonical data on every marine species',()=>{
 const allowed=new Set(['common','uncommon','rare','epic','legendary','mythic']);
 for(const s of species)assert.ok(allowed.has(s.rarity),s.id);
 assert.deepEqual(species.filter(s=>s.variant<=1).map(s=>s.rarity),Array(species.filter(s=>s.variant<=1).length).fill('common'));
 assert.ok(species.some(s=>s.rarity==='mythic'));
});


test('rarity controls premium access and abyssal coin escalation',()=>{
 const rank={common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5};
 for(const family of new Set(species.map(s=>s.family))){
  const rows=species.filter(s=>s.family===family).sort((a,b)=>a.variant-b.variant);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].coins>rows[i-1].coins,family+':'+i);
  for(const s of rows){
   assert.equal(s.paid,rank[s.rarity]>=4,s.id);
   assert.equal(s.unlockType,s.paid?'premium':'coins',s.id);
   if(s.paid)assert.ok(s.brl>=990,s.id);
  }
 }
});
