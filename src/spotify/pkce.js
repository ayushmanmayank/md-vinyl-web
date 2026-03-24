/**
 * PKCE (Proof Key for Public Clients) Implementation
 * Used for secure OAuth2 authorization without client secrets
 */

/**
 * Generate a random code verifier
 * @returns {string} Base64 URL-encoded random verifier
 */
export async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code challenge from verifier using SHA256
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} Base64 URL-encoded SHA256 hash
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64 URL encode (RFC 4648)
 * @param {Uint8Array} buffer - Data to encode
 * @returns {string} Base64 URL-encoded string
 */
function base64UrlEncode(buffer) {
  const binary = String.fromCharCode(...buffer);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Verify PKCE challenge (for testing/debugging)
 * @param {string} verifier - The original verifier
 * @param {string} storedChallenge - The stored challenge
 * @returns {Promise<boolean>} True if challenge matches verifier
 */
export async function verifyChallenge(verifier, storedChallenge) {
  const challenge = await generateCodeChallenge(verifier);
  return challenge === storedChallenge;
}
