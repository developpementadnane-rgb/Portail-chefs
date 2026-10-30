import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shm.qada",
  appName: "Portail SHM",
  webDir: "dist/spa",
  android: {
    allowMixedContent: false,
  },
};

export default config;
