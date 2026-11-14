# Stable Android download: first-time signing setup

The public APK must keep the same package (com.esaneto.abyssal) and signing certificate forever. Do not publish a debug APK at the stable address, and never commit a keystore.

Historical debug builds may require a one-time migration. Sync the player's account before removing a legacy app; unsynced local data may be lost.

From PowerShell with authenticated GitHub CLI and JDK keytool:

- Run scripts/setup-android-signing.ps1 without arguments to inspect existing secrets and trigger the build if complete.
- If all four secrets are missing and the original permanent key exists, use -KeystorePath with its file path and -KeyAlias.
- If the old APK was a non-updateable debug build, use -CreateNewKey only after confirming the migration. The helper refuses to generate a new key when previous metadata indicates an updateable/release-signed APK.
- Partial secrets are not changed automatically. Recover the original key and fill missing secrets with the same signing data.

The helper prompts for passwords locally, uploads the four encrypted repository secrets, and requests ci.yml. Keep an independent secure backup of the keystore and its passwords. A production APK cannot be published until signing is configured. The Play AAB uses the upload key; Google Play app signing may use a different distribution key, so Play and direct installs have separate update channels.

Check the android-api36 job, Audit final signed APK contains the current game and native bridge, and Promote signed APK to stable download release. Compare the published version at https://github.com/Esaneto/Abyssal/releases/download/downloads-2/Abyssal-Android-build.json with package.json. The APK itself must contain the current avatar assets and update bridge.
