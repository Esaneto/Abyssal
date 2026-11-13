'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('redeem and purchase are cockpit pages and return through the visor',()=>{const r=read('public/abyssal-exploration-runtime.js'),g=read('public/game.js'),css=read('public/style.css');assert.match(r,/redeem:'redeemCodeScreen',purchase:'skinPurchaseConfirmModal'/);assert.match(r,/embeddedReturns\.set\(page,activeConsoleSection\)/);assert.match(g,/routeScreen\?\.\('redeemCodeScreen',true\)/);assert.match(g,/isEmbedded\?\.\('redeemCodeScreen'\)/);assert.match(g,/routeScreen\?\.\('skinPurchaseConfirmModal',true\)/);assert.match(css,/\.abyss-visor-body > \.abyss-cockpit-embedded:not\(\[hidden\]\)/);});
