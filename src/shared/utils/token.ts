import crypto from 'crypto';

/**
 * Generates a cryptographically secure random token.
 * Returns a 64-character hex string (32 bytes of entropy).
 * Used for password reset and email verification tokens.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a token using SHA-256.
 * Entropy lives in the raw token — SHA-256 is sufficient for secure one-time tokens.
 * Do NOT use this for passwords — use bcrypt for passwords.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
