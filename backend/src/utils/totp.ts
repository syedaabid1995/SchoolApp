import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;

const toBase32 = (buffer: Buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const fromBase32 = (secret: string) => {
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid TOTP secret');
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

const createHotp = (secret: string, counter: number) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const digest = crypto.createHmac('sha1', fromBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
};

export const generateTotpSecret = () => toBase32(crypto.randomBytes(20));

export const createTotpUri = (params: {
  issuer: string;
  label: string;
  secret: string;
}) => {
  const label = `${params.issuer}:${params.label}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
    algorithm: 'SHA1',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
};

export const verifyTotpCode = async (params: {
  code: string;
  secret: string;
}) => {
  if (!/^\d{6}$/.test(params.code)) return false;
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
    if (createHotp(params.secret, counter + drift) === params.code) return true;
  }
  return false;
};

export const normalizeBackupCode = (code: string) =>
  code.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();

export const formatBackupCode = (code: string) =>
  `${code.slice(0, 4)}-${code.slice(4, 8)}`;

export const generateBackupCode = () =>
  formatBackupCode(crypto.randomBytes(4).toString('hex').toUpperCase());

export const generateBackupCodes = (count = 10) =>
  Array.from({ length: count }, () => generateBackupCode());

export const hashBackupCode = (code: string) =>
  crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
