const fs=require('fs');
const path=require('path');
const manifest=path.join('android','app','src','main','AndroidManifest.xml');
let xml=fs.readFileSync(manifest,'utf8');
xml=xml.replace(/<uses-permission android:name="android.permission.INTERNET"\s*\/>/,'<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />');
xml=xml.replace(/<activity([^>]*android:name="\.MainActivity"[^>]*)>/,(_,attrs)=>{
 let a=attrs;
 if(/android:screenOrientation=/.test(a))a=a.replace(/android:screenOrientation="[^"]*"/,'android:screenOrientation="landscape"');else a+=' android:screenOrientation="landscape"';
 return '<activity'+a+'>';
});
xml=xml.replace(/<application([^>]*)>/,(_,attrs)=>{let a=attrs;if(/android:usesCleartextTraffic=/.test(a))a=a.replace(/android:usesCleartextTraffic="[^"]*"/,'android:usesCleartextTraffic="false"');else a+=' android:usesCleartextTraffic="false"';if(/android:hardwareAccelerated=/.test(a))a=a.replace(/android:hardwareAccelerated="[^"]*"/,'android:hardwareAccelerated="true"');else a+=' android:hardwareAccelerated="true"';return '<application'+a+'>';});
fs.writeFileSync(manifest,xml);
const java=path.join('android','app','src','main','java','com','esaneto','abyssal','MainActivity.java');
if(fs.existsSync(java)){
 // Keep system navigation visible and reserve its real touch area, including
 // landscape back gestures, navigation bar and display cutouts on API 24–36.
 // API 35+ enforces edge-to-edge; explicit insets keep the entire WebView safe.
 const src=`package com.esaneto.abyssal;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    View content = findViewById(android.R.id.content);
    content.setBackgroundColor(Color.rgb(6, 21, 34));
    ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
      Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars()
          | WindowInsetsCompat.Type.displayCutout()
          | WindowInsetsCompat.Type.systemGestures());
      Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
      view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, ime.bottom));
      return WindowInsetsCompat.CONSUMED;
    });
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, content);
    controller.show(WindowInsetsCompat.Type.systemBars());
    controller.setAppearanceLightStatusBars(false);
    controller.setAppearanceLightNavigationBars(false);
    ViewCompat.requestApplyInsets(content);
  }
  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      View content = findViewById(android.R.id.content);
      WindowCompat.getInsetsController(getWindow(), content).show(WindowInsetsCompat.Type.systemBars());
      ViewCompat.requestApplyInsets(content);
    }
  }
}
`;
 fs.writeFileSync(java,src);
}

const gradle=path.join('android','app','build.gradle');
if(fs.existsSync(gradle)){
 let build=fs.readFileSync(gradle,'utf8');
 const packageVersion=String(process.env.ABYSSAL_VERSION_NAME||require('../package.json').version||'1.0.0').replace(/[^0-9A-Za-z._-]/g,'');
 const runNumber=Math.max(1,Number.parseInt(process.env.ABYSSAL_VERSION_CODE||process.env.GITHUB_RUN_NUMBER||'1',10)||1);
 build=build.replace(/versionCode\s+\d+/, 'versionCode '+runNumber);
 build=build.replace(/versionName\s+["'][^"']+["']/, 'versionName "'+packageVersion+'"');
 fs.writeFileSync(gradle,build);
 console.log('Android version configured:',packageVersion,'('+runNumber+')');
}
