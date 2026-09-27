// Builds the Express app: REST API under /api, and the built game (dist/) for everything else.
// Kept separate from index.ts so tests can use the app without opening port 3000.

import express from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db';
import { sessionToken } from './auth';
import { loginRoutes } from './routes/login';
import { attemptRoutes } from './routes/attempts';
import { dailyRoutes } from './routes/daily';
import { leaderboardRoutes } from './routes/leaderboard';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface AppOptions {
  db: Db;
  testMode?: boolean;      // business testing: allows the date override
  secureCookie?: boolean;  // true when running on HTTPS
  distDir?: string;
}

export function createApp({ db, testMode = false, secureCookie = false, distDir = join(root, 'dist') }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  // 60 requests per player per minute (by login cookie, or by device address if not logged in)
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => sessionToken(req) ?? ipKeyGenerator(req.ip ?? ''),
  });

  const api = express.Router();
  api.use(limiter);
  api.get('/config', (_req, res) => { res.json({ testMode }); });
  api.use(loginRoutes(db, secureCookie));
  api.use(leaderboardRoutes(db));
  api.use(dailyRoutes(db, testMode));
  api.use(attemptRoutes(db));
  app.use('/api', api);
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });

  // The built game. index.html is never cached so updates show up straight away.
  if (existsSync(distDir)) {
    app.use(express.static(distDir, {
      setHeaders(res, path) {
        if (path.endsWith('index.html') || path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
  } else {
    app.get('/', (_req, res) => {
      res.type('text').send('The game is not built yet. Run "npm run build" first, then "npm start".');
    });
  }
  return app;
}
