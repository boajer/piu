# Project Guidelines for Claude

This file is automatically read by Claude Code at the start of every session.
Update it after learning new preferences or constraints from the user.

---

## Project

WhatsApp personal bot that transcribes and translates forwarded voice messages using Google Gemini 1.5 Flash.

**Stack:** Node.js · whatsapp-web.js · @google/generative-ai · dotenv

---

## Code Conventions

- **Runtime:** Node.js, CommonJS (`require`). Do not switch to ESM unless asked.
- **Package manager:** npm. Do not use yarn or bun unless asked.
- **Style:** plain, minimal JS — no TypeScript, no build step, no transpilers.
- **No over-engineering:** no premature abstractions, no helpers for one-off ops, no extra error handling for cases that cannot happen.
- **No unsolicited extras:** don't add docstrings, comments, type hints, or refactors beyond what was explicitly requested.
- **Env config:** all secrets and tuneable values go in `.env` / `.env.example`. Never hardcode keys.

---

## Git Workflow

- Every logical change gets its **own isolated commit** — do not bundle unrelated changes.
- Commit messages: **one line, no period, imperative mood, focused on purpose** (not mechanics).
  - Good: `Add chat filtering by name to reduce noise`
  - Bad: `Updated index.js to add the filtering feature for chats based on name`
- Never amend published commits. Create new ones.
- Branch name: `main`.

---

## Limitations & Constraints

- **Personal use only** — whatsapp-web.js is unofficial; do not suggest scaling to multi-user or production WhatsApp Business API unless asked.
- **Free-tier first** — prefer Gemini free tier. Flag if a change would push past free limits.
- **No persistent storage** — voice audio is never written to disk; keep it in-memory.
- **No external servers** — the bot runs locally; do not introduce webhooks, cloud functions, or hosted infra unless asked.

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
