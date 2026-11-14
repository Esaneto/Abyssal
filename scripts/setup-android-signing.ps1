[CmdletBinding()]
param(
  [string]$KeystorePath = "",
  [string]$KeyAlias = "abyssal",
  [switch]$CreateNewKey
)
$ErrorActionPreference = 'Stop'
$repo = 'Esaneto/Abyssal'
$required = @('ANDROID_KEYSTORE_BASE64','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD')
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install GitHub CLI and run gh auth login first.' }
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Authenticate GitHub CLI as the repository owner first.' }
$names = @(gh secret list --repo $repo --json name --jq '.[].name')
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect repository Actions secrets. Repository administration permission is required.' }
$existing = @($required | Where-Object { $names -contains $_ })
if ($existing.Count -gt 0 -and $existing.Count -lt $required.Count) {
  throw ('Partial signing setup: ' + ($existing -join ', ') + '. Do not rotate or replace any key. Complete the missing secrets using the original keystore.')
}
function Start-AbyssalBuild {
  $vars = @(gh variable list --repo $repo --json name,value)
  if ($LASTEXITCODE -ne 0) { throw 'Cannot verify Actions variables.' }
  $values = ($vars -join "") | ConvertFrom-Json
  $test = @($values | Where-Object { $_.name -eq 'ABYSSAL_ADMOB_TEST_MODE' })
  if ($test.Count -and $test[0].value -eq 'true') {
    gh variable set ABYSSAL_ADMOB_TEST_MODE --repo $repo --body false
    if ($LASTEXITCODE -ne 0) { throw 'Could not disable test-only build promotion.' }
  }
  gh workflow run ci.yml --repo $repo --ref main
  if ($LASTEXITCODE -ne 0) { throw 'Could not start Android workflow. Open Actions and run Abyssal checks v2 manually.' }
  Write-Host 'Build requested. Inspect the android-api36 job and stable publication:'
  Write-Host 'https://github.com/Esaneto/Abyssal/actions/workflows/ci.yml'
}
if ($existing.Count -eq $required.Count) {
  Write-Host 'All four permanent signing secrets already exist. No key will be replaced.'
  Start-AbyssalBuild
  exit 0
}
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) { throw 'Java JDK keytool is required. Install a JDK or add its bin directory to PATH.' }
if (-not $KeystorePath -and -not $CreateNewKey) {
  throw 'No signing secrets are configured. Supply -KeystorePath with the original key, or -CreateNewKey for a confirmed legacy debug APK migration.'
}
if ($CreateNewKey -and $KeystorePath) { throw 'Choose an existing keystore or -CreateNewKey, not both.' }
if ($CreateNewKey) {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('abyssal-signing-' + [Guid]::NewGuid())
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    gh release download downloads-2 --repo $repo --pattern Abyssal-Android-build.json --dir $tmp
    if ($LASTEXITCODE -ne 0) { throw 'Unable to verify previous APK signing metadata. Do not generate a replacement key until previous signing is checked.' }
    $previous = Get-Content (Join-Path $tmp 'Abyssal-Android-build.json') -Raw | ConvertFrom-Json
    if ($previous.signing -eq 'release' -or $previous.updatable -eq $true) {
      throw 'A previously updateable or release-signed APK exists. Reuse its original signing keystore; generating a new one would break updates.'
    }
    Write-Host ('Previously published APK: ' + $previous.version + ', signing: ' + $previous.signing)
    if ((Read-Host 'Confirm one-time migration from the old debug APK by typing MIGRAR') -ne 'MIGRAR') { throw 'Cancelled. No key created.' }
  } finally { Remove-Item $tmp -Recurse -Force }
  $folder = Join-Path $env:USERPROFILE 'Abyssal-signing'
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $KeystorePath = Join-Path $folder 'abyssal-release.jks'
  if (Test-Path $KeystorePath) { throw 'Permanent key already exists locally. Reuse it via -KeystorePath.' }
} else {
  $KeystorePath = (Resolve-Path $KeystorePath).Path
}
function Read-SecretText([string]$prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Set-RepoSecret([string]$name,[string]$value) {
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = (Get-Command gh).Source
  $start.Arguments = "secret set $name --repo $repo"
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
  $process = [System.Diagnostics.Process]::Start($start)
  try {
    $process.StandardInput.Write($value)
    $process.StandardInput.Close()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Could not set $name. Do not create another key; use the existing keystore." }
  } finally { $process.Dispose() }
}
$storePass = Read-SecretText 'Keystore password (save it in your password manager)'
if ($storePass.Length -lt 6) { throw 'Use a password of at least 6 characters.' }
if ($CreateNewKey) {
  $confirmation = Read-SecretText 'Confirm keystore password'
  if ($confirmation -cne $storePass) { throw 'Passwords do not match.' }
  $keyPass = $storePass
} else {
  $keyPass = Read-SecretText 'Existing key password (enter the same password if applicable)'
}
$env:ABYSSAL_SETUP_STORE_PASS = $storePass
$env:ABYSSAL_SETUP_KEY_PASS = $keyPass
try {
  if ($CreateNewKey) {
    keytool -genkeypair -keystore $KeystorePath -storetype JKS -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Abyssal, O=Esaneto' -storepass:env ABYSSAL_SETUP_STORE_PASS -keypass:env ABYSSAL_SETUP_KEY_PASS
    if ($LASTEXITCODE -ne 0) { throw 'Key generation failed.' }
  }
  keytool -list -keystore $KeystorePath -alias $KeyAlias -storepass:env ABYSSAL_SETUP_STORE_PASS
  if ($LASTEXITCODE -ne 0) { throw 'Keystore or alias validation failed.' }
  Write-Host "Permanent key: $KeystorePath"
  Write-Host 'Back up this keystore and its passwords in a secure location. Do not upload the file to GitHub or send it in chat.'
  Set-RepoSecret 'ANDROID_KEYSTORE_BASE64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($KeystorePath)))
  Set-RepoSecret 'ANDROID_KEYSTORE_PASSWORD' $storePass
  Set-RepoSecret 'ANDROID_KEY_ALIAS' $KeyAlias
  Set-RepoSecret 'ANDROID_KEY_PASSWORD' $keyPass
  Start-AbyssalBuild
} finally {
  Remove-Item Env:ABYSSAL_SETUP_STORE_PASS -ErrorAction SilentlyContinue
  Remove-Item Env:ABYSSAL_SETUP_KEY_PASS -ErrorAction SilentlyContinue
  $storePass = $null
  $keyPass = $null
  $confirmation = $null
}
