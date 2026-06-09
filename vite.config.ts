import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function binanceAccessNoticePlugin(): Plugin {
  return {
    name: 'klineforge-binance-access-notice',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const logger = server.config.logger;

        logger.info('');
        logger.info('  KLineForge Binance data notice:');
        logger.info('  If Binance USD-M REST/WebSocket is limited by region or CORS, the app will try real data first, then proxy/Public Data/fallback sources.');
        logger.info('  如果 Binance U 本位 REST/WebSocket 遇到区域或 CORS 限制，应用会先尝试真实数据，再尝试代理/Public Data/兜底来源。');
        logger.info('  Optional proxy env vars: VITE_KLINEFORGE_PROXY_URL, VITE_KLINEFORGE_SPOT_PROXY_URL, VITE_KLINEFORGE_USDM_PROXY_URL');
        logger.info('  可选代理环境变量：VITE_KLINEFORGE_PROXY_URL、VITE_KLINEFORGE_SPOT_PROXY_URL、VITE_KLINEFORGE_USDM_PROXY_URL');
        logger.info('');
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), binanceAccessNoticePlugin()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/klinecharts/')) {
            return 'charting';
          }

          if (id.includes('/node_modules/dexie/') || id.includes('/node_modules/fflate/')) {
            return 'storage';
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-i18next/') ||
            id.includes('/node_modules/i18next/') ||
            id.includes('/node_modules/zustand/')
          ) {
            return 'react';
          }

          return undefined;
        },
      },
    },
  },
});
