const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { loadTenantAuth } = require('./session-store');
const { whatsappContacts } = require('@agenda-facil/db');

function jidToPhoneOnly(jid) {
  if (!jid) return null;
  const m = jid.match(/^(\d{10,15})@/);
  return m ? m[1] : null;
}

async function syncContactsFromBaileys(tenantId, contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return 0;
  const rows = [];
  for (const c of contacts) {
    if (!c?.id || c.id.endsWith('@broadcast') || c.id.endsWith('@g.us')) continue;
    rows.push({
      jid: c.id,
      phone: jidToPhoneOnly(c.id),
      push_name: c.notify || c.name || null,
      verified_name: c.verifiedName || null,
      notify_name: c.notify || null,
    });
  }
  if (rows.length === 0) return 0;
  try {
    return await whatsappContacts.upsertMany(tenantId, rows);
  } catch (err) {
    console.error('[baileys] contacts sync failed:', err.message);
    return 0;
  }
}

// Mapa de tenantId -> { sock, slug, meta }
const sockets = new Map();

// Último QR pendente por tenant (para expor via rota HTTP de pareamento remoto).
// É limpo assim que o tenant conecta com sucesso.
const lastQr = new Map();

// Handler global de mensagens entrantes: (msg, { tenantId, tenant }) -> Promise
let messageHandler = null;

function setMessageHandler(handler) {
  messageHandler = handler;
}

function getSocket(tenantId) {
  return sockets.get(tenantId)?.sock || null;
}

function getLastQr(tenantId) {
  return lastQr.get(tenantId) || null;
}

async function sendText(tenantId, jid, text) {
  const entry = sockets.get(tenantId);
  if (!entry?.sock) throw new Error(`No connected WhatsApp session for tenant ${tenantId}`);
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
  return entry.sock.sendMessage(jid, { text });
}

async function markRead(tenantId, msg) {
  const entry = sockets.get(tenantId);
  if (!entry?.sock) return;
  try {
    await entry.sock.readMessages([msg.key]);
  } catch (err) {
    console.error(`[WhatsApp:${entry.slug}] mark read failed:`, err.message);
  }
}

async function connectTenant(tenant, { onQr, onPaired } = {}) {
  const { state, saveCreds, hasCredentials, authDir } = await loadTenantAuth(tenant.slug);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sockets.set(tenant.id, { sock, slug: tenant.slug, meta: { hasCredentials, authDir } });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      lastQr.set(tenant.id, qr);
      if (onQr) onQr(qr);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        `[WhatsApp:${tenant.slug}] connection closed (status ${statusCode}). reconnect=${shouldReconnect}`,
      );
      sockets.delete(tenant.id);
      if (shouldReconnect) {
        setTimeout(() => {
          connectTenant(tenant, { onQr, onPaired }).catch((err) =>
            console.error(`[WhatsApp:${tenant.slug}] reconnect failed:`, err.message),
          );
        }, 5000);
      }
    } else if (connection === 'open') {
      console.log(`[WhatsApp:${tenant.slug}] connected`);
      lastQr.delete(tenant.id);
      if (onPaired) onPaired();
    }
  });

  // Sincroniza contatos do WhatsApp do aparelho pareado.
  // Baileys entrega via vários eventos; normalizamos num upsert idempotente.
  sock.ev.on('contacts.upsert', async (contacts) => {
    const n = await syncContactsFromBaileys(tenant.id, contacts);
    if (n > 0) console.log(`[WhatsApp:${tenant.slug}] contacts.upsert synced ${n}`);
  });

  sock.ev.on('contacts.update', async (updates) => {
    const n = await syncContactsFromBaileys(tenant.id, updates);
    if (n > 0) console.log(`[WhatsApp:${tenant.slug}] contacts.update synced ${n}`);
  });

  // Primeira sincronização — Baileys entrega contatos junto com o history.set
  sock.ev.on('messaging-history.set', async ({ contacts }) => {
    const n = await syncContactsFromBaileys(tenant.id, contacts || []);
    if (n > 0) console.log(`[WhatsApp:${tenant.slug}] history.set initial contacts: ${n}`);
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (!msg.message) continue;

      if (msg.key.fromMe) {
        // Mensagens do próprio número pareado são ignoradas por padrão
        // (evita loop bot→bot). Exceção: comandos admin (`/...`) enviados
        // pelo dono no self-chat.
        const text = getMessageText(msg);
        if (!text || !text.trim().startsWith('/')) continue;
      }

      if (messageHandler) {
        try {
          await messageHandler(msg, { tenantId: tenant.id, tenant });
        } catch (err) {
          console.error(`[WhatsApp:${tenant.slug}] handler error:`, err);
        }
      }
    }
  });

  return sock;
}

async function disconnectTenant(tenantId) {
  const entry = sockets.get(tenantId);
  if (!entry) return;
  try {
    await entry.sock.logout();
  } catch {
    // best-effort
  }
  sockets.delete(tenantId);
}

function listConnected() {
  return [...sockets.entries()].map(([tenantId, entry]) => ({ tenantId, slug: entry.slug }));
}

function getMessageText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ''
  );
}

function isAudioMessage(msg) {
  return !!msg.message?.audioMessage;
}

function getSenderJid(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function getChatJid(msg) {
  return msg.key.remoteJid;
}

function getMessageId(msg) {
  return msg.key.id;
}

module.exports = {
  setMessageHandler,
  connectTenant,
  disconnectTenant,
  sendText,
  markRead,
  getSocket,
  getLastQr,
  listConnected,
  getMessageText,
  isAudioMessage,
  getSenderJid,
  getChatJid,
  getMessageId,
};
