# WhatsApp Voice Translator Bot

A personal WhatsApp bot that listens for voice messages and sends you a transcription and translation — powered by Google Gemini 2.5 Flash (free tier).

---

## How It Works

When a voice message arrives in any monitored chat, the bot:

1. Downloads the audio in-memory
2. Sends it to Gemini, which transcribes and translates it in one step
3. Forwards the original voice message to your personal chat (Saved Messages)
4. Sends the transcription and translation as a follow-up message to yourself

The message you receive looks like this:

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
git clone https://github.com/boajer/piu.git
cd piu
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

## Option B — Deploy to the Cloud (Free, runs 24/7)

This uses [Fly.io](https://fly.io) — free tier, no sleep, persistent WhatsApp session.

### Prerequisites

- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) installed (`brew install flyctl` on Mac)
- A free Fly.io account (`fly auth signup`)
- Your Gemini API key (see Step 2 above)

### Deploy steps

**1. Clone the repo**

```bash
git clone https://github.com/boajer/piu.git
cd piu
```

**2. Create the app and persistent storage**

```bash
fly apps create piu-bot
fly volumes create whatsapp_auth --region lhr --size 1
```

> Change `lhr` (London) to the region closest to you: `iad` (US East), `fra` (Frankfurt), `ams` (Amsterdam), `sin` (Singapore), `syd` (Sydney).

**3. Set secrets**

```bash
fly secrets set GEMINI_API_KEY=your_key_here
fly secrets set WA_PHONE_NUMBER=15551234567   # your number, country code + digits, no +
fly secrets set TARGET_LANGUAGE=English
```

**4. Deploy**

```bash
fly deploy
```

**5. Link your WhatsApp (first time only)**

```bash
fly logs
```

Watch the logs for a line like:
```
[AUTH] Pairing code: ABCD-1234
```

On your phone: WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number** → enter your number → type the 8-character code.

Done. The session is saved to the persistent volume — no re-linking needed on restart or redeploy.

**6. Verify**

```bash
fly status          # should show 1 instance running
curl https://piu-bot.fly.dev   # should return: ok
```

---

## Configuration

All options go in `.env` (local) or set via `fly secrets set` (cloud):

| Variable           | Required | Default          | Description |
|--------------------|----------|------------------|-------------|
| `GEMINI_API_KEY`   | Yes      | —                | Your Google Gemini API key |
| `TARGET_LANGUAGE`  | No       | `English`        | Language to translate into (e.g. `Spanish`, `French`, `Russian`) |
| `GEMINI_MODEL`     | No       | `gemini-2.5-flash` | Gemini model to use. Must support audio input. |
| `ALLOWED_CHATS`    | No       | (all)            | Comma-separated chat names to monitor. Partial, case-insensitive match. |
| `ALLOWED_SENDERS`  | No       | (all)            | Comma-separated phone numbers allowed to trigger the bot (country code + digits, no `+`). |
| `WA_PHONE_NUMBER`  | No       | —                | Your WhatsApp number for pairing code auth (cloud). No `+` or spaces. |
| `PORT`             | No       | `3000`           | HTTP port for the health check endpoint. |

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

### How to get a translation

Forward any voice message from any chat to yourself. The bot monitors incoming voice messages and will:
1. Forward the original voice message to your personal chat
2. Send the transcription and translation right after it

### How to forward a voice message

1. Long-press the voice message in any chat
2. Tap **Forward**
3. Send it to **Saved Messages** (your personal chat)

### Changing the target language

Edit `TARGET_LANGUAGE` in `.env` (or `fly secrets set TARGET_LANGUAGE=Spanish`) and restart the bot.

### Local development

```bash
npm run dev   # starts with nodemon — auto-restarts on file changes
```

### Stopping the bot (local)

Press `Ctrl+C`. Your WhatsApp session is saved in `.wwebjs_auth/` — no need to scan the QR code again on the next start.

---

## Notes

- Uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial library that connects to WhatsApp via WebSocket. No browser or Puppeteer required. Intended for personal use only.
- Voice messages are never written to disk — audio is passed in-memory to Gemini and discarded.
- The `/logs` endpoint (`GET /logs`) returns a rolling buffer of the last 200 log lines — useful for debugging on cloud deployments.
