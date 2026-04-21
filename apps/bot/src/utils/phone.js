function normalizePhone(input) {
  if (!input) return null;
  let phone = String(input).replace(/[\s\-()\.]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.length === 10 || phone.length === 11) {
    phone = '55' + phone;
  }
  if (!/^55\d{10,11}$/.test(phone)) return null;
  return phone;
}

function brMobileVariants(phone) {
  if (!phone || typeof phone !== 'string' || !phone.startsWith('55')) return [phone];
  if (phone.length !== 12 && phone.length !== 13) return [phone];
  const ddd = phone.slice(2, 4);
  const rest = phone.slice(4);
  if (rest.length === 9 && rest[0] === '9') {
    return [phone, '55' + ddd + rest.slice(1)];
  }
  if (rest.length === 8 && /^[6-9]/.test(rest)) {
    return [phone, '55' + ddd + '9' + rest];
  }
  return [phone];
}

function formatPhone(normalized) {
  if (!normalized || normalized.length < 12) return normalized;
  const countryCode = normalized.slice(0, 2);
  const ddd = normalized.slice(2, 4);
  const number = normalized.slice(4);
  if (number.length === 9) {
    return `+${countryCode} ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  return `+${countryCode} ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`;
}

function jidToPhone(jid) {
  if (!jid) return null;
  const match = jid.match(/^(\d+)@/);
  return match ? match[1] : null;
}

function phoneToJid(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `${normalized}@s.whatsapp.net`;
}

function isGroupJid(jid) {
  return jid?.endsWith('@g.us') || false;
}

function isIndividualJid(jid) {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

module.exports = {
  normalizePhone,
  brMobileVariants,
  formatPhone,
  jidToPhone,
  phoneToJid,
  isGroupJid,
  isIndividualJid,
};
