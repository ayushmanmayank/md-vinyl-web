import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPlaylists } from '../services/spotifyApi.js';

function Playlist() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPlaylists() {
      try {
        setLoading(true);
        const data = await fetchPlaylists(20);
        if (isMounted) {
          setPlaylists(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to load playlists.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPlaylists();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div style={styles.centerText}>Loading playlists...</div>;
  }

  if (error) {
    return <div style={styles.centerText}>{error}</div>;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Your Playlists</h1>
      <div style={styles.grid}>
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            type="button"
            style={styles.card}
            onClick={() => navigate(`/playlist/${playlist.id}`, { state: { playlist } })}
          >
            {playlist.images?.[0]?.url ? (
              <img src={playlist.images[0].url} alt={playlist.name} style={styles.cover} />
            ) : (
              <div style={styles.coverPlaceholder}>No image</div>
            )}
            <div style={styles.cardText}>
              <p style={styles.name}>{playlist.name}</p>
              <p style={styles.meta}>{playlist.tracks?.total || 0} tracks</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '980px',
    margin: '0 auto',
    padding: '24px',
    color: '#ffffff',
  },
  title: {
    margin: '0 0 20px',
    fontSize: '30px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#181818',
    border: '1px solid #262626',
    borderRadius: '12px',
    padding: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
  },
  cover: {
    width: '100%',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: '8px',
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '8px',
    display: 'grid',
    placeItems: 'center',
    background: '#303030',
    color: '#cfcfcf',
  },
  cardText: {
    marginTop: '10px',
  },
  name: {
    margin: 0,
    fontWeight: 700,
  },
  meta: {
    margin: '6px 0 0',
    color: '#b3b3b3',
    fontSize: '14px',
  },
  centerText: {
    minHeight: '60vh',
    display: 'grid',
    placeItems: 'center',
    color: '#ffffff',
  },
};

export default Playlist;
