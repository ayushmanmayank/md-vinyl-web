import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/player.css';

function Player() {
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef(null);

  const track = useMemo(() => {
    if (location.state?.track) {
      return location.state.track;
    }

    try {
      const fallback = localStorage.getItem('selectedTrack');
      return fallback ? JSON.parse(fallback) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [playbackMessage, setPlaybackMessage] = useState('');

  async function attemptAutoPlay(audio) {
    if (!audio) {
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setPlaybackMessage('');
    } catch {
      setIsPlaying(false);
      setPlaybackMessage('Tap Play to start preview.');
    }
  }

  useEffect(() => {
    if (!track) {
      navigate('/', { replace: true });
      return;
    }

    const hasPreview = !!track.preview_url;
    setPreviewUnavailable(!hasPreview);

    if (!hasPreview || !audioRef.current) {
      setIsPlaying(false);
      setPlaybackMessage('');
      return;
    }

    const audio = audioRef.current;
    audio.src = track.preview_url;
    audio.currentTime = 0;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onCanPlay = () => {
      if (audio.paused) {
        void attemptAutoPlay(audio);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('canplay', onCanPlay);

    void attemptAutoPlay(audio);

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [track, navigate]);

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio || previewUnavailable) {
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setPlaybackMessage('');
        })
        .catch(() => {
          setIsPlaying(false);
          setPlaybackMessage('Playback blocked by browser. Try again.');
        });
    } else {
      audio.pause();
    }
  }

  if (!track) {
    return null;
  }

  return (
    <div className="player-page">
      <div className="player-card">
        <button className="player-back" type="button" onClick={() => navigate(-1)}>
          Back
        </button>

        <div className={`vinyl ${isPlaying ? 'is-spinning' : ''}`}>
          {track.album?.images?.[0]?.url ? (
            <img className="vinyl-art" src={track.album.images[0].url} alt={track.name} />
          ) : (
            <div className="vinyl-placeholder">No Art</div>
          )}
          <span className="vinyl-center" />
        </div>

        <h1 className="player-title">{track.name || 'Unknown Track'}</h1>
        <p className="player-artist">{(track.artists || []).map((a) => a.name).join(', ') || 'Unknown Artist'}</p>

        {previewUnavailable ? (
          <p className="player-warning">Preview not available</p>
        ) : (
          <>
            <button className="player-control" type="button" onClick={togglePlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            {playbackMessage && <p className="player-warning">{playbackMessage}</p>}
          </>
        )}

        <audio ref={audioRef} preload="none" />
      </div>
    </div>
  );
}

export default Player;
