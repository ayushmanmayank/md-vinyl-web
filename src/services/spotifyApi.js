import { getUserPlaylists, getPlaylistTracks } from '../spotify/api.js';

export async function fetchPlaylists(limit = 20) {
  const data = await getUserPlaylists({ limit, offset: 0 });
  return data?.items || [];
}

export async function fetchPlaylistTracks(playlistId, limit = 50) {
  if (!playlistId) {
    return [];
  }

  const data = await getPlaylistTracks(playlistId, { limit, offset: 0 });
  const items = data?.items || [];

  return items
    .map((item) => item?.track)
    .filter((track) => !!track && !!track.id);
}
