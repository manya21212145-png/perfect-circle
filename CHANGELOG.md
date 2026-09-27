# Changelog

All notable changes to Perfect Circle are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Navigation items (Play, Duel, Back, the daily card…) are now real buttons instead of links, so every menu behaves the same way with the keyboard.
- The keyboard test (BT-28) runs on laptop browsers only: phones have no Tab key, and Safari moves between buttons with **Option+Tab** (or with Tab once *Safari → Settings → Advanced → Press Tab to highlight each item* is on).

### Fixed
- Playwright's HTML report now goes to `playwright-report/`, so it no longer clashes with `test-results/`.

## [0.1.0] – 2026-09-27

First working release (v0), built from the Technical Design's 17 "Build and run on your PC" steps.

### Added
- Freehand drawing on an HTML canvas with mouse, touch and stylus (Pointer Events), live score, and a green → red coloured stroke.
- Four shapes: circle, square, triangle and 5-point star, with size and rotation fitting and corner coverage.
- Validation rules: too close, wrong way, not closed, too slow and too short, each with its own message.
- Four modes: classic, time limit (5/3/2 s) with a countdown ring, disappearing ink, moving dot; plus a non-dominant hand tag.
- Home, Setup, Play/Result, Daily, Duel, Split-screen, Profile and Settings screens.
- Daily challenge picked from the UTC date, one scored attempt per day, Wordle-style share text, top-100 leaderboard.
- Streaks, 12 badges and a history graph (daily best + 7-day average) with filters.
- On-device storage in IndexedDB with an upload queue; optional login with nickname + 4-digit PIN; sync between devices.
- Local Node.js server: Express REST API, SQLite database, bcrypt-hashed PINs, 30-day session cookie, rate limit of 60 requests per minute.
- Online 1v1 duels over Socket.IO: room code + QR, synced 3-2-1 countdown, best of 3, server-side scoring, 15-second disconnect rule.
- Split-screen duels on one device (simultaneous on touch screens, turn by turn with a mouse).
- Installable PWA with offline solo play; optional local HTTPS with mkcert certificates.
- 48 unit tests (UT-01 to UT-48), Playwright business-scenario tests, and a GitHub Actions workflow.

### Fixed during testing
- The badge pop-up no longer blocks starting a stroke underneath it.
- Settings → Test tools now appears on the first load when the server runs in test mode.
- Muted text colour darkened to meet WCAG AA contrast.

[Unreleased]: ../../compare/v0.1...HEAD
[0.1.0]: ../../releases/tag/v0.1
