/**
 * Spotify Dashboard Component
 * Displays user profile, playlists, top tracks, and recommendations
 */

import {
  getCurrentUser,
  getUserPlaylists,
  getUserTopTracks,
  getRecommendations,
} from '../spotify/api.js';
import { logout } from '../spotify/auth.js';

export default function SpotifyDashboard() {
  const [user, setUser] = React.useState(null);
  const [playlists, setPlaylists] = React.useState([]);
  const [topTracks, setTopTracks] = React.useState([]);
  const [recommendations, setRecommendations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('profile');

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Loading Spotify dashboard data...');

      // Fetch user profile
      const userProfile = await getCurrentUser();
      setUser(userProfile);
      console.log('✅ User profile loaded:', userProfile.display_name);

      // Fetch playlists
      const playlistsData = await getUserPlaylists({ limit: 20 });
      setPlaylists(playlistsData.items);
      console.log(`✅ Playlists loaded: ${playlistsData.items.length} items`);

      // Fetch top tracks
      const topTracksData = await getUserTopTracks({ limit: 20, time_range: 'medium_term' });
      setTopTracks(topTracksData.items);
      console.log(`✅ Top tracks loaded: ${topTracksData.items.length} items`);

      // Fetch recommendations if we have top tracks
      if (topTracksData.items.length > 0) {
        const seedTrackIds = topTracksData.items.slice(0, 3).map(t => t.id).join(',');
        const recsData = await getRecommendations({
          seed_tracks: seedTrackIds,
          limit: 20,
        });
        setRecommendations(recsData.tracks);
        console.log(`✅ Recommendations loaded: ${recsData.tracks.length} items`);
      }

      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading dashboard:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}></div>
        <p>Loading your Spotify data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <h2>❌ Error Loading Dashboard</h2>
          <p>{error}</p>
          <button style={styles.button} onClick={handleLogout}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.userInfo}>
          {user?.images?.[0]?.url && (
            <img src={user.images[0].url} alt={user.display_name} style={styles.avatar} />
          )}
          <div>
            <h1>{user?.display_name}</h1>
            <p>{user?.email}</p>
            <p style={styles.meta}>
              {user?.followers?.total?.toLocaleString()} followers • {user?.product === 'premium' ? 'Premium' : 'Free'} Plan
            </p>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.tabs}>
        {['profile', 'playlists', 'topTracks', 'recommendations'].map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tabBtn,
              ...(activeTab === tab ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'profile' && '👤 Profile'}
            {tab === 'playlists' && '🎵 Playlists'}
            {tab === 'topTracks' && '⭐ Top Tracks'}
            {tab === 'recommendations' && '✨ Recommendations'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div>
            <h2>Your Profile</h2>
            <div style={styles.profileGrid}>
              <div style={styles.profileCard}>
                <span style={styles.label}>Followers</span>
                <span style={styles.value}>{user?.followers?.total?.toLocaleString()}</span>
              </div>
              <div style={styles.profileCard}>
                <span style={styles.label}>Following</span>
                <span style={styles.value}>{user?.following?.toLocaleString()}</span>
              </div>
              <div style={styles.profileCard}>
                <span style={styles.label}>Account Type</span>
                <span style={styles.value}>{user?.product === 'premium' ? '🎵 Premium' : 'Free'}</span>
              </div>
              <div style={styles.profileCard}>
                <span style={styles.label}>URI</span>
                <a href={user?.external_urls?.spotify} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  View on Spotify →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Playlists Tab */}
        {activeTab === 'playlists' && (
          <div>
            <h2>Your Playlists ({playlists.length})</h2>
            <div style={styles.grid}>
              {playlists.map(playlist => (
                <a
                  key={playlist.id}
                  href={playlist.external_urls?.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.playlistCard}
                >
                  {playlist.images?.[0]?.url && (
                    <img src={playlist.images[0].url} alt={playlist.name} style={styles.playlistImage} />
                  )}
                  <h3>{playlist.name}</h3>
                  <p>{playlist.tracks?.total} tracks</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Top Tracks Tab */}
        {activeTab === 'topTracks' && (
          <div>
            <h2>Your Top Tracks</h2>
            <div style={styles.trackList}>
              {topTracks.map((track, index) => (
                <a
                  key={track.id}
                  href={track.external_urls?.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.trackItem}
                >
                  <span style={styles.trackIndex}>{index + 1}</span>
                  <div style={styles.trackInfo}>
                    <h4>{track.name}</h4>
                    <p>{track.artists?.map(a => a.name).join(', ')}</p>
                  </div>
                  <span style={styles.trackDuration}>
                    {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div>
            <h2>Recommended For You</h2>
            <div style={styles.grid}>
              {recommendations.map(track => (
                <a
                  key={track.id}
                  href={track.external_urls?.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.trackCard}
                >
                  {track.album?.images?.[0]?.url && (
                    <img src={track.album.images[0].url} alt={track.name} style={styles.trackCardImage} />
                  )}
                  <h4>{track.name}</h4>
                  <p>{track.artists?.map(a => a.name).join(', ')}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CSS Animation Style */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: '#121212',
    color: '#ffffff',
    minHeight: '100vh',
    fontFamily: 'Segoe UI, Arial, sans-serif',
  },
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#ffffff',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(29, 185, 84, 0.3)',
    borderTop: '4px solid #1db954',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px',
  },
  errorBox: {
    backgroundColor: '#282828',
    padding: '40px',
    borderRadius: '10px',
    textAlign: 'center',
    maxWidth: '500px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1db954',
    padding: '20px 40px',
    color: '#ffffff',
  },
  userInfo: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
  },
  meta: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: '5px 0 0 0',
  },
  logoutBtn: {
    backgroundColor: '#191414',
    color: '#1db954',
    border: '2px solid #1db954',
    padding: '10px 20px',
    borderRadius: '24px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    borderBottom: '1px solid #282828',
    padding: '0 40px',
    backgroundColor: '#191414',
  },
  tabBtn: {
    backgroundColor: 'transparent',
    color: '#b3b3b3',
    border: 'none',
    padding: '15px 20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    borderBottom: '3px solid transparent',
    transition: 'all 0.3s',
  },
  tabBtnActive: {
    color: '#1db954',
    borderBottomColor: '#1db954',
  },
  content: {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  profileCard: {
    backgroundColor: '#282828',
    padding: '20px',
    borderRadius: '10px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  label: {
    color: '#b3b3b3',
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1db954',
  },
  link: {
    color: '#1db954',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  playlistCard: {
    backgroundColor: '#282828',
    padding: '15px',
    borderRadius: '10px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background-color 0.3s',
  },
  playlistImage: {
    width: '100%',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '5px',
    marginBottom: '10px',
  },
  trackCard: {
    backgroundColor: '#282828',
    padding: '15px',
    borderRadius: '10px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background-color 0.3s',
  },
  trackCardImage: {
    width: '100%',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '5px',
    marginBottom: '10px',
  },
  trackList: {
    marginTop: '20px',
  },
  trackItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '12px 0',
    borderBottom: '1px solid #282828',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background-color 0.3s',
  },
  trackIndex: {
    color: '#b3b3b3',
    minWidth: '30px',
    textAlign: 'center',
    fontSize: '14px',
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  trackDuration: {
    color: '#b3b3b3',
    fontSize: '14px',
    minWidth: '50px',
    textAlign: 'right',
  },
  button: {
    backgroundColor: '#1db954',
    color: '#191414',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '24px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginTop: '20px',
  },
};
