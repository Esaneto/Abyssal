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
xml=xml.replace(/<application([^>]*)>/,(_,attrs)=>{let a=attrs;if(/android:usesCleartextTraffic=/.test(a))a=a.replace(/android:usesCleartextTraffic="[^"]*"/,'android:usesCleartextTraffic="false"');else a+=' android:usesCleartextTraffic="false"';if(/android:hardwareAccelerated=/.test(a))a=a.replace(/android:hardwareAccelerated="[^"]*"/,'android:hardwareAccelerated="true"');else a+=' android:hardwareAccelerated="true"';return '<application'+a+'>';});\nfs.writeFileSync(manifest,xml);
const java=path.join('android','app','src','main','java','com','esaneto','abyssal','MainActivity.java');
if(fs.existsSync(java)){
 let src=fs.readFileSync(java,'utf8');
 src=src.replace('import com.getcapacitor.BridgeActivity;','import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;\nimport android.view.View;');
 src=src.replace('public class MainActivity extends BridgeActivity {}',`public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    enterImmersiveMode();
  }
  @Override
  protected void onResume() {
    super.onResume();
    enterImmersiveMode();
  }
  private void enterImmersiveMode() {
    getWindow().getDecorView().setSystemUiVisibility(
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
      View.SYSTEM_UI_FLAG_FULLSCREEN |
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
      View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    );
  }
}`);
 fs.writeFileSync(java,src);
}
