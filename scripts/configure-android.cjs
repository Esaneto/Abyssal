const fs=require('fs');
const path=require('path');

const manifest=path.join('android','app','src','main','AndroidManifest.xml');
let xml=fs.readFileSync(manifest,'utf8');
if(!xml.includes('android.permission.ACCESS_NETWORK_STATE'))xml=xml.replace(/<uses-permission android:name="android.permission.INTERNET"\s*\/>/,'<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />');
xml=xml.replace(/<activity([^>]*android:name="\.MainActivity"[^>]*)>/,(_,attrs)=>{
 let a=attrs;
 if(/android:screenOrientation=/.test(a))a=a.replace(/android:screenOrientation="[^"]*"/,'android:screenOrientation="fullUser"');else a+=' android:screenOrientation="fullUser"';
 if(/android:windowSoftInputMode=/.test(a))a=a.replace(/android:windowSoftInputMode="[^"]*"/,'android:windowSoftInputMode="adjustResize"');else a+=' android:windowSoftInputMode="adjustResize"';
 return '<activity'+a+'>';
});
xml=xml.replace(/<application([^>]*)>/,(_,attrs)=>{
 let a=attrs;
 if(/android:usesCleartextTraffic=/.test(a))a=a.replace(/android:usesCleartextTraffic="[^"]*"/,'android:usesCleartextTraffic="false"');else a+=' android:usesCleartextTraffic="false"';
 if(/android:hardwareAccelerated=/.test(a))a=a.replace(/android:hardwareAccelerated="[^"]*"/,'android:hardwareAccelerated="true"');else a+=' android:hardwareAccelerated="true"';
 return '<application'+a+'>';
});
// Capacitor already declares this authority. Replace its declaration rather
// than adding a second provider for the same authority (both APK and AAB).
// The only native file shared by Abyssal is its signed update in cache/updates.
const providerBlock=`<provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/abyssal_update_paths" />
        </provider>`;
let updaterProviderCount=0;
xml=xml.replace(/<provider\b[^>]*>(?:[\s\S]*?)<\/provider>/g,block=>{
 const tag=block.slice(0,block.indexOf('>')+1);
 if(!tag.includes('android:name="androidx.core.content.FileProvider"')||!tag.includes('android:authorities="${applicationId}.fileprovider"'))return block;
 return ++updaterProviderCount===1?providerBlock:'';
});
if(!updaterProviderCount)xml=xml.replace('</application>','        '+providerBlock+'\n    </application>');
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
  public void canInstallApk(PluginCall call) {
    JSObject result = new JSObject();
    result.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls());
    call.resolve(result);
  }

  @PluginMethod
  public void installApk(PluginCall call) {
    // Google Play builds never enter the sideload flow, even if JavaScript calls this bridge.
    try {
      PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), PackageManager.GET_PERMISSIONS);
      boolean direct = false;
      if (info.requestedPermissions != null) for (String permission : info.requestedPermissions) {
        if ("android.permission.REQUEST_INSTALL_PACKAGES".equals(permission)) direct = true;
      }
      if (!direct) { call.reject("play-build-use-google-play-update"); return; }
    } catch (Exception error) { call.reject("update-channel-unavailable", error); return; }
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
          byte[] buffer = new byte[128 * 1024];
          long lastProgress = 0;
          int read;
          while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > MAX_UPDATE_BYTES) throw new Exception("update-too-large");
            digest.update(buffer, 0, read);
            output.write(buffer, 0, read);
            long now = android.os.SystemClock.elapsedRealtime();
            if (now - lastProgress >= 300) {
              lastProgress = now;
              JSObject progress = new JSObject();
              progress.put("received", total);
              progress.put("total", declared);
              progress.put("phase", "download");
              notifyListeners("updateProgress", progress);
            }
          }
          output.getFD().sync();
        } finally {
          connection.disconnect();
        }

        if (total <= 0) throw new Exception("empty-update");
        JSObject verifying = new JSObject();
        verifying.put("received", total);
        verifying.put("total", declared);
        verifying.put("phase", "verify");
        notifyListeners("updateProgress", verifying);
        String actualSha = hex(digest.digest());
        if (!actualSha.equals(expectedSha)) throw new Exception("update-sha256-mismatch");
        if (apk.exists() && !apk.delete()) throw new Exception("cannot-replace-update");
        if (!partial.renameTo(apk)) throw new Exception("cannot-finalize-update");
        validatePackage(apk, version);

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

  private void validatePackage(File apk, String expectedVersion) throws Exception {
    PackageManager pm = getContext().getPackageManager();
    int flags = PackageManager.GET_SIGNATURES;
    PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
    PackageInfo incoming = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
    if (incoming == null || !getContext().getPackageName().equals(incoming.packageName)) throw new Exception("update-package-mismatch");
    if (!expectedVersion.isEmpty() && !expectedVersion.equals(incoming.versionName)) throw new Exception("update-version-mismatch");
    long oldCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
    long newCode = Build.VERSION.SDK_INT >= 28 ? incoming.getLongVersionCode() : incoming.versionCode;
    if (newCode <= oldCode) throw new Exception("update-version-code-not-newer");
    if (installed.signatures == null || incoming.signatures == null || !new java.util.HashSet<>(java.util.Arrays.asList(installed.signatures)).equals(new java.util.HashSet<>(java.util.Arrays.asList(incoming.signatures)))) throw new Exception("update-signing-key-mismatch");
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

fs.writeFileSync(path.join(javaDir,'AbyssalFullscreenPlugin.java'),`package com.esaneto.abyssal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AbyssalFullscreen")
public class AbyssalFullscreenPlugin extends Plugin {
  @PluginMethod public void getState(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      JSObject result = new JSObject();
      result.put("active", ((MainActivity)getActivity()).isImmersive());
      call.resolve(result);
    });
  }
  @PluginMethod public void setEnabled(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      MainActivity activity = (MainActivity)getActivity();
      activity.setImmersive(Boolean.TRUE.equals(call.getBoolean("enabled", true)));
      JSObject result = new JSObject();
      result.put("active", activity.isImmersive());
      call.resolve(result);
    });
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
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private boolean immersive = true;
  private boolean keyboardVisible = false;
  public boolean isImmersive() { return immersive; }
  public void setImmersive(boolean enabled) {
    immersive = enabled;
    getPreferences(MODE_PRIVATE).edit().putBoolean("abyssalImmersive", enabled).apply();
    applySystemBars();
    ViewCompat.requestApplyInsets(findViewById(android.R.id.content));
  }
  private void applySystemBars() {
    View content = findViewById(android.R.id.content);
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), content);
    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    if (immersive && !keyboardVisible) controller.hide(WindowInsetsCompat.Type.systemBars());
    else controller.show(WindowInsetsCompat.Type.systemBars());
    controller.setAppearanceLightStatusBars(false);
    controller.setAppearanceLightNavigationBars(false);
  }
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
    registerPlugin(AbyssalUpdaterPlugin.class);
    registerPlugin(AbyssalFullscreenPlugin.class);
    super.onCreate(savedInstanceState);
    immersive = getPreferences(MODE_PRIVATE).getBoolean("abyssalImmersive", true);
    Window window = getWindow();
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    WindowCompat.setDecorFitsSystemWindows(window, false);
    View content = findViewById(android.R.id.content);
    content.setBackgroundColor(Color.rgb(6, 21, 34));
    ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
      boolean nextKeyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
      if (keyboardVisible != nextKeyboardVisible) {
        keyboardVisible = nextKeyboardVisible;
        view.post(() -> applySystemBars());
      }
      Insets safe = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
      if (!immersive || keyboardVisible) {
        Insets normal = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.systemGestures());
        safe = Insets.max(safe, normal);
      }
      Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
      view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, ime.bottom));
      return WindowInsetsCompat.CONSUMED;
    });
    applySystemBars();
    ViewCompat.requestApplyInsets(content);
  }
  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      View content = findViewById(android.R.id.content);
      applySystemBars();
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
