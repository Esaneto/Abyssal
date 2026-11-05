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
