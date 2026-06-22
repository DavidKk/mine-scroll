import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const designAssetsRoot = path.resolve(rootDir, 'docs/design-assets');

function designAssetsPlugin(): Plugin {
  return {
    name: 'design-assets-dev',
    configureServer(server) {
      server.middlewares.use('/design-assets', (req, res, next) => {
        const reqPath = decodeURIComponent((req.url ?? '/').split('?')[0]!);
        const filePath = path.normalize(path.join(designAssetsRoot, reqPath));
        if (!filePath.startsWith(designAssetsRoot)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          '.png': 'image/png',
          '.json': 'application/json',
          '.txt': 'text/plain',
        };
        res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [designAssetsPlugin()],
});
