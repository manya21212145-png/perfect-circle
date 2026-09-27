// Starts the Perfect Circle server on port 3000, on every network interface,
// so phones and laptops on the same Wi-Fi can open http://<PC address>:3000.
//
//   npm start          normal play, database data/perfect-circle.db
//   npm run start:test business testing, database data/test.db + date override allowed
//
// If certs/cert.pem and certs/key.pem exist (made with mkcert), it runs on HTTPS instead.

import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { openDb } from './db';
import { createApp } from './app';
import { attachDuels } from './duel';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 3000);
const testMode = process.argv.includes('--test');
const certFile = join(root, 'certs', 'cert.pem');
const keyFile = join(root, 'certs', 'key.pem');
const https = existsSync(certFile) && existsSync(keyFile);

const db = openDb(process.env.DB_FILE ?? join(root, 'data', testMode ? 'test.db' : 'perfect-circle.db'));
const app = createApp({ db, testMode, secureCookie: https });
const server = https
  ? createHttps({ cert: readFileSync(certFile), key: readFileSync(keyFile) }, app)
  : createHttp(app);
const io = new Server(server);
attachDuels(io, db);

server.listen(PORT, '0.0.0.0', () => {
  const scheme = https ? 'https' : 'http';
  console.log(`\nPerfect Circle is running${testMode ? ' in TEST mode (data/test.db)' : ''}.`);
  console.log(`  On this computer:  ${scheme}://localhost:${PORT}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  Phones on Wi-Fi:   ${scheme}://${a.address}:${PORT}`);
    }
  }
  console.log('Press Ctrl+C to stop.\n');
});

// Close the database cleanly on Ctrl+C so no data is lost.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    io.close();
    server.close();
    db.close();
    process.exit(0);
  });
}
