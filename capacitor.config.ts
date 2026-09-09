import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for Sharqia MES.
 *
 * IMPORTANT:
 *  - `webDir` points to the built web bundle (produced by `npm run prepare:web`).
 *  - No server URL is hardcoded here. The app runs fully on-device from the
 *    bundled web assets. The Odoo endpoint is provided at RUNTIME via the
 *    config layer (src/config/env.js -> window.__SHARQIA_ENV__), never here.
 *  - Do NOT add a `server.url` pointing at any remote/demo server.
 */
const config: CapacitorConfig = {
  appId: 'com.sharqia.mes',
  appName: 'بيت العباءة الشرقية MES',
  webDir: 'www',
  // bundledWebRuntime is deprecated in Capacitor 6; assets are bundled by default.
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#17170F',
      showSpinner: false
    },
    // CapacitorHttp lets fetch() go through native (avoids CORS with Odoo).
    // Enable when wiring the real Odoo endpoint (see ODOO_INTEGRATION.md).
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
