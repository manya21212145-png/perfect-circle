# Perfect Circle v0.1

Draw a circle, square, triangle or star around a dot and get an accuracy score from 0 to 100%.
The game runs on your own Mac as a small server at **http://localhost:3000**. Phones and
laptops on the same Wi-Fi play by opening your Mac's address, for example `http://192.168.1.5:3000`.

Built from the five project documents prepared by Manya Bansal (Requirement, Functional Design,
Technical Design, Unit Test, Business Testing).

---

## 1. Install the tools (once)

Open **Terminal** (press ⌘ Space, type *Terminal*, press Return).

1. **Node.js 24 LTS**: download the macOS installer from <https://nodejs.org> (the "LTS" button) and run it.
2. **Git**: type `xcode-select --install` and click *Install* (skip this if it says it is already installed).

Close Terminal, open it again, and check:

```bash
node -v    # v24.x.x
npm -v     # 11.x.x
git --version
```

> The Technical Design says Node 20, but Node 20 no longer gets updates (since April 2026), and the
> test tool (Vitest 5) needs Node 22 or newer. Use Node 24.

## 2. Install the project's packages

```bash
cd ~/Documents/perfect-circle
npm install
```

You should see `added … packages` and `found 0 vulnerabilities`.

## 3. Run the tests

```bash
npm test            # 48 unit tests → "Tests  48 passed (48)"
npm run coverage    # the same, plus the coverage table
```

## 4. Build and start the game

```bash
npm run build       # makes the dist/ folder → "✓ built in …"
npm start           # starts the server
```

You will see:

```
Perfect Circle is running.
  On this computer:  http://localhost:3000
  Phones on Wi-Fi:   http://192.168.1.5:3000
Press Ctrl+C to stop.
```

Open **http://localhost:3000** in Chrome or Safari. Press **Ctrl+C** in Terminal to stop the server.

## 5. Let phones join (same Wi-Fi)

1. Use the *Phones on Wi-Fi* address that `npm start` printed. (You can also run `ipconfig getifaddr en0`.)
2. If macOS asks *"Do you want the application node to accept incoming network connections?"*, click **Allow**.
   (If the firewall is on and nothing asks, go to System Settings → Network → Firewall → Options and allow `node`.)
3. On the phone, open `http://<that address>:3000`.
4. So that the address doesn't change, reserve a fixed IP for your Mac in your Wi-Fi router's settings.

## 6. Optional: keep it running with pm2

```bash
npm i -g pm2
pm2 start npm --name perfect-circle -- start
pm2 save
pm2 startup      # prints one command; copy and run it so the game starts after a restart
```

`pm2 status` shows it; `pm2 logs perfect-circle` shows its messages; `pm2 stop perfect-circle` stops it.

## 7. Optional: install the app on phones (local HTTPS)

Phones only offer "Install app" / "Add to Home Screen" as a full app on HTTPS.

```bash
brew install mkcert            # needs Homebrew: https://brew.sh
mkcert -install
mkdir -p certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 192.168.1.5   # use YOUR address
npm start                      # now prints https:// addresses
```

Then trust the certificate on each phone. `mkcert -CAROOT` shows the folder that holds `rootCA.pem`.
- **iPhone:** AirDrop `rootCA.pem` to the phone, then go to Settings → General → VPN & Device Management and install it. Then go to Settings → General → About → Certificate Trust Settings and switch it on.
- **Android:** copy the file over, then go to Settings → Security → Encryption & credentials → Install a certificate → CA certificate.

## 8. Business testing (separate test database)

```bash
npm run start:test     # uses data/test.db, and turns on the date override in Settings → Test tools
```

End-to-end tests (real browsers, run automatically against a throw-away database):

```bash
npx playwright install   # once
npm run build
npm run e2e
```

## 9. Backup

All server data lives in one file: `data/perfect-circle.db`. Stop the server, then copy that file to another drive.

---

## Folder structure

```
perfect-circle/
  index.html            the page: canvas + app area
  vite.config.ts        dev server, PWA (app name, icons, offline), unit-test settings
  playwright.config.ts  end-to-end tests (laptop Chrome, Android phone, iPhone Safari)
  src/                  code that runs in the browser
    input/              capture.ts (mouse/touch/pen points), resample.ts (128 even points)
    scoring/            circle.ts, polygon.ts, templates.ts, validate.ts, index.ts (shared with server)
    modes/              timed.ts, ink.ts, moving.ts, index.ts
    render/             draw.ts (canvas), colours.ts (green→red), sound.ts
    daily/              seed.ts (challenge of the day), share.ts (share text)
    progression/        streak.ts, badges.ts, history.ts
    duel/               room.ts (codes + messages), match.ts (best of 3), split-screen.ts
    data/               indexeddb.ts (on-device storage), sync.ts, api.ts
    screens/            home, setup, play (+ result), daily, duel, split, profile, settings,
                        board.ts (the drawing board), ui.ts (helpers)
    state.ts            settings, login, saving results
  server/
    index.ts            starts the server on port 3000 (HTTPS if certs/ exists)
    app.ts              Express app: /api routes + serves dist/
    routes/             login.ts, attempts.ts, daily.ts, leaderboard.ts
    duel.ts             Socket.IO duel rooms, synced countdown, server-side scoring
    db.ts, schema.sql   SQLite setup and queries
  data/                 perfect-circle.db (made on first run)
  dist/                 the built game (npm run build)
  tests/
    unit/               48 Vitest + Supertest tests (UT-01 … UT-48)
    e2e/                Playwright business scenarios (BT-xx)
    helpers/strokes.ts  generates perfect/noisy test shapes
```

## How a drawing becomes a score

1. **input/capture.ts** records each pointer position with a time. Points under 2 px apart are hand jitter and are skipped.
2. **scoring/validate.ts** checks the rules while you draw: too close (45 px), wrong way (0.45 rad back) and too slow (10 s, or the mode's limit). When you finish, it also checks too short (fewer than 10 points) and not closed (under 93% of a turn).
3. **input/resample.ts** spreads the stroke into 128 evenly spaced points, so fast and slow drawers are treated the same.
4. **modes/moving.ts** (moving dot only) shifts each point by where the dot was at that moment.
5. **scoring/circle.ts** or **scoring/polygon.ts** finds the ideal shape and the average error `d` compared with its size `R`:
   `score = max(0, 100 × (1 − 2.5 × d / R)) × corner coverage`. Circles have no corners, so their corner coverage is always 1.
6. **render/draw.ts** colours each piece of the line from green to red, and draws the dashed ideal shape on top.

The server imports the same `src/scoring` code, so daily and duel scores are recalculated on the PC. Any score a browser sends is ignored.
