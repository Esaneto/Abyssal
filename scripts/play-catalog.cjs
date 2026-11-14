'use strict';
const {PAID_SKINS,BOSS_BUNDLE_BRL}=require('../payments');
const avatar=require('../public/avatar-base');
const fs=require('node:fs'),path=require('node:path');
function productId(key){return key.startsWith('avatar:')?'cosmetic_'+key.slice(7).replace(/:/g,'_').toLowerCase():'specimen_'+key.toLowerCase();}
function buildCatalog(){
 const products=[...Object.entries(PAID_SKINS).map(([key,v])=>({productId:productId(key),gameId:key,title:v.name,priceMinorBRL:v.brl,type:'non_consumable',category:'specimen'})),...avatar.products.filter(v=>v.currency==='brl').map(v=>({productId:productId(v.key),gameId:v.key,title:v.name,priceMinorBRL:v.price,type:'non_consumable',category:v.slot}))].sort((a,b)=>a.productId.localeCompare(b.productId));
 if(new Set(products.map(p=>p.productId)).size!==products.length||products.some(p=>!(/^[a-z][a-z0-9_.]*$/).test(p.productId)||!Number.isInteger(p.priceMinorBRL)||p.priceMinorBRL<=0))throw Error('Invalid Play catalog');
 return {packageName:'com.esaneto.abyssal',currency:'BRL',status:'planned_not_registered',products,excluded:[{gameId:'boss_bundle',reason:'Preço proporcional às skins possuídas no checkout web; não criar SKU fixo até definir oferta Play e regra de propriedade.'}],energyOnly:avatar.products.filter(v=>v.currency==='energy').map(v=>({gameId:v.key,title:v.name,priceEnergy:v.price}))};
}
if(require.main===module){const target=path.join(__dirname,'../docs/google-play/products.json'),data=JSON.stringify(buildCatalog(),null,2)+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==data)throw Error('Play catalog out of date');console.log('Play catalog verified');}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);console.log('Play catalog updated:',target);}}
module.exports={buildCatalog,productId};
