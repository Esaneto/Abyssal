const { CapacitorConfig } = require('@capacitor/cli');

const config = {
  appId: 'com.abyssal.ecos',
  appName: 'Abyssal',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    backgroundColor: '#061522',
    allowMixedContent: false
  }
};

module.exports = config;
