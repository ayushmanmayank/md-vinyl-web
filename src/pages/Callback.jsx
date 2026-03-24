/**
 * Spotify OAuth Callback Handler
 * Runs after user authorizes the app on Spotify
 * Extracts code and exchanges it for access token
 */

import { exchangeCodeForToken, logout } from '../spotify/auth.js';

export default function CallbackPage() {
  const [status, setStatus] = React.useState('loading');
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      // Log full URL
      const fullUrl = window.location.href;
      console.log('📍 Callback URL:', fullUrl);

      // Extract code from query params
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorParam = params.get('error');

      console.log('Query params:', {
        code: code ? `${code.substring(0, 20)}...` : null,
        error: errorParam,
      });

      // Check for errors from Spotify
      if (errorParam) {
        const errorDesc = params.get('error_description');
        console.error('❌ Spotify error:', errorParam, errorDesc);
        setError(`Spotify authorization failed: ${errorDesc || errorParam}`);
        setStatus('error');
        return;
      }

      // Check if code is present
      if (!code) {
        console.error('❌ Authorization code missing from callback URL');
        setError('Authorization code missing from callback URL. Please try logging in again.');
        setStatus('error');
        return;
      }

      console.log('✅ Code extracted:', `${code.substring(0, 20)}...`);

      // Exchange code for token
      setStatus('exchanging');
      const tokenData = await exchangeCodeForToken(code);

      console.log('✅ Token exchange successful');
      setStatus('success');

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = '/spotify-dashboard';
      }, 1000);
    } catch (err) {
      console.error('❌ Callback handler error:', err);
      setError(err.message || 'Failed to complete authorization');
      setStatus('error');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <div style={styles.spinner}></div>
            <h2>Authorizing with Spotify...</h2>
            <p>Please wait while we complete the authorization process.</p>
          </>
        )}

        {status === 'exchanging' && (
          <>
            <div style={styles.spinner}></div>
            <h2>Exchanging authorization code...</h2>
            <p>Almost there! Getting your access token.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.successIcon}>✅</div>
            <h2>Authorization Successful!</h2>
            <p>Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.errorIcon}>❌</div>
            <h2>Authorization Failed</h2>
            <p style={styles.errorMessage}>{error}</p>
            <button
              style={styles.button}
              onClick={() => {
                logout();
                window.location.href = '/';
              }}
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#121212',
  },
  card: {
    background: '#1db954',
    padding: '40px',
    borderRadius: '10px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    color: 'white',
    maxWidth: '400px',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255, 255, 255, 0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  successIcon: {
    fontSize: '50px',
    marginBottom: '20px',
  },
  errorIcon: {
    fontSize: '50px',
    marginBottom: '20px',
  },
  errorMessage: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  button: {
    backgroundColor: '#191414',
    color: '#1db954',
    border: '2px solid #1db954',
    padding: '10px 20px',
    borderRadius: '24px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'all 0.3s',
  },
};

// Add CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
