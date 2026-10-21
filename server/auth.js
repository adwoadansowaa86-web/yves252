import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// Stateless admin sessions: a signed token holding an expiry time.
export function createAuth({ password, secret }) {
  const key = secret || randomBytes(32).toString('hex');
  const sign = (payload) => createHmac('sha256', key).update(payload).digest('base64url');

  const safeEqual = (a, b) => {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  };

  const attempts = new Map();

  return {
    login(ip, candidate) {
      const now = Date.now();
      const entry = attempts.get(ip) ?? { count: 0, since: now };
      if (now - entry.since > 15 * 60 * 1000) Object.assign(entry, { count: 0, since: now });
      if (entry.count >= 10) return { error: 'Too many attempts. Try again in 15 minutes.' };
      if (!password || !safeEqual(candidate ?? '', password)) {
        entry.count += 1;
        attempts.set(ip, entry);
        return { error: 'Incorrect password' };
      }
      attempts.delete(ip);
      const payload = Buffer.from(JSON.stringify({ exp: now + TOKEN_TTL_MS })).toString('base64url');
      return { token: `${payload}.${sign(payload)}` };
    },
    verify(token) {
      const [payload, sig] = String(token ?? '').split('.');
      if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
      try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
      } catch {
        return false;
      }
    },
  };
}
