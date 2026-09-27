# Security

## Where Perfect Circle is meant to run

Perfect Circle v0 is designed to run on **one personal computer on a private local network** (home or classroom Wi-Fi).
Do not expose port 3000 to the internet, for example with router port forwarding. Public hosting is out of scope for v0.

## How player data is protected

- **Only a nickname and a hashed PIN are stored**, in `data/perfect-circle.db` on the host computer. PINs are hashed with bcrypt; the plain PIN is never saved.
- **Login** uses an HTTP-only session cookie that lasts 30 days. It is marked *Secure* when the server runs on HTTPS.
- **Scores other players see** (duels and the daily leaderboard) are recalculated on the server from the submitted stroke. Scores sent by a browser are ignored.
- **Rate limit:** 60 requests per player per minute.
- **No data leaves the local network.** Fonts and all code are bundled; there are no analytics or third-party calls.
- `data/` and `certs/` are in `.gitignore`, so the database and the HTTPS private key never reach Git.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ |

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, contact the repository owner privately.
On GitHub, use **Security → Report a vulnerability** if it is enabled, or message the owner directly.
Include what you found, how to reproduce it, and what could happen. You'll get a reply as soon as possible.
