// src/lib/crypto.ts
// AES-256-GCM encryption/decryption for sensitive fields (e.g. email app passwords).
// The key must be a 64-character hex string (32 bytes) stored in APP_PASSWORD_ENCRYPTION_KEY.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
    const key = process.env.APP_PASSWORD_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('APP_PASSWORD_ENCRYPTION_KEY environment variable is not set');
    }
    if (key.length !== 64) {
        throw new Error('APP_PASSWORD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(key, 'hex');
}

/**
 * Encrypts a plaintext string.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string produced by encrypt().
 * Returns the original plaintext.
 */
export function decrypt(data: string): string {
    const parts = data.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Returns true if the value looks like an encrypted string (iv:tag:ciphertext).
 * Useful during migration to avoid double-encrypting.
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(':');
    return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}
