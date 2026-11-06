'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repo=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');

test('browser favicon and PWA share the new purple-tentacle anchor identity',()=>{
  const source=read('public/abyssal-icon.svg');
  const favicon=read('public/favicon.svg');
  const html=read('public/index.html');
  const manifest=JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(source,favicon);
  assert.match(source,/<svg[^>]+viewBox="0 0 512 512"/);
  assert.match(source,/id="icon-background"/);
  assert.match(source,/id="abyssalIconTitle"/);
  assert.match(source,/id="tentacle"/);
  assert.match(source,/id="metal"/);
  assert.match(source,/circl[e]? cx="256" cy="113"/);
  assert.match(html,/rel="icon" href="\/favicon\.svg\?v=5"/);
  assert.match(html,/rel="apple-touch-icon" href="\/abyssal-icon\.svg\?v=5"/);
  assert.ok(manifest.icons.some(icon=>icon.type==='image/svg+xml'&&icon.purpose==='any'));
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
});

test('Android builds make native launcher, round, adaptive and background resources',()=>{
  const builder=read('scripts/build-app-icons.cjs');
  const workflow=read('.github/workflows/ci.yml');
  const iconStep=workflow.indexOf('node scripts/build-app-icons.cjs --android');
  const buildStep=workflow.indexOf('./gradlew assembleDebug');
  assert.ok(iconStep>0&&buildStep>iconStep);
  assert.match(workflow,/@capacitor\/cli@8 sharp@0\.34\.4/);
  assert.match(builder,/ic_launcher\.png/);
  assert.match(builder,/ic_launcher_round\.png/);
  assert.match(builder,/ic_launcher_foreground\.png/);
  assert.match(builder,/mipmap-anydpi-v26/);
  assert.match(builder,/abyssal_icon_background/);
  assert.match(builder,/AndroidManifest\.xml/);
  for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
    assert.match(builder,new RegExp(density+':\\d+'));
  }
});

test('Windows packaging embeds a valid multi-resolution icon for exe and installer',()=>{
  const desktop=JSON.parse(read('desktop/package.json'));
  const window=read('desktop/main.cjs');
  const workflow=read('.github/workflows/download-builds.yml');
  const iconScript=read('scripts/build-app-icons.cjs');
  assert.equal(desktop.build.win.icon,'build/icon.ico');
  assert.equal(desktop.build.nsis.installerIcon,'build/icon.ico');
  assert.equal(desktop.build.nsis.uninstallerIcon,'build/icon.ico');
  assert.ok(desktop.build.files.includes('build/icon.ico'));
  assert.match(window,/icon: path\.join\(__dirname, 'build', 'icon\.ico'\)/);
  assert.ok(workflow.indexOf('node scripts/build-app-icons.cjs --desktop')>0);
  assert.ok(workflow.indexOf('node scripts/build-app-icons.cjs --desktop')<workflow.indexOf('npm run dist'));
  assert.match(iconScript,/const sizes=\[16,24,32,48,64,128,256\]/);
  assert.match(iconScript,/head\.writeUInt16LE\(1,2\)/);
});
