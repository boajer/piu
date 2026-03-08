require('dotenv').config();

const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Config ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TARGET_LANGUAGE = process.env.TARGET_LANGUAGE || 'English';
const ALLOWED_CHATS = process.env.ALLOWED_CHATS
  ? process.env.ALLOWED_CHATS.split(',').map(s => s.trim().toLowerCase())
  : [];

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// --- WhatsApp client ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\nScan this QR code with WhatsApp (Linked Devices):\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log(`\nBot is ready! Translating voice messages to: ${TARGET_LANGUAGE}`);
  if (ALLOWED_CHATS.length > 0) {
    console.log(`Monitoring chats: ${ALLOWED_CHATS.join(', ')}`);
  } else {
    console.log('Monitoring: ALL chats');
  }
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
  console.log('Client disconnected:', reason);
});

// --- Message handler ---
client.on('message', async (message) => {
  try {
    // Only handle audio/voice messages
    const isVoice = message.type === MessageTypes.AUDIO || message.type === MessageTypes.VOICE;
    if (!isVoice) return;

    // If ALLOWED_CHATS is set, filter by chat name
    if (ALLOWED_CHATS.length > 0) {
      const chat = await message.getChat();
      const chatName = chat.name ? chat.name.toLowerCase() : '';
      const isAllowed = ALLOWED_CHATS.some(allowed => chatName.includes(allowed));
      if (!isAllowed) return;
    }

    console.log(`\nVoice message received (forwarded: ${message.isForwarded})`);

    // Download the audio
    const media = await message.downloadMedia();
    if (!media || !media.data) {
      console.error('Failed to download media');
      return;
    }

    // React to show processing
    await message.react('⏳');

    // Send audio to Gemini for transcription + translation
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: media.mimetype || 'audio/ogg; codecs=opus',
          data: media.data, // base64
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

    // Reply to the voice message with the translation
    await message.reply(responseText);
    await message.react('✅');

    console.log('Translation sent successfully');
  } catch (err) {
    console.error('Error processing voice message:', err.message);
    try {
      await message.react('❌');
      await message.reply('Sorry, I could not process this voice message. Error: ' + err.message);
    } catch (_) {}
  }
});

client.initialize();
