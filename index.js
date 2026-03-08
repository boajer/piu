require('dotenv').config();

const http = require('http');
const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const logBuffer = [];
const log = (tag, msg) => {
  const line = `[${new Date().toISOString()}] [${tag}] ${msg}`;
  console.log(line);
  logBuffer.push(line);
  if (logBuffer.length > 200) logBuffer.shift();
};

// --- Config ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TARGET_LANGUAGE = process.env.TARGET_LANGUAGE || 'English';
const ALLOWED_CHATS = process.env.ALLOWED_CHATS
  ? process.env.ALLOWED_CHATS.split(',').map(s => s.trim().toLowerCase())
  : [];
const ALLOWED_SENDERS = process.env.ALLOWED_SENDERS
  ? process.env.ALLOWED_SENDERS.split(',').map(s => s.trim())
  : [];

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
log('BOOT', `target_language=${TARGET_LANGUAGE} model=${GEMINI_MODEL} allowed_chats=[${ALLOWED_CHATS}] allowed_senders=[${ALLOWED_SENDERS}]`);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel(
  { model: GEMINI_MODEL },
  { apiVersion: 'v1beta' }
);

// --- WhatsApp client ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', async (qr) => {
  log('AUTH', 'QR event fired — need to link device');
  if (process.env.WA_PHONE_NUMBER) {
    log('AUTH', `Requesting pairing code for ${process.env.WA_PHONE_NUMBER}...`);
    try {
      const code = await client.requestPairingCode(process.env.WA_PHONE_NUMBER);
      log('AUTH', `Pairing code: ${code}`);
      log('AUTH', 'In WhatsApp: Linked Devices → Link a Device → Link with phone number → enter the code above');
    } catch (err) {
      log('AUTH', `requestPairingCode failed: ${err.message} — falling back to QR scan`);
      qrcode.generate(qr, { small: true });
    }
  } else {
    console.log('\nScan this QR code with WhatsApp (Linked Devices):\n');
    qrcode.generate(qr, { small: true });
  }
});

client.on('authenticated', () => {
  log('AUTH', 'Authenticated successfully — session saved');
});

client.on('ready', () => {
  log('WA', `Client ready | target=${TARGET_LANGUAGE} | chats=${ALLOWED_CHATS.length ? ALLOWED_CHATS.join(',') : 'ALL'} | senders=${ALLOWED_SENDERS.length ? ALLOWED_SENDERS.join(',') : 'ALL'}`);
});

client.on('auth_failure', (msg) => {
  log('AUTH', `Authentication FAILED: ${msg}`);
});

client.on('disconnected', (reason) => {
  log('WA', `Disconnected: ${reason}`);
});

client.on('loading_screen', (percent, message) => {
  log('WA', `Loading ${percent}% — ${message}`);
});

// --- Message handler ---
client.on('message_create', async (message) => {
  const t0 = Date.now();
  log('MSG', `message_create | type=${message.type} | from=${message.from} | fromMe=${message.fromMe} | forwarded=${message.isForwarded}`);

  try {
    // Only handle audio/voice messages
    const isVoice = message.type === MessageTypes.AUDIO || message.type === MessageTypes.VOICE;
    if (!isVoice) {
      log('MSG', `Skipped — not audio/voice (type=${message.type})`);
      return;
    }

    // If ALLOWED_SENDERS is set, only process messages from whitelisted numbers
    if (ALLOWED_SENDERS.length > 0) {
      const senderNumber = message.from.replace(/@c\.us$|@g\.us$/, '');
      const isAllowedSender = ALLOWED_SENDERS.some(n => senderNumber.includes(n));
      log('MSG', `Sender check | number=${senderNumber} | allowed=${isAllowedSender}`);
      if (!isAllowedSender) { log('MSG', 'Blocked by ALLOWED_SENDERS'); return; }
    }

    // If ALLOWED_CHATS is set, filter by chat name
    if (ALLOWED_CHATS.length > 0) {
      const chat = await message.getChat();
      const chatName = chat.name ? chat.name.toLowerCase() : '';
      const isAllowed = ALLOWED_CHATS.some(allowed => chatName.includes(allowed));
      log('MSG', `Chat check | name="${chatName}" | allowed=${isAllowed}`);
      if (!isAllowed) { log('MSG', 'Blocked by ALLOWED_CHATS'); return; }
    }

    log('MSG', 'Voice message accepted — downloading audio...');
    const t1 = Date.now();
    const media = await message.downloadMedia();
    log('MSG', `Audio downloaded in ${Date.now() - t1}ms | mimetype=${media?.mimetype} | size=${media?.data?.length ?? 0} bytes (base64)`);

    if (!media || !media.data) {
      log('MSG', 'ERROR: media download returned empty');
      return;
    }

    await message.react('⏳');

    log('GEMINI', `Sending audio to ${GEMINI_MODEL} (${(media.data.length * 0.75 / 1024).toFixed(1)} KB)...`);
    const t2 = Date.now();
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: media.mimetype || 'audio/ogg; codecs=opus',
          data: media.data,
        },
      },
      {
        text: `Listen to this voice message and do the following:
1. Transcribe it exactly as spoken (original language).
2. Translate it to ${TARGET_LANGUAGE}.

Reply in this exact format:
🎙 *Original (transcription):*
[transcription here]

🌐 *Translation (${TARGET_LANGUAGE}):*
[translation here]

If the audio is already in ${TARGET_LANGUAGE}, still provide both fields but note it's already in the target language.
If you cannot understand the audio, say so clearly.`,
      },
    ]);
    const responseText = result.response.text();
    log('GEMINI', `Response received in ${Date.now() - t2}ms | length=${responseText.length} chars`);

    await message.reply(responseText);
    await message.react('✅');
    log('MSG', `Done — total processing time ${Date.now() - t0}ms`);
  } catch (err) {
    log('ERROR', `Processing failed after ${Date.now() - t0}ms: ${err.message}`);
    try {
      await message.react('❌');
      await message.reply('Sorry, I could not process this voice message. Error: ' + err.message);
    } catch (_) {}
  }
});

client.initialize();
log('BOOT', 'WhatsApp client initializing...');

// --- Health check + log viewer server ---
http.createServer((req, res) => {
  if (req.url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(logBuffer.join('\n'));
  } else {
    res.end('ok');
  }
}).listen(process.env.PORT || 3000);
log('HTTP', `Health check server listening on port ${process.env.PORT || 3000}`);
