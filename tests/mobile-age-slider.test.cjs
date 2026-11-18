'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');

test('standalone age slider is removed; birthday appears only on registration',()=>{
 const html=read('public/index.html');
 assert.doesNotMatch(html,/id="ageTermsScreen"|id="ageYearsRange"|age-slider\.js/);
 assert.match(html,/id="birthDateInput"[^>]*type="date"/);
 assert.match(html,/id="loginGuestBtn"/);
 assert.match(html,/id="registerBtn"/);
 assert.match(html,/id="loginGoogleBtn"/);
 assert.match(html,/abyssal-login-v2\.css/);
});
test('server validates birthday and requires 16+ registration, with terms accepted',()=>{
 const server=read('server.js');
 assert.match(server,/birthBand\(String\(payload.birthDate\|\|''\)\)/);
 assert.match(server,/birth\.age<16/);
 assert.match(server,/payload\.termsAccepted!==true/);
 assert.match(server,/ageBand:birth\.band/);
 assert.match(server,/key==='nekko'/);
 assert.doesNotMatch(server,/birthDate:birthDate|dateOfBirth:birth/);
});
test('client keeps unknown age/guest restricted and only login accounts play online',()=>{
 const online=read('public/online.js');
 assert.match(online,/AbyssalRestrictedAgeTreatment=band==='under16'\|\|band==='unknown'/);
 assert.match(online,/id='bad'|entryGuestChosen=true/);
 assert.match(online,/applyAgeTreatment\(result.ageBand\)/);
 assert.doesNotMatch(online,/hasAgeTermsProfile|openAgeTermsIfNeeded|function ageProfile\(/);
 assert.doesNotMatch(online,/ageTermsContinue|AbyssalAgeSlider/);
});
