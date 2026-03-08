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

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- A Google account to get a free Gemini API key
- WhatsApp installed on your phone

---

## Installation

**1. Clone the repo and install dependencies**

```bash
git clone <repo-url>
cd whatsapp-voice-translator
npm install
```

**2. Get a free Gemini API key**

Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey), sign in with your Google account, and create a new API key. The free tier allows 15 requests/minute and 1 million tokens/day — plenty for personal use.

**3. Configure the bot**

Copy the example config and fill in your key:

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

## Configuration

All options live in `.env`:

| Variable        | Required | Default   | Description                                                                 |
|-----------------|----------|-----------|-----------------------------------------------------------------------------|
| `GEMINI_API_KEY`| Yes      | —         | Your Google Gemini API key                                                  |
| `TARGET_LANGUAGE` | No     | `English` | The language to translate into (e.g. `Spanish`, `French`, `Russian`)       |
| `ALLOWED_CHATS` | No       | (all)     | Comma-separated list of chat names to monitor. Leave empty for all chats.  |

**Example — translate only from specific chats:**

```env
ALLOWED_CHATS=Family Group,Work Colleagues
```

Chat names are matched by partial, case-insensitive substring, so `Work` matches `Work Colleagues`.

---

## End User Guide

### Receiving a translation

Just forward any voice message to yourself (or to the chat the bot is monitoring). Within a few seconds, the bot will reply directly to that voice message with the transcription and translation.

### Forwarding a voice message

1. Long-press the voice message in any chat
2. Tap **Forward**
3. Send it to **Saved Messages** (your personal chat) — the bot monitors all chats by default

### Changing the target language

Edit `TARGET_LANGUAGE` in `.env` and restart the bot (`Ctrl+C`, then `npm start`).

### Stopping the bot

Press `Ctrl+C` in the terminal. Your WhatsApp session is saved locally in `.wwebjs_auth/` so you won't need to scan the QR code again on the next start.

---

## Notes

- This bot uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), an unofficial library that connects via WhatsApp Web. It is intended for personal use only.
- Your WhatsApp session is stored locally — nothing is sent to any third-party except the audio bytes sent to the Google Gemini API for processing.
- Voice messages are never stored on disk; they are passed in-memory to Gemini and discarded.
