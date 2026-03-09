require('dotenv').config();

const http = require('http');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
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
const AUTH_DIR = process.env.AUTH_DIR || './auth';

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
log('BOOT', `target_language=${TARGET_LANGUAGE} model=${GEMINI_MODEL} allowed_chats=[${ALLOWED_CHATS}] allowed_senders=[${ALLOWED_SENDERS}] auth_dir=${AUTH_DIR}`);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel(
  { model: GEMINI_MODEL },
  { apiVersion: 'v1beta' }
);

const silentLogger = pino({ level: 'silent' });

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      log('AUTH', 'QR event fired — need to link device');
      if (process.env.WA_PHONE_NUMBER) {
        log('AUTH', `Requesting pairing code for ${process.env.WA_PHONE_NUMBER}...`);
        try {
          const code = await sock.requestPairingCode(process.env.WA_PHONE_NUMBER);
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
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log('WA', `Connection closed | code=${code} | reconnecting=${shouldReconnect}`);
      if (shouldReconnect) start();
    } else if (connection === 'open') {
      log('WA', `Connected | jid=${sock.user?.id} | target=${TARGET_LANGUAGE} | chats=${ALLOWED_CHATS.length ? ALLOWED_CHATS.join(',') : 'ALL'} | senders=${ALLOWED_SENDERS.length ? ALLOWED_SENDERS.join(',') : 'ALL'}`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      const t0 = Date.now();
      const jid = msg.key.remoteJid;
      const fromMe = msg.key.fromMe;
      const msgType = getContentType(msg.message);

      log('MSG', `messages.upsert | type=${msgType} | jid=${jid} | fromMe=${fromMe}`);

      if (fromMe) { log('MSG', 'Skipped — fromMe'); continue; }
      if (!msg.message) { log('MSG', 'Skipped — no message content'); continue; }

      const isVoice = msgType === 'audioMessage';
      if (!isVoice) { log('MSG', `Skipped — not audio (type=${msgType})`); continue; }

      // Sender filter
      if (ALLOWED_SENDERS.length > 0) {
        const senderNumber = jid.replace(/@s\.whatsapp\.net$|@g\.us$/, '');
        const isAllowedSender = ALLOWED_SENDERS.some(n => senderNumber.includes(n));
        log('MSG', `Sender check | number=${senderNumber} | allowed=${isAllowedSender}`);
        if (!isAllowedSender) { log('MSG', 'Blocked by ALLOWED_SENDERS'); continue; }
      }

      // Chat name filter (groups only)
      if (ALLOWED_CHATS.length > 0 && jid.endsWith('@g.us')) {
        let chatName = '';
        try {
          const meta = await sock.groupMetadata(jid);
          chatName = meta.subject.toLowerCase();
        } catch (_) {}
        const isAllowed = ALLOWED_CHATS.some(allowed => chatName.includes(allowed));
        log('MSG', `Chat check | name="${chatName}" | allowed=${isAllowed}`);
        if (!isAllowed) { log('MSG', 'Blocked by ALLOWED_CHATS'); continue; }
      }

      try {
        log('MSG', 'Voice message accepted — downloading audio...');
        const t1 = Date.now();
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: silentLogger, reuploadRequest: sock.updateMediaMessage });
        const base64 = buffer.toString('base64');
        const mimeType = msg.message.audioMessage?.mimetype || 'audio/ogg; codecs=opus';
        log('MSG', `Audio downloaded in ${Date.now() - t1}ms | mimetype=${mimeType} | size=${base64.length} bytes (base64)`);

        log('GEMINI', `Sending audio to ${GEMINI_MODEL} (${(base64.length * 0.75 / 1024).toFixed(1)} KB)...`);
        const t2 = Date.now();
        const result = await model.generateContent([
          { inlineData: { mimeType, data: base64 } },
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

        const selfId = sock.user.id;
        log('MSG', `Sending to self | selfId=${selfId}`);
        await sock.sendMessage(selfId, { forward: msg, force: true });
        await sock.sendMessage(selfId, { text: responseText });
        log('MSG', `Done — total processing time ${Date.now() - t0}ms`);
      } catch (err) {
        log('ERROR', `Processing failed after ${Date.now() - t0}ms: ${err.message}`);
        try { await sock.sendMessage(sock.user.id, { text: 'Error processing voice message: ' + err.message }); } catch (_) {}
      }
    }
  });
}

start();
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
