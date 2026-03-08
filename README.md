# WhatsApp Voice Translator Bot

A personal WhatsApp bot that listens for forwarded voice messages and replies with a transcription and translation — powered by Google Gemini 1.5 Flash (free tier).

---

## How It Works

When a voice message arrives (forwarded from any chat, or sent directly), the bot:

1. Downloads the audio automatically
2. Sends it to Gemini, which transcribes and translates it in one step
3. Replies inline to the voice message with both the original text and the translation

The reply looks like this:

> 🎙 **Original (transcription):**
> Hola, ¿cómo estás? Espero que todo vaya bien.
>
> 🌐 **Translation (English):**
> Hello, how are you? I hope everything is going well.

---

## Option A — Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- A Google account to get a free Gemini API key
- WhatsApp installed on your phone

### Installation

**1. Clone the repo and install dependencies**

```bash
git clone <repo-url>
cd whatsapp-voice-translator
npm install
```

**2. Get a free Gemini API key**

Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey), sign in with your Google account, and create a new API key. The free tier allows 15 requests/minute and 1 million tokens/day — plenty for personal use.

**3. Configure the bot**

```bash
cp .env.example .env
```

Open `.env` and set:

```env
GEMINI_API_KEY=your_key_here
TARGET_LANGUAGE=English
```

**4. Start the bot**

```bash
npm start
```

A QR code will appear in the terminal. Open WhatsApp on your phone → **Settings → Linked Devices → Link a Device**, then scan the QR code.

The bot is now running. Keep the terminal open — it needs to stay active.

---

## Option B — Deploy to the Cloud (Free, no computer needed)

You can run this bot 24/7 on [Render.com](https://render.com) for free. No server required — just GitHub and a browser.

### For non-technical users

You don't need to install anything or write any code.

**Step 1 — Get a free Gemini API key**

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key** and copy it — you'll need it later

**Step 2 — Fork this repo on GitHub**

1. Make sure you're logged into [GitHub](https://github.com) (create a free account if you don't have one)
2. Click the **Fork** button in the top-right corner of this page
3. Click **Create fork** — this copies the bot to your own GitHub account

**Step 3 — Sign up for Render and deploy**

1. Go to [https://render.com](https://render.com) and sign up for free (use "Sign in with GitHub" for simplicity)
2. Click **New +** → **Web Service**
3. Choose **Build and deploy from a Git repository** → connect your GitHub account → select your forked repo
4. Render will auto-detect the `Dockerfile`. Leave all settings as-is
5. Scroll down to **Environment Variables** and add:
   - `GEMINI_API_KEY` → paste your API key from Step 1
   - `WA_PHONE_NUMBER` → your WhatsApp number with country code, no `+` or spaces (e.g. `15551234567` for US, `447700900000` for UK)
   - `TARGET_LANGUAGE` → the language you want translations in (e.g. `English`)
6. Click **Create Web Service** and wait for the build to finish (~3–5 minutes)

**Step 4 — Link your WhatsApp**

1. Once deployed, click the **Logs** tab in Render
2. Look for a line that says **WhatsApp pairing code: XXXX-XXXX**
3. On your phone, open WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number**
4. Enter your phone number, then type the 8-digit code from the logs
5. Done — your bot is live!

**Step 5 — Test it**

Forward any voice message to yourself (your "Saved Messages" chat). The bot will reply with the transcription and translation within a few seconds.

> **Note:** Render's free tier pauses your service after 15 minutes of inactivity. When it wakes up, it may lose the WhatsApp session and show a new pairing code in the logs. Just re-enter the new code in WhatsApp. To prevent this, you can use [cron-job.org](https://cron-job.org) (free) to ping your app URL every 14 minutes — see below.

---

### For technical users

**Requirements:** Docker (for local testing), a Render.com account, your repo on GitHub.

**1. Build and test locally with Docker**

```bash
docker build -t prx .
docker run --rm \
  -e GEMINI_API_KEY=your_key \
  -e WA_PHONE_NUMBER=15551234567 \
  -e TARGET_LANGUAGE=English \
  -p 3000:3000 \
  prx
```

Check the logs for the pairing code. Confirm `curl localhost:3000` returns `ok`.

**2. Deploy to Render**

- Connect your GitHub repo to Render → New Web Service → Runtime: Docker
- Set env vars: `GEMINI_API_KEY`, `WA_PHONE_NUMBER`, `TARGET_LANGUAGE`
- Optionally set `ALLOWED_SENDERS` and `ALLOWED_CHATS` (see Configuration below)
- Render auto-deploys on every push to `main`

**3. Keep the free tier awake (optional)**

Render's free tier sleeps after 15 min of no inbound traffic. To prevent this:

1. Go to [cron-job.org](https://cron-job.org) → create a free account
2. New cronjob → URL: `https://<your-app>.onrender.com` → every 14 minutes
3. Save — the health check endpoint (`GET /`) will keep the service alive

**Session persistence:** The free tier uses ephemeral storage. On restart or redeploy, the WhatsApp session is lost and you'll need to re-enter a new pairing code from the logs. This is by design — no extra dependencies needed.

---

## Configuration

All options go in `.env` (local) or as environment variables (Render):

| Variable           | Required | Default   | Description |
|--------------------|----------|-----------|-------------|
| `GEMINI_API_KEY`   | Yes      | —         | Your Google Gemini API key |
| `TARGET_LANGUAGE`  | No       | `English` | Language to translate into (e.g. `Spanish`, `French`, `Russian`) |
| `ALLOWED_CHATS`    | No       | (all)     | Comma-separated chat names to monitor. Partial, case-insensitive match. |
| `ALLOWED_SENDERS`  | No       | (all)     | Comma-separated phone numbers allowed to trigger the bot (country code + digits, no `+`). Prevents others from using your bot. |
| `WA_PHONE_NUMBER`  | No       | —         | Your WhatsApp number for pairing code auth (cloud use). No `+` or spaces. |
| `PORT`             | No       | `3000`    | HTTP port for the health check endpoint. |

**Examples:**

```env
# Only translate messages from specific chats
ALLOWED_CHATS=Family Group,Work Colleagues

# Only allow specific people to trigger the bot
ALLOWED_SENDERS=15551234567,447700900000

# Cloud auth (pairing code instead of QR)
WA_PHONE_NUMBER=15551234567
```

Chat names are matched by partial, case-insensitive substring — `Work` matches `Work Colleagues`.

---

## End User Guide

### Receiving a translation

Forward any voice message to yourself (or to a chat the bot is monitoring). Within a few seconds, the bot will reply directly to that voice message with the transcription and translation.

### How to forward a voice message

1. Long-press the voice message in any chat
2. Tap **Forward**
3. Send it to **Saved Messages** (your personal chat) — the bot monitors all chats by default

### Changing the target language

Edit `TARGET_LANGUAGE` in `.env` (or in Render environment variables) and restart the bot.

### Stopping the bot (local)

Press `Ctrl+C` in the terminal. Your WhatsApp session is saved in `.wwebjs_auth/` — no need to scan the QR code again on the next start.

---

## Notes

- This bot uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), an unofficial library that connects via WhatsApp Web. It is intended for personal use only.
- Your WhatsApp session is stored locally (or in Render's ephemeral disk). Nothing is sent to any third party except the audio bytes sent to the Google Gemini API for processing.
- Voice messages are never stored on disk; they are passed in-memory to Gemini and discarded.
