const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../public/abyssal-curated-skins'),A=require('../skin-abilities'),P=require('../payments');
test('new species have unique abilities and authoritative high coin prices',()=>{
 assert.equal(C.items.length,41);assert.equal(new Set(C.items.map(s=>s.ability)).size,41);
 for(const s of C.items){assert.ok(s.price>=45000);assert.equal(s.paid,false);const fn={damage:()=>A.damageMultiplier(s.id,'drifter',100,1),defense:()=>A.incomingDamageMultiplier(s.id),movement:()=>A.movementMultiplier(s.id),fireRate:()=>A.fireRateMultiplier(s.id),range:()=>A.targetRangeMultiplier(s.id),experience:()=>A.orbExperienceMultiplier(s.id),magnet:()=>A.magnetRangeMultiplier(s.id)}[s.stat];assert.equal(fn(),s.multiplier);}
});
test('premium reptiles cost exactly 999 centavos and have applied combat advantages',()=>{
 for(const id of ['saltcroc','blackcaiman'])assert.equal(P.PAID_SKINS[id].brl,999);
 assert.ok(A.damageMultiplier('saltcroc','boss',100,1)>2);
 assert.equal(A.incomingDamageMultiplier('blackcaiman'),.65);assert.equal(A.movementMultiplier('blackcaiman'),1.2);
});
