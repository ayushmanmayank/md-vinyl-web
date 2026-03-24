import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchPlaylistTracks } from '../services/spotifyApi.js';

function TrackList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const playlistName = useMemo(
    () => location.state?.playlist?.name || 'Playlist Tracks',
    [location.state]
  );

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadTracks() {
      try {
        setLoading(true);
        const data = await fetchPlaylistTracks(id, 50);
        if (isMounted) {
          setTracks(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to load tracks.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTracks();
    return () => {
      isMounted = false;
    };
  }, [id]);

  function handleTrackClick(track) {
    if (!track) {
      return;
    }

    localStorage.setItem('selectedTrack', JSON.stringify(track));
    navigate('/player', { state: { track } });
  }

  if (loading) {
    return <div style={styles.centerText}>Loading tracks...</div>;
  }

  if (error) {
    return <div style={styles.centerText}>{error}</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <button type="button" onClick={() => navigate('/')} style={styles.backBtn}>
          Back
        </button>
        <h1 style={styles.title}>{playlistName}</h1>
      </div>

      <div style={styles.list}>
        {tracks.map((track) => (
          <button key={track.id} type="button" style={styles.row} onClick={() => handleTrackClick(track)}>
            <img
              src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || ''}
              alt={track.name}
              style={styles.thumb}
            />
            <div style={styles.rowText}>
              <p style={styles.trackName}>{track.name}</p>
              <p style={styles.artistName}>{(track.artists || []).map((a) => a.name).join(', ')}</p>
            </div>
            {!track.preview_url && <span style={styles.noPreview}>No preview</span>}
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
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  backBtn: {
    borderRadius: '999px',
    border: '1px solid #3d3d3d',
    background: '#151515',
    color: '#fff',
    padding: '8px 14px',
    cursor: 'pointer',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  list: {
    display: 'grid',
    gap: '10px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#181818',
    border: '1px solid #262626',
    borderRadius: '12px',
    padding: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
  },
  thumb: {
    width: '54px',
    height: '54px',
    borderRadius: '8px',
    objectFit: 'cover',
    background: '#2b2b2b',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  trackName: {
    margin: 0,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  artistName: {
    margin: '4px 0 0',
    color: '#b3b3b3',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  noPreview: {
    fontSize: '12px',
    color: '#f8ca5b',
  },
  centerText: {
    minHeight: '60vh',
    display: 'grid',
    placeItems: 'center',
    color: '#ffffff',
  },
};

export default TrackList;
