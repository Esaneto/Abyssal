const fs = require('fs');
const path = require('path');

const gradlePath = path.join('android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) throw new Error('android/app/build.gradle not found');

let gradle = fs.readFileSync(gradlePath, 'utf8');
if (gradle.includes('ABYSSAL_PLAY_SIGNING_V1')) process.exit(0);

const signing = `
    // ABYSSAL_PLAY_SIGNING_V1
    signingConfigs {
        release {
            def storePath = System.getenv("ABYSSAL_KEYSTORE_PATH")
            if (storePath) storeFile file(storePath)
            storePassword System.getenv("ABYSSAL_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ABYSSAL_KEY_ALIAS")
            keyPassword System.getenv("ABYSSAL_KEY_PASSWORD")
        }
    }
`;

gradle = gradle.replace(/android\s*\{/, match => match + signing);
gradle = gradle.replace(/buildTypes\s*\{\s*release\s*\{/, match => match + '\n            signingConfig signingConfigs.release');

fs.writeFileSync(gradlePath, gradle);
console.log('Android release signing configured for CI environment secrets.');
