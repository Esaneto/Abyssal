'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {readPrevious,sha,publishStable}=require('./native-stable-release.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-win-publish-'));
try{const file=path.resolve('desktop/dist/Abyssal-Setup.exe'),name=path.basename(file),version=require('../package.json').version;const previous=readPrevious('Abyssal-Windows-build.json',dir);publishStable({file,name,metadata:{version,commit:process.env.GITHUB_SHA,sha256:sha(file),platform:'windows',updatable:true},previous,dir});}finally{fs.rmSync(dir,{recursive:true,force:true});}
