# Perfect Circle — v0.1 Build and Test Report

Prepared by: Manya Bansal · 27 Sep 2026 · Version 0.1

All 17 "Build and run on your PC" steps from the Technical Design are done. Below: test results,
the business scenarios still needing real devices, and where the build differs from the documents.

## Unit tests (Unit Test Document)

- **48 of 48 pass** (`npm test`).
- Line coverage (`npm run coverage`), all targets met:

| Module | Target | Result |
|---|---|---|
| scoring | 95% | 99.3% |
| daily | 90% | 100% |
| progression | 90% | 100% |
| input | 80% | 100% |
| modes | 80% | 88.7% |
| duel | 80% | 100% |
| data | 80% | 81.8% |
| server | 80% | 91.4% (routes 98.9%) |
| whole project | 80% | 94.9% |

Canvas drawing and screens are left out of coverage, as the Unit Test Document's strategy says; Playwright tests them instead.

## Business scenarios (automated with Playwright, laptop Chrome + Android phone size)

38 browser runs pass. Scenario status:

| Status | Scenarios |
|---|---|
| Pass (automated) | BT-01, 02, 03, 04, 05, 07, 08, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 27, 28, 30 |
| Pass (checked by script) | BT-31: server answers 0.8 s after start. BT-33: players, attempts and login survive a restart |
| Partly automated | BT-06: the dot moves and attempts are scored; "scores well when steady" needs a person |
| Needs real devices / people | BT-09 (scan QR with a phone camera), BT-21, 22, 23 (install), BT-25 (lag on a mid-range phone), BT-26 (fairness rating), BT-29 (smartboard), BT-32 (phone on Wi-Fi) |

The iPhone (Safari engine) project in `playwright.config.ts` has not been run yet. Run `npm run e2e` on the Mac to include it.

Other checks: PINs are stored only as bcrypt hashes. The 61st request in a minute gets status 429.
The app's JavaScript is about 102 KB gzipped (NFR-02 limit: 300 KB); the chart code loads only on Profile.

## Defects found and fixed during testing

1. **Medium:** the badge pop-up could block starting a stroke under it. Pop-ups now let touches pass through.
2. **Medium:** the Settings test tools could stay hidden on the first load in test mode. Test mode is now remembered and shown as soon as the server answers.
3. **Low:** small text contrast. `--muted` was darkened to #5B6275 to meet WCAG AA.

## Differences from the documents (for approval)

- **Node 24 instead of Node 20** (Technical Design, NFR-09). Node 20 stopped getting updates in April 2026, and Vitest 5 needs Node 22+.
- **Newer tools**: Vite 8 and TypeScript 6, instead of the Vite 5 and TypeScript 5 in the stack table. Express is kept at 4, as the table says.
- **Data model additions**: `attempts.limit_s` (the time limit for timed mode, from the Functional Design), `attempts.daily_date` (so streaks can be rebuilt after a sync), and `duel_rounds.winner_seat`.
- **Daily numbering**: challenge #1 is 27 Sep 2026 (launch day = 26 Sep).
- **Fonts are bundled** instead of loaded from Google Fonts, so offline play works and nothing leaves the local network (NFR-07).
- **Leaderboard** (FR-18, "Could"): included; players appear on it after signing in.

## To tune in business testing

- With k = 2.5 and corner coverage, a circle drawn for a square scores 0% (UT-11 only requires below 75%), and a square with very rounded corners loses a lot of its score. BT-26 fairness ratings should decide whether to relax the 12% corner reach or k.

## Sign-off

- [ ] Business testing complete and exit criteria met. Approved by Manya Bansal, product owner and UAT lead. Date and signature: ________
