import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

const env = process.env;
const production = env.NODE_ENV === 'production';

if (!env.ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD is not set, so the admin dashboard is locked. Add it to .env.');
}
if (production && !env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set: admins will be logged out whenever the server restarts.');
}

const app = createApp({
  dataDir: path.resolve(root, env.DATA_DIR || 'data'),
  adminPassword: env.ADMIN_PASSWORD,
  sessionSecret: env.SESSION_SECRET,
  publicUrl: env.PUBLIC_URL,
  production,
  clientDist: path.join(root, 'dist'),
  hubtel: {
    apiId: env.HUBTEL_API_ID,
    apiKey: env.HUBTEL_API_KEY,
    merchantAccount: env.HUBTEL_MERCHANT_ACCOUNT,
    posSalesId: env.HUBTEL_POS_SALES_ID,
  },
});

const port = Number(env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Shop API running on http://localhost:${port}`);
});
