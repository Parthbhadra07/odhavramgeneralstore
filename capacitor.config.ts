const config = {
  appId: "com.odhavram.generalstore",
  appName: "Odhavram General Store",
  webDir: "out",
  server: {
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#16a34a",
      showSpinner: false,
    },
  },
};

export default config;
