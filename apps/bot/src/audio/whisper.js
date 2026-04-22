const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set');
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const MAX_AUDIO_SECONDS = 5 * 60; // 5 minutos
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB (defesa em profundidade)

const USER_MESSAGE_TOO_LARGE =
  'O áudio é muito longo. Envia por favor em texto ou num áudio mais curto (até 5 min).';

class AudioTooLargeError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'AudioTooLargeError';
    this.userMessage = USER_MESSAGE_TOO_LARGE;
  }
}

async function transcribe(msg) {
  const audioInfo = msg.message?.audioMessage || {};
  const seconds = audioInfo.seconds || 0;
  if (seconds > MAX_AUDIO_SECONDS) {
    throw new AudioTooLargeError(`duration ${seconds}s > ${MAX_AUDIO_SECONDS}s`);
  }

  const buffer = await downloadMediaMessage(msg, 'buffer', {});

  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new AudioTooLargeError(`size ${buffer.length} bytes > ${MAX_AUDIO_BYTES}`);
  }

  const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

  const response = await getClient().audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'pt',
  });

  return response.text;
}

function isEnabled() {
  return !!process.env.OPENAI_API_KEY;
}

module.exports = { transcribe, isEnabled, AudioTooLargeError, USER_MESSAGE_TOO_LARGE };
