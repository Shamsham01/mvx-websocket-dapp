/**
 * Generate MultiversX PEM file content from seed phrase.
 * Compatible with Make.com authentication for MakeX apps.
 * Based on: https://github.com/Shamsham01/Secure-PEM-Generator-MultiversX
 *
 * SECURITY: Never store seed phrase or PEM. Caller must wipe after use.
 */
import { Mnemonic } from '@multiversx/sdk-wallet';

export function generatePemContent(seedPhrase) {
  if (!seedPhrase || typeof seedPhrase !== 'string') {
    throw new Error('Seed phrase is required');
  }

  const trimmed = seedPhrase.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    throw new Error('Seed phrase cannot be empty');
  }

  const mnemonic = Mnemonic.fromString(trimmed);
  const buff = mnemonic.deriveKey();

  const secretKeyHex = buff.hex();
  const pubKeyHex = buff.generatePublicKey().hex();

  const combinedKeys = Buffer.from(secretKeyHex + pubKeyHex).toString('base64');
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  const content = `${header}\n${combinedKeys.replace(/(.{1,64})/g, '$1\n')}${footer}`;

  return content;
}
