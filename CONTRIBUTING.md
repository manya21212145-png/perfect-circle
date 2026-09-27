# Contributing to Perfect Circle

Thanks for helping! This project follows five documents in [`docs/`](docs/), prepared by Manya Bansal.
**They are the source of truth.** If a change would go against them, open an issue first so the documents can be updated.

## Set up

```bash
git clone <repo-url> perfect-circle
cd perfect-circle
npm install
npm test
```
You need Node.js 22.12+ (24 LTS recommended). See the [README](README.md#quick-start) for platform notes.

## How to make a change

1. **Create a branch** from `main`:
   ```bash
   git switch -c fix/star-corner-reach
   ```
   Branch names start with `feature/`, `fix/`, `docs/` or `test/`.
2. **Make the change.** Follow the build order in the Technical Design, one feature at a time.
3. **Add or update tests.** Every rule in the Unit Test Document has a test named after its ID (for example `UT-14 …`), and a new rule needs one too.
4. **Check everything passes:**
   ```bash
   npx tsc -p .          # no TypeScript errors
   npm test              # all unit tests pass
   npm run coverage      # coverage stays at or above the targets below
   npm run build && npm run e2e   # browser tests, if you touched screens or the server
   ```
5. **Commit** with a short message that says what changed, in the present tense:
   ```bash
   git commit -m "Relax star corner reach from 12% to 15% of R"
   ```
6. **Push and open a pull request.** Fill in the template and link the issue, requirement (FR-xx) or test (UT-xx / BT-xx).

## Coverage targets (Unit Test Document)

| Module | Line coverage |
|---|---|
| scoring | 95% |
| daily, progression | 90% |
| input, modes, duel, data, server | 80% |
| whole project | 80% |

## Code style

- TypeScript, 2-space indentation (see `.editorconfig`).
- Keep `src/scoring` free of browser code: the server imports it too.
- Write comments in plain English that a beginner can follow.
- Never commit `data/*.db*`, `certs/`, `node_modules/` or `dist/`; `.gitignore` already excludes them.

## Reporting a defect

Use the **Bug report** issue template. Include the test ID if there is one, the steps, the expected and actual result, the device and browser, and a severity:

| Severity | Meaning |
|---|---|
| Critical | Game unusable or data lost |
| High | A Must feature fails |
| Medium | Works, but wrong or confusing |
| Low | Cosmetic |
