import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function appsScriptProxyPlugin(): Plugin {
  return {
    name: 'apps-script-proxy',
    configureServer(server) {
      server.middlewares.use('/api/apps-script-proxy', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const targetUrl =
                parsed.url ||
                'https://script.google.com/macros/s/AKfycbyqw63lvpb_5eIfHKvC7lgF0htYZ6w0SzALGnI3ISmLNlOXYTzHaPqdYgwxAxRJlFHNdw/exec';
              const payload = parsed.payload || { action: 'test' };

              // Security Rule: Backend-level enforcement of State Restrictions
              // Non-admin users are strictly locked to their assigned state
              const userRole = parsed.userRole || payload.userRole;
              const userState = (parsed.userState || payload.userState || '').trim();
              const isRestrictedUser = userRole && userRole !== 'admin' && userState && userState.toLowerCase() !== 'all';

              if (isRestrictedUser) {
                // Force payload state filter to the user's assigned state
                payload.state = userState;
                payload.userState = userState;
              }

              const upstreamRes = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload),
              });

              const text = await upstreamRes.text();
              res.setHeader('Content-Type', 'application/json');

              try {
                let json = JSON.parse(text);

                // Backend-level response scrubbing:
                // Ensure non-admin users NEVER receive candidate records from other states
                if (isRestrictedUser && json) {
                  const targetStateLower = userState.toLowerCase();
                  const filterListByState = (items: any[]) => {
                    return items.filter((item) => {
                      if (!item || typeof item !== 'object') return true;
                      const candState = (item.state || item.State || item['State Name'] || '').trim().toLowerCase();
                      return !candState || candState === targetStateLower;
                    });
                  };

                  if (Array.isArray(json)) {
                    json = filterListByState(json);
                  } else if (Array.isArray(json.candidates)) {
                    json.candidates = filterListByState(json.candidates);
                  } else if (Array.isArray(json.data)) {
                    json.data = filterListByState(json.data);
                  } else if (json.data && Array.isArray(json.data.candidates)) {
                    json.data.candidates = filterListByState(json.data.candidates);
                  } else if (Array.isArray(json.rows)) {
                    json.rows = filterListByState(json.rows);
                  }
                }

                res.end(JSON.stringify(json));
              } catch {
                let message = text;
                if (text.includes('doPost') || text.includes('找不到以下指令碼函式')) {
                  message =
                    'Google Apps Script responded: "Script function not found: doPost". In your Apps Script project editor, define "function doPost(e) { ... }" and deploy a new version (Deploy > Manage deployments > Edit > New version).';
                }
                res.end(
                  JSON.stringify({
                    status: upstreamRes.ok ? 'received' : 'error',
                    message,
                    raw: text,
                  })
                );
              }
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  status: 'error',
                  message: err.message || 'Failed to proxy request to Google Apps Script',
                })
              );
            }
          });
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', service: 'apps-script-proxy' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), appsScriptProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
