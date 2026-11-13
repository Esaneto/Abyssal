'use strict';
const fs = require('node:fs');
const path = require('node:path');

const manifest = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const mode = process.argv.includes('--enable') ? 'enable' : process.argv.includes('--disable') ? 'disable' : '';
if (!mode) throw new Error('Use --enable or --disable');

let xml = fs.readFileSync(manifest, 'utf8');
const permission = '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n';

if (mode === 'enable') {
  if (!xml.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
    xml = xml.replace(/(<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"\s*\/>\s*)/, '$1\n' + permission);
  }
} else {
  xml = xml.replace(/\s*<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"\s*\/>\s*/g, '\n');
}

fs.writeFileSync(manifest, xml);
console.log('Android direct updater permission:', mode);
