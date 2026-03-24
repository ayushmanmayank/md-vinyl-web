/**
 * Spotify Authorization Code Flow with PKCE
 * Handles login and token exchange
 */

import { generateCodeVerifier, generateCodeChallenge } from './pkce.js';

// Spotify OAuth endpoints
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const OAUTH_STATE_KEY = 'spotify_oauth_state';

// Use your Spotify Client ID here
const CLIENT_ID = '060af9faf02a4879bf7081fd088e06cf';

// Scopes needed for the app
// These grant access to: profile, email, playlists, collaborative playlists, and top tracks
const SCOPES = [
  'user-read-private',           // Access profile data (name, profile picture, public playlists)
  'user-read-email',             // Access email address
  'playlist-read-private',       // Access private playlists
  'playlist-read-collaborative', // Access collaborative playlists
  'user-top-read',               // Access user's top tracks and artists
];

/**
 * Get the redirect URI (works on localhost and production)
 * IMPORTANT: Must match EXACTLY what's registered in Spotify Developer Dashboard
 * @returns {string} The redirect URI with trailing slash
 */
function getRedirectUri() {
  // Always use trailing slash - Spotify prefers this format
  return `${window.location.origin}/callback/`;
}

/**
 * Get redirect URI without trailing slash (for fallback matching)
 * @returns {string} The redirect URI without trailing slash
 */
function getRedirectUriNoSlash() {
  return `${window.location.origin}/callback`;
}

/**
 * Generate and store OAuth state value for CSRF protection
 * @returns {string} State token
 */
function generateOAuthState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  return state;
}

/**
 * Verify OAuth state returned by Spotify
 * @param {string|null} receivedState - state from callback URL
 */
export function verifyOAuthState(receivedState) {
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    throw new Error('State verification failed. Please log in again.');
  }
}

/**
 * Initiate Spotify login with PKCE
 */
export async function loginWithSpotify() {
  try {
    // Generate PKCE pair
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateOAuthState();

    // Store verifier in sessionStorage (will be used in callback)
    sessionStorage.setItem('spotify_code_verifier', codeVerifier);

    // Build authorization URL
    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      response_type: 'code', // CRITICAL: Use 'code' not 'token'
      client_id: CLIENT_ID,
      scope: SCOPES.join(' '),
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state,
    });

    const authUrl = `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;

    console.log('🔐 Initiating Spotify login...');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🟦 SPOTIFY AUTHORIZATION REQUEST:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Client ID:', CLIENT_ID);
    console.log('Redirect URI:', redirectUri);
    console.log('⚠️  VERIFY THIS MATCHES SPOTIFY DASHBOARD EXACTLY ⚠️');
    
    // Scope verification
    const scopeString = SCOPES.join(' ');
    console.log('\n📋 REQUESTED SCOPES:');
    console.log('Scope String:', scopeString);
    console.log('Individual Scopes:');
    SCOPES.forEach((scope, idx) => {
      console.log(`  ${idx + 1}. ${scope}`);
    });
    console.log('\n✅ Scope Format: Space-separated (no commas)');
    console.log('✅ Required Features Enabled:');
    console.log('   • Profile access (/v1/me) - via user-read-private');
    console.log('   • Email access - via user-read-email');
    console.log('   • Playlists access (/v1/me/playlists) - via playlist-read-private & playlist-read-collaborative');
    console.log('   • Top Tracks (/v1/me/top/tracks) - via user-top-read');
    console.log('   • Recommendations (/v1/recommendations) - available with current scopes');
    
    console.log('\nResponse Type:', 'code');
    console.log('PKCE Challenge Method:', 'S256');
    console.log('\n📍 FULL AUTH URL (for manual testing):');
    console.log(authUrl);
    console.log('\n🔍 Verify scope parameter contains (URL encoded):');
    console.log('scope=' + encodeURIComponent(scopeString));
    console.log('═══════════════════════════════════════════════════════\n');

    // Redirect to Spotify login
    window.location.href = authUrl;
  } catch (error) {
    console.error('❌ Login error:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @returns {Promise<object>} Token response with access_token
 */
export async function exchangeCodeForToken(code) {
  try {
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');

    if (!codeVerifier) {
      throw new Error('Code verifier not found. Login may have expired.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    });

    console.log('🔄 Exchanging code for token...');
    console.log('Request params:', {
      grant_type: params.get('grant_type'),
      code: params.get('code'),
      redirect_uri: params.get('redirect_uri'),
      client_id: params.get('client_id'),
      code_verifier: codeVerifier ? `${codeVerifier.substring(0, 10)}...` : 'missing',
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Token exchange failed:', data);
      throw new Error(data.error_description || 'Failed to exchange code for token');
    }

    console.log('✅ Token received:', {
      access_token: `${data.access_token.substring(0, 20)}...`,
      token_type: data.token_type,
      expires_in: data.expires_in,
    });

    // Store token and expiry
    sessionStorage.setItem('spotify_access_token', data.access_token);
    sessionStorage.setItem('spotify_token_expiry', Date.now() + data.expires_in * 1000);

    // Clean up verifier (no longer needed)
    sessionStorage.removeItem('spotify_code_verifier');
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    return data;
  } catch (error) {
    console.error('❌ Token exchange error:', error);
    throw error;
  }
}

/**
 * Get stored access token
 * @returns {string|null} Access token or null if not available
 */
export function getAccessToken() {
  const token = sessionStorage.getItem('spotify_access_token');
  const expiry = sessionStorage.getItem('spotify_token_expiry');

  if (!token || !expiry) {
    return null;
  }

  // Check if token expired
  if (Date.now() > parseInt(expiry)) {
    console.warn('⚠️ Access token expired');
    sessionStorage.removeItem('spotify_access_token');
    sessionStorage.removeItem('spotify_token_expiry');
    return null;
  }

  return token;
}

/**
 * Logout and clear tokens
 */
export function logout() {
  sessionStorage.removeItem('spotify_access_token');
  sessionStorage.removeItem('spotify_token_expiry');
  sessionStorage.removeItem('spotify_code_verifier');
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem('spotify_callback_code');
  sessionStorage.removeItem('spotify_callback_state');
  console.log('✅ Logged out');
}
