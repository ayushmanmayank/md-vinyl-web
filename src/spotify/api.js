/**
 * Spotify Web API Interface
 * Handles authenticated API requests to Spotify
 */

import { getAccessToken, loginWithSpotify } from './auth.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Generic Spotify API fetch with Bearer token and error handling
 * @param {string} endpoint - API endpoint (e.g., '/me', '/me/playlists')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} API response
 */
export async function spotifyFetch(endpoint, options = {}) {
  const token = getAccessToken();

  if (!token) {
    console.error('❌ No access token available. Redirecting to login...');
    console.log('Session storage keys:', Object.keys(sessionStorage));
    loginWithSpotify();
    throw new Error('No access token. Redirecting to login.');
  }

  const url = `${SPOTIFY_API_BASE}${endpoint}`;
  let retries = 0;

  console.log(`📡 Spotify API request: ${url}`);

  while (retries < MAX_RETRIES) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle 401 Unauthorized - token expired
      if (response.status === 401) {
        console.warn('⚠️ Token expired (401). Please log in again.');
        loginWithSpotify();
        const authError = new Error('Token expired. Redirecting to login.');
        authError.noRetry = true;
        throw authError;
      }

      // Handle 429 Rate Limited - retry with backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || RETRY_DELAY / 1000;
        retries++;
        console.warn(`⏳ Rate limited. Retrying in ${retryAfter}s (attempt ${retries}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      // Handle other errors
      if (!response.ok) {
        let errorData = {};
        let errorText = '';
        try {
          errorData = await response.json();
        } catch {
          try {
            errorText = await response.text();
          } catch {
            errorText = '';
          }
        }

        const apiMessage =
          errorData?.error?.message ||
          errorData?.message ||
          errorText ||
          response.statusText;

        console.error(`❌ Spotify API error on ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          message: apiMessage,
          payload: errorData,
        });

        const apiError = new Error(`Spotify API error (${response.status}): ${apiMessage}`);
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          apiError.noRetry = true;
        }
        throw apiError;
      }

      const data = await response.json();
      console.log(`✅ API call successful: ${endpoint}`);
      return data;
    } catch (error) {
      if (error?.noRetry) {
        console.error('❌ Non-retriable API error:', error.message);
        throw error;
      }

      retries++;
      if (retries >= MAX_RETRIES) {
        console.error(`❌ API call failed after ${MAX_RETRIES} attempts:`, error);
        throw error;
      }
      console.warn(`⚠️ Attempt ${retries}/${MAX_RETRIES} failed. Retrying...`, error.message);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

/**
 * Get current user's profile
 * @returns {Promise<object>} User profile data
 */
export async function getCurrentUser() {
  return spotifyFetch('/me');
}

/**
 * Get user's playlists
 * @param {object} options - Query options (limit, offset)
 * @returns {Promise<object>} Playlists
 */
export async function getUserPlaylists(options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
  return spotifyFetch(`/me/playlists?${params}`);
}

/**
 * Get user's top tracks
 * @param {object} options - Query options (time_range, limit, offset)
 * @returns {Promise<object>} Top tracks
 */
export async function getUserTopTracks(options = {}) {
  const params = new URLSearchParams({
    time_range: options.time_range || 'medium_term', // short_term, medium_term, long_term
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
  return spotifyFetch(`/me/top/tracks?${params}`);
}

/**
 * Get user's top artists
 * @param {object} options - Query options (time_range, limit, offset)
 * @returns {Promise<object>} Top artists
 */
export async function getUserTopArtists(options = {}) {
  const params = new URLSearchParams({
    time_range: options.time_range || 'medium_term',
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
  return spotifyFetch(`/me/top/artists?${params}`);
}

/**
 * Get playlist details
 * @param {string} playlistId - Spotify playlist ID
 * @returns {Promise<object>} Playlist data
 */
export async function getPlaylist(playlistId) {
  return spotifyFetch(`/playlists/${playlistId}`);
}

/**
 * Get playlist tracks
 * @param {string} playlistId - Spotify playlist ID
 * @param {object} options - Query options (limit, offset)
 * @returns {Promise<object>} Playlist tracks
 */
export async function getPlaylistTracks(playlistId, options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
  return spotifyFetch(`/playlists/${playlistId}/tracks?${params}`);
}

/**
 * Get recommendations based on seed tracks/artists
 * @param {object} options - Seed options and query parameters
 * @returns {Promise<object>} Recommended tracks
 */
export async function getRecommendations(options = {}) {
  const seedTracks = (options.seed_tracks || '').trim();
  const seedArtists = (options.seed_artists || '').trim();
  const seedGenres = (options.seed_genres || '').trim();

  if (!seedTracks && !seedArtists && !seedGenres) {
    throw new Error('Recommendations require at least one seed: seed_tracks, seed_artists, or seed_genres.');
  }

  const params = new URLSearchParams({
    seed_tracks: seedTracks,
    seed_artists: seedArtists,
    seed_genres: seedGenres,
    limit: options.limit || 20,
  });

  console.log('🎯 Recommendations seeds:', {
    seed_tracks: seedTracks ? `${seedTracks.substring(0, 24)}...` : '(none)',
    seed_artists: seedArtists ? `${seedArtists.substring(0, 24)}...` : '(none)',
    seed_genres: seedGenres || '(none)',
  });

  return spotifyFetch(`/recommendations?${params}`);
}

/**
 * Get available genres
 * @returns {Promise<object>} List of genres
 */
export async function getAvailableGenres() {
  return spotifyFetch('/recommendations/available-genre-seeds');
}

/**
 * Search Spotify catalog
 * @param {string} query - Search query
 * @param {string} type - Search type (track, artist, album, playlist)
 * @param {object} options - Query options (limit, offset)
 * @returns {Promise<object>} Search results
 */
export async function search(query, type = 'track', options = {}) {
  const params = new URLSearchParams({
    q: query,
    type: type,
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
  return spotifyFetch(`/search?${params}`);
}
