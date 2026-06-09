import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('klineforgeDesktop', {
  appVersion: process.env.npm_package_version ?? '0.0.0',
  platform: process.platform,
});
