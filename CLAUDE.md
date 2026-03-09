# Project Guidelines for Claude

This file is automatically read by Claude Code at the start of every session.
Update it after learning new preferences or constraints from the user.

---

## Project

WhatsApp personal bot that transcribes and translates voice messages using Google Gemini 2.5 Flash.

**Stack:** Node.js · @whiskeysockets/baileys · @google/generative-ai · pino · dotenv · npm

**Deployed:** Fly.io (`piu-bot`) — region `lhr`, persistent volume `whatsapp_auth` mounted at `/app/auth`

**Repo:** `git@github-boajer:boajer/piu.git` (SSH alias for the `boajer` GitHub account using `~/.ssh/id_ed25519`)

---

## Architecture

- `index.js` — single-file bot. Baileys WebSocket connection, Gemini audio API, in-memory log buffer, HTTP health server.
- Auth session stored in `./auth` (gitignored). On Fly.io this is a mounted persistent volume.
- `/logs?token=LOG_TOKEN` endpoint — returns last 200 log lines. Requires `LOG_TOKEN` secret (set via `fly secrets set`). Phone numbers are masked in all log output.
- Health check: `GET /` returns `ok`.

---

## Code Conventions

- **Runtime:** Node.js, CommonJS (`require`). Do not switch to ESM unless asked.
- **Package manager:** npm. Do not use yarn or bun unless asked.
- **Style:** plain, minimal JS — no TypeScript, no build step, no transpilers.
- **No over-engineering:** no premature abstractions, no helpers for one-off ops, no extra error handling for cases that cannot happen.
- **No unsolicited extras:** don't add docstrings, comments, type hints, or refactors beyond what was explicitly requested.
- **Env config:** all secrets and tuneable values go in `.env` / `.env.example`. Never hardcode keys.

---

## Security — Non-Negotiable

- **Never commit real tokens, API keys, or secrets** — not even temporarily, not even in a private branch.
- `.env` is always gitignored. `.env.example` must contain placeholder values only (e.g. `your_key_here`).
- Before staging any file, check it does not contain real credentials.
- If a secret is ever found in git history, flag it immediately so the user can revoke and rotate it.
- `LOG_TOKEN` is a Fly.io secret — never in code or `.env.example`.

---

## Git Workflow

- Every logical change gets its **own isolated commit** — do not bundle unrelated changes.
- Commit messages: **one line, no period, imperative mood, focused on purpose** (not mechanics).
  - Good: `Add chat filtering by name to reduce noise`
  - Bad: `Updated index.js to add the filtering feature for chats based on name`
- Never amend published commits. Create new ones.
- Branch name: `main`.
- Push with: `git push git@github-boajer:boajer/piu.git main`

---

## Deployment

- **Platform:** Fly.io, app name `piu-bot`, region `lhr`
- **Deploy:** `fly deploy -a piu-bot` (run from repo root where `fly.toml` lives)
- **Logs:** `fly logs -a piu-bot --no-tail` or `curl "https://piu-bot.fly.dev/logs?token=<LOG_TOKEN>"`
- **Secrets:** managed via `fly secrets set KEY=value -a piu-bot`
- **Machine:** auto-stop is OFF (`auto_stop_machines = "off"` in `fly.toml`). Machine stays running permanently.
- **Auth linking:** On first deploy or after logout, check `fly logs` for `[AUTH] Pairing code: XXXXXXXX`, then enter it in WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number.

---

## Limitations & Constraints

- **Personal use only** — Baileys is unofficial; do not suggest scaling to multi-user or production WhatsApp Business API unless asked.
- **Free-tier first** — prefer Gemini free tier. Flag if a change would push past free limits.
- **No persistent storage** — voice audio is never written to disk; keep it in-memory.

---

## Communication Preferences

- Responses should be **short and direct** — skip preamble.
- No emojis in responses unless the user uses them first.
- When referencing code, include `file:line` for easy navigation.
- Do not give time estimates.

---

## How to Keep This File Updated

After each session where new preferences, constraints, or decisions are established:
1. Add or update the relevant section here.
2. Commit the change in its own commit: `Update CLAUDE.md with <topic>`.
