const fs=require('fs');
const path=require('path');

const manifest=path.join('android','app','src','main','AndroidManifest.xml');
let xml=fs.readFileSync(manifest,'utf8');
xml=xml.replace(/<uses-permission android:name="android.permission.INTERNET"\s*\/>/,'<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />');
xml=xml.replace(/<activity([^>]*android:name="\.MainActivity"[^>]*)>/,(_,attrs)=>{
 let a=attrs;
 if(/android:screenOrientation=/.test(a))a=a.replace(/android:screenOrientation="[^"]*"/,'android:screenOrientation="portrait"');else a+=' android:screenOrientation="portrait"';
 return '<activity'+a+'>';
});
xml=xml.replace(/<application([^>]*)>/,(_,attrs)=>{
 let a=attrs;
 if(/android:usesCleartextTraffic=/.test(a))a=a.replace(/android:usesCleartextTraffic="[^"]*"/,'android:usesCleartextTraffic="false"');else a+=' android:usesCleartextTraffic="false"';
 if(/android:hardwareAccelerated=/.test(a))a=a.replace(/android:hardwareAccelerated="[^"]*"/,'android:hardwareAccelerated="true"');else a+=' android:hardwareAccelerated="true"';
 return '<application'+a+'>';
});
if(!xml.includes('abyssal_update_paths')){
 xml=xml.replace('</application>',`        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/abyssal_update_paths" />
        </provider>
    </application>`);
}
fs.writeFileSync(manifest,xml);

const xmlDir=path.join('android','app','src','main','res','xml');
fs.mkdirSync(xmlDir,{recursive:true});
fs.writeFileSync(path.join(xmlDir,'abyssal_update_paths.xml'),`<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="abyssal_updates" path="updates/" />
</paths>
`);

const javaDir=path.join('android','app','src','main','java','com','esaneto','abyssal');
fs.mkdirSync(javaDir,{recursive:true});
const updaterJava=path.join(javaDir,'AbyssalUpdaterPlugin.java');
fs.writeFileSync(updaterJava,`package com.esaneto.abyssal;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AbyssalUpdater")
public class AbyssalUpdaterPlugin extends Plugin {
  private static final long MAX_UPDATE_BYTES = 750L * 1024L * 1024L;

  @PluginMethod
  public void getUpdateChannel(PluginCall call) {
    String channel = "play";
    try {
      PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), PackageManager.GET_PERMISSIONS);
      if (info.requestedPermissions != null) for (String permission : info.requestedPermissions) {
        if ("android.permission.REQUEST_INSTALL_PACKAGES".equals(permission)) channel = "direct";
      }
    } catch (Exception ignored) {}
    JSObject result = new JSObject();
    result.put("channel", channel);
    call.resolve(result);
  }

  @PluginMethod
  public void checkPlayUpdate(PluginCall call) {
    AppUpdateManager manager = AppUpdateManagerFactory.create(getContext());
    manager.getAppUpdateInfo().addOnSuccessListener(info -> {
      boolean available = (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
          info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
          && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
      JSObject result = new JSObject();
      result.put("available", available);
      result.put("versionCode", info.availableVersionCode());
      call.resolve(result);
    }).addOnFailureListener(error -> call.reject("play-update-check-failed", error));
  }

  @PluginMethod
  public void startPlayUpdate(PluginCall call) {
    AppUpdateManager manager = AppUpdateManagerFactory.create(getContext());
    manager.getAppUpdateInfo().addOnSuccessListener(info -> {
      if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
        call.reject("play-update-unavailable");
        return;
      }
      getActivity().runOnUiThread(() -> {
        manager.startUpdateFlow(info, getActivity(), AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
          .addOnSuccessListener(code -> {
            JSObject result = new JSObject();
            result.put("ok", code == Activity.RESULT_OK);
            call.resolve(result);
          }).addOnFailureListener(error -> call.reject("play-update-failed", error));
      });
    }).addOnFailureListener(error -> call.reject("play-update-check-failed", error));
  }

  @PluginMethod
  public void installApk(PluginCall call) {
    String rawUrl = call.getString("url", "");
    String expectedSha = call.getString("sha256", "").toLowerCase(Locale.ROOT).trim();
    String version = call.getString("version", "latest").replaceAll("[^0-9A-Za-z._-]", "");
    if (!expectedSha.matches("[a-f0-9]{64}")) {
      call.reject("missing-update-sha256");
      return;
    }

    try {
      URL first = new URL(rawUrl);
      if (!isAllowed(first, true)) {
        call.reject("update-url-not-allowed");
        return;
      }
    } catch (Exception error) {
      call.reject("invalid-update-url");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + getContext().getPackageName()));
      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getActivity().runOnUiThread(() -> getContext().startActivity(settings));
      JSObject result = new JSObject();
      result.put("ok", false);
      result.put("permissionRequired", true);
      call.resolve(result);
      return;
    }

    new Thread(() -> {
      File partial = null;
      try {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("cannot-create-update-dir");
        File apk = new File(dir, "Abyssal-" + (version.isEmpty() ? "latest" : version) + ".apk");
        partial = new File(dir, apk.getName() + ".part");

        HttpURLConnection connection = openFollowingRedirects(rawUrl);
        long declared = connection.getContentLengthLong();
        if (declared > MAX_UPDATE_BYTES) throw new Exception("update-too-large");

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long total = 0;
        try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
             FileOutputStream output = new FileOutputStream(partial)) {
          byte[] buffer = new byte[64 * 1024];
          int read;
          while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > MAX_UPDATE_BYTES) throw new Exception("update-too-large");
            digest.update(buffer, 0, read);
            output.write(buffer, 0, read);
          }
          output.getFD().sync();
        } finally {
          connection.disconnect();
        }

        if (total <= 0) throw new Exception("empty-update");
        String actualSha = hex(digest.digest());
        if (!actualSha.equals(expectedSha)) throw new Exception("update-sha256-mismatch");
        if (apk.exists() && !apk.delete()) throw new Exception("cannot-replace-update");
        if (!partial.renameTo(apk)) throw new Exception("cannot-finalize-update");

        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

        getActivity().runOnUiThread(() -> {
          try {
            getContext().startActivity(install);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("launched", true);
            call.resolve(result);
          } catch (Exception error) {
            call.reject("installer-launch-failed", error);
          }
        });
      } catch (Exception error) {
        if (partial != null && partial.exists()) partial.delete();
        call.reject(error.getMessage() == null ? "update-failed" : error.getMessage(), error);
      }
    }, "abyssal-apk-updater").start();
  }

  private HttpURLConnection openFollowingRedirects(String rawUrl) throws Exception {
    URL current = new URL(rawUrl);
    for (int redirect = 0; redirect < 6; redirect++) {
      if (!isAllowed(current, redirect == 0)) throw new Exception("update-url-not-allowed");
      HttpURLConnection connection = (HttpURLConnection) current.openConnection();
      connection.setConnectTimeout(10000);
      connection.setReadTimeout(30000);
      connection.setInstanceFollowRedirects(false);
      connection.setRequestProperty("User-Agent", "Abyssal-Android-Updater");
      int status = connection.getResponseCode();
      if (status >= 300 && status < 400) {
        String location = connection.getHeaderField("Location");
        connection.disconnect();
        if (location == null || location.isEmpty()) throw new Exception("invalid-update-redirect");
        current = new URL(current, location);
        continue;
      }
      if (status < 200 || status >= 300) {
        connection.disconnect();
        throw new Exception("update-download-http-" + status);
      }
      return connection;
    }
    throw new Exception("too-many-update-redirects");
  }

  private boolean isAllowed(URL url, boolean first) {
    if (!"https".equalsIgnoreCase(url.getProtocol())) return false;
    String host = url.getHost().toLowerCase(Locale.ROOT);
    if (first) {
      return "github.com".equals(host)
          && url.getPath().startsWith("/Esaneto/Abyssal/releases/download/")
          && url.getPath().endsWith("/Abyssal-Android.apk");
    }
    return "github.com".equals(host) || host.endsWith(".githubusercontent.com");
  }

  private String hex(byte[] bytes) {
    StringBuilder out = new StringBuilder(bytes.length * 2);
    for (byte value : bytes) out.append(String.format(Locale.ROOT, "%02x", value));
    return out.toString();
  }
}
`);

const java=path.join(javaDir,'MainActivity.java');
if(fs.existsSync(java)){
 const src=`package com.esaneto.abyssal;

import android.os.Bundle;
import android.graphics.Color;
import android.content.pm.ActivityInfo;
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
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    registerPlugin(AbyssalUpdaterPlugin.class);
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
 if(!build.includes('com.google.android.play:app-update:'))build += "\n dependencies { implementation 'com.google.android.play:app-update:2.1.0' }\n";
 const packageVersion=String(process.env.ABYSSAL_VERSION_NAME||require('../package.json').version||'1.0.0').replace(/[^0-9A-Za-z._-]/g,'');
 const runNumber=Math.max(1,Number.parseInt(process.env.ABYSSAL_VERSION_CODE||process.env.GITHUB_RUN_NUMBER||'1',10)||1);
 build=build.replace(/versionCode\s+\d+/, 'versionCode '+runNumber);
 build=build.replace(/versionName\s+["'][^"']+["']/, 'versionName "'+packageVersion+'"');
 fs.writeFileSync(gradle,build);
 console.log('Android version configured:',packageVersion,'('+runNumber+')');
}
