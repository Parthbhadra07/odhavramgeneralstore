import type { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.CAPACITOR_DEV === "1";

const config: CapacitorConfig = {
  appId: "com.odhavram.generalstore",
  appName: "Odhavram General Store",
  webDir: "out",
  /** Bundle local static export — do not load remote Vercel URL in production */
  server: isDev
    ? {
        url: process.env.CAPACITOR_SERVER_URL ?? "http://localhost:3000",
        cleartext: true,
      }
    : {
        androidScheme: "https",
        iosScheme: "https",
      },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#16a34a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#16a34a",
    },
  },
};

export default config;
