'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('age gate no longer opens numeric keyboard fields',()=>{
 const index=read('public/index.html');
 assert.doesNotMatch(index,/id="ageBirthDay"/);
 assert.doesNotMatch(index,/id="ageBirthMonth"/);
 assert.doesNotMatch(index,/id="ageBirthYear"/);
 assert.match(index,/id="ageYearsRange"[^>]*type="range"/);
});

test('age slider requires explicit user interaction before continuing',()=>{
 const online=read('public/online.js');
 const slider=read('public/age-slider.js');
 assert.match(online,/AbyssalAgeSlider\?\.selected/);
 assert.match(online,/Arraste o seletor e informe sua idade antes de continuar/);
 assert.match(slider,/dataset\.userSelected='true'/);
});

test('age slider stores only age band, not exact age',()=>{
 const online=read('public/online.js');
 assert.match(online,/const band=age<16\?'under16':age<18\?'teen':'adult'/);
 assert.match(online,/JSON\.stringify\(\{band,termsVersion:AGE_TERMS_VERSION,acceptedAt:/);
 assert.doesNotMatch(online,/JSON\.stringify\(\{[^}]*age[,}]/);
});
