import solidPlugin from 'vite-plugin-solid';
import { defineConfig, type Plugin } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';

function binanceAccessNoticePlugin(): Plugin {
  return {
    name: 'klineforge-binance-access-notice',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const logger = server.config.logger;

        logger.info('');
        logger.info('  KLineForge Tauri data notice:');
        logger.info('  Market data, caching and indicators are owned by the Rust/Tauri backend.');
        logger.info('  行情、缓存和指标计算由 Rust/Tauri 后端负责，前端只处理 UI 和图表交互。');
        logger.info('');
      });
    },
  };
}

function performanceArtifactsPlugin(): Plugin {
  const artifactRoot = normalize(join(process.cwd(), 'artifacts/performance'));

  const serveArtifact = (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url?.split('?')[0] ?? '';

    if (!url.startsWith('/performance/')) {
      return false;
    }

    const fileName = decodeURIComponent(url.replace('/performance/', ''));
    const filePath = normalize(join(artifactRoot, fileName));

    if (!filePath.startsWith(artifactRoot) || !existsSync(filePath)) {
      return false;
    }

    res.setHeader('Content-Type', contentType(filePath));
    createReadStream(filePath).pipe(res);
    return true;
  };

  return {
    name: 'klineforge-performance-artifacts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serveArtifact(req, res)) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serveArtifact(req, res)) {
          next();
        }
      });
    },
  };
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.json':
      return 'application/json;charset=utf-8';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [solidPlugin(), binanceAccessNoticePlugin(), performanceArtifactsPlugin()],
  server: {
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/lightweight-charts/')) {
            return 'charting';
          }

          if (id.includes('/node_modules/solid-js/')) {
            return 'solid';
          }

          if (id.includes('/node_modules/@tauri-apps/')) {
            return 'tauri';
          }

          return undefined;
        },
      },
    },
  },
});
