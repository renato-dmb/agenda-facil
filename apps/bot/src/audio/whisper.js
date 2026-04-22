const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const MAX_AUDIO_SECONDS = 5 * 60; // 5 min
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const audioInfo = msg.message?.audioMessage || {};
  const seconds = audioInfo.seconds || 0;
  if (seconds > MAX_AUDIO_SECONDS) {
    throw new AudioTooLargeError(`duration ${seconds}s > ${MAX_AUDIO_SECONDS}s`);
  }

  const buffer = await downloadMediaMessage(msg, 'buffer', {});
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new AudioTooLargeError(`size ${buffer.length} bytes > ${MAX_AUDIO_BYTES}`);
  }

  // Node 20+ tem fetch + FormData + Blob nativos via undici — evita polyfills
  // inconsistentes do SDK openai em ambientes de container.
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'audio.ogg');
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`whisper http ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.text || '';
}

function isEnabled() {
  return !!process.env.OPENAI_API_KEY;
}

module.exports = { transcribe, isEnabled, AudioTooLargeError, USER_MESSAGE_TOO_LARGE };
