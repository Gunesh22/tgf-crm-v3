import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

function vercelApiPlugin() {
  return {
    name: 'vercel-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        // Dynamically load env vars per request in dev mode so process.env is always up to date
        dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
        dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

        // Helper to parse body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.body) {
          await new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                req.body = JSON.parse(body || '{}');
              } catch (e) {
                req.body = {};
              }
              resolve();
            });
          });
        }

        // Helper to parse URL query params
        if (!req.query) {
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          req.query = Object.fromEntries(urlObj.searchParams.entries());
        }

        // Polyfill Vercel Response helpers (res.status, res.json, res.send)
        if (!res.status) {
          res.status = function (statusCode) {
            res.statusCode = statusCode;
            return res;
          };
        }
        if (!res.json) {
          res.json = function (data) {
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            }
            return res;
          };
        }
        if (!res.send) {
          res.send = function (data) {
            if (!res.headersSent) {
              if (typeof data === 'object') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } else {
                res.end(data);
              }
            }
            return res;
          };
        }

        try {
          if (req.url.startsWith('/api/ghl')) {
            const mod = await server.ssrLoadModule('./api/ghl.js');
            return await mod.default(req, res);
          }
          if (req.url.startsWith('/api/contacts/')) {
            const mod = await server.ssrLoadModule('./api/contacts/[...slug].js');
            const urlPath = req.url.split('?')[0].replace('/api/contacts/', '');
            req.query.slug = [urlPath];
            return await mod.default(req, res);
          }
          if (req.url.startsWith('/api/admin/')) {
            const mod = await server.ssrLoadModule('./api/admin/[...slug].js');
            const urlPath = req.url.split('?')[0].replace('/api/admin/', '');
            req.query.slug = [urlPath];
            return await mod.default(req, res);
          }
          if (req.url.startsWith('/api/registrations')) {
            if (req.url.startsWith('/api/registrations/export')) {
              const mod = await server.ssrLoadModule('./api/registrations/export.js');
              return await mod.default(req, res);
            }
            const mod = await server.ssrLoadModule('./api/registrations/index.js');
            return await mod.default(req, res);
          }
        } catch (err) {
          console.error('[VITE API MIDDLEWARE ERROR]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vercelApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-excel': ['xlsx'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})

